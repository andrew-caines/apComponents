import type { Mode, Oklch } from './types.js'
import { oklchToHex, round6 } from './oklch.js'
import { clampToSrgb, formatP3, inSrgb } from './gamut.js'
import { wcagRatio } from './wcag.js'
import { apcaLc } from './apca.js'

export interface RampStep {
  hex: string
  p3: string | null
}

export interface Ramp {
  steps: RampStep[]
  onSolid: string
}

// Lightness targets per step (index 0 = step 1). NaN = anchored to seed.
// These are the tuning surface: change them, review the snapshot diff (gate 1),
// re-run the contrast gate (gate 2). ADR-0006 documents the role of each step.
const L_TARGETS: Record<Mode, number[]> = {
  light: [0.994, 0.981, 0.955, 0.928, 0.898, 0.858, 0.805, 0.727, NaN, NaN, 0.5, 0.243],
  dark: [0.178, 0.212, 0.252, 0.288, 0.322, 0.37, 0.432, 0.517, NaN, NaN, 0.78, 0.93],
}

// Chroma per step, as a fraction of seed chroma.
const C_CURVE = [0.06, 0.1, 0.2, 0.3, 0.4, 0.5, 0.62, 0.8, 1, 1, 0.9, 0.55]
// Absolute chroma ceilings for steps 1–2 keep backgrounds calm at any seed.
const C_ABS_CAP: Array<number | null> = [0.02, 0.03, null, null, null, null, null, null, null, null, null, null]

const HOVER_L_DELTA = 0.04 // step 10: moves away from the on-solid text colour
const HOVER_L_MIN = 0.1
const HOVER_L_MAX = 0.95

function toStep(ideal: Oklch): RampStep {
  const srgb = clampToSrgb(ideal)
  return {
    hex: oklchToHex(srgb),
    p3: inSrgb(ideal) ? null : formatP3(ideal),
  }
}

// Backgrounds are sRGB-clamped by design; P3 richness is for solids/text (steps 9–12).
function toBgStep(ideal: Oklch): RampStep {
  return { hex: oklchToHex(clampToSrgb(ideal)), p3: null }
}

const MICRO = 1e6

/**
 * Bisect lightness from `startL` toward `boundL` on the 1e-6 **integer lattice**,
 * returning a value that `passes` verified directly, or null when no lattice
 * value in range passes.
 *
 * Why the lattice: `passes` always runs through oklchToHex(clampToSrgb(...)),
 * so it is a step function over ~1e-6-wide treads, and it is *not* strictly
 * monotone near the sRGB gamut boundary — lowering L there also moves the
 * chroma the clamp picks, which can push the emitted hex the "wrong" way.
 * Bisecting in the reals and rounding afterwards can therefore land on a tread
 * that fails (that threw for ~0.1% of hexes: #e1be89, #4f5a63, #ab92c6, ...).
 * Bisecting on the lattice cannot: every candidate examined is an exact
 * emittable lightness and the answer returned is one that was tested, never
 * rounded after the fact. If the bound tread itself fails, scan a bounded
 * number of lattice steps inward from it before giving up.
 */
function bisectLattice(
  startL: number,
  boundL: number,
  passes: (l: number) => boolean,
): number | null {
  const start = Math.round(startL * MICRO)
  if (passes(start / MICRO)) return start / MICRO

  const boundMicro = Math.round(boundL * MICRO)
  const inward = Math.sign(start - boundMicro)
  if (inward === 0) return null

  let hi = boundMicro // must pass
  if (!passes(hi / MICRO)) {
    let found: number | null = null
    for (let k = 1; k <= 50; k++) {
      const candidate = boundMicro + inward * k
      if (passes(candidate / MICRO)) {
        found = candidate
        break
      }
    }
    if (found === null) return null
    hi = found
  }

  let lo = start // known to fail
  while (Math.abs(hi - lo) > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (passes(mid / MICRO)) hi = mid
    else lo = mid
  }
  return hi / MICRO
}

/**
 * Move colour.l away from the given backgrounds (darker in light mode, lighter
 * in dark mode) by lattice bisection until WCAG and APCA thresholds hold
 * against every background. Throws if no lattice value out to the extreme
 * bound can satisfy — a generator bug, not a data condition.
 */
export function solveTextLightness(
  colour: Oklch,
  backgrounds: string[],
  mode: Mode,
  minWcag: number,
  minApcaAbs: number,
): Oklch {
  const bound = mode === 'light' ? 0.05 : 0.985
  const passes = (l: number): boolean => {
    const hex = oklchToHex(clampToSrgb({ ...colour, l }))
    return backgrounds.every(
      (bg) => wcagRatio(hex, bg) >= minWcag && Math.abs(apcaLc(hex, bg)) >= minApcaAbs,
    )
  }
  const solved = bisectLattice(colour.l, bound, passes)
  if (solved === null) {
    throw new Error(
      `solveTextLightness: unsatisfiable at bound ${bound} for ${JSON.stringify(colour)}`,
    )
  }
  return { ...colour, l: solved }
}

const DARK_TEXT: Oklch = { l: 0.22, c: 0, h: 0 }
const WHITE = '#ffffff'

/** Near-black, faintly tinted toward the seed hue — the dark on-solid candidate. */
const darkOnSolidBase = (seed: Oklch): Oklch => ({
  ...DARK_TEXT,
  c: Math.min(0.03, seed.c * 0.2),
  h: seed.h,
})

/**
 * Choose the on-solid text colour for `backgrounds` (step 9, plus step 10 in
 * the rare re-solve). White and a dark tinted candidate compete; whichever
 * clears 4.5:1 with the higher ratio wins. When *neither* clears it, the dark
 * candidate is solved down the lattice toward L 0.05 until it does — a
 * background light enough to defeat white is always legible under near-black,
 * so one side or the other always clears. Throws only if truly unsatisfiable.
 */
function solveOnSolid(seed: Oklch, backgrounds: string[]): string {
  const worst = (hex: string): number => Math.min(...backgrounds.map((bg) => wcagRatio(hex, bg)))
  const base = darkOnSolidBase(seed)
  let darkHex = oklchToHex(clampToSrgb(base))

  if (Math.max(worst(WHITE), worst(darkHex)) < 4.5) {
    const solvedL = bisectLattice(base.l, 0.05, (l) =>
      worst(oklchToHex(clampToSrgb({ ...base, l }))) >= 4.5,
    )
    if (solvedL !== null) darkHex = oklchToHex(clampToSrgb({ ...base, l: solvedL }))
  }

  const passing = [WHITE, darkHex].filter((hex) => worst(hex) >= 4.5)
  if (passing.length === 0) {
    throw new Error(
      `solveOnSolid: no on-solid text colour clears 4.5:1 against ${backgrounds.join(', ')}`,
    )
  }
  return passing.reduce((a, b) => (worst(a) >= worst(b) ? a : b))
}

/**
 * `ringBackgrounds` are extra fills the step-8 focus ring must also clear 3:1
 * on. The theme passes the brand ramp the neutral surfaces (steps 1-3: canvas,
 * surface, raised) and the status ramps' subtle fills (step 3), because the
 * focus ring is drawn on all of them and they belong to other ramps, so the
 * ramp itself cannot see them.
 */
export function generateRamp(seed: Oklch, mode: Mode, ringBackgrounds: string[] = []): Ramp {
  const anchored = clampToSrgb(seed)
  const steps: RampStep[] = []

  // Steps 1–8 come straight off the fixed curve (7–8 are re-solved below).
  for (let i = 0; i < 8; i++) {
    const cap = C_ABS_CAP[i]
    const c = round6(Math.min(seed.c * C_CURVE[i]!, cap ?? Infinity))
    steps.push(toBgStep({ l: L_TARGETS[mode][i]!, c, h: seed.h }))
  }

  steps.push(toStep(seed)) // step 9: the seed itself (P3 kept if richer)

  // Ruling F: the on-solid text colour is chosen BEFORE the hover step, because
  // the hover step must move *away* from it in both modes. Moving away can only
  // raise the text/background ratio, so text on hover is never less legible
  // than text on the solid — which the old fixed "darker in light, lighter in
  // dark" rule could not promise (a light solid with dark text only got lighter).
  let onSolid = solveOnSolid(seed, [steps[8]!.hex])
  const away = onSolid === WHITE ? -1 : 1 // white text ⇒ darken; dark text ⇒ lighten

  const hoverAt = (delta: number): number =>
    round6(Math.min(HOVER_L_MAX, Math.max(HOVER_L_MIN, anchored.l + away * delta)))

  let hoverL = hoverAt(HOVER_L_DELTA)
  steps.push(toStep({ l: hoverL, c: seed.c, h: seed.h })) // step 10: hover
  // Safety net: push further away in 0.01 steps if the ratio somehow still
  // fails — only reachable when the [0.1, 0.95] rail truncated the first move.
  for (let k = 1; k <= 6 && wcagRatio(onSolid, steps[9]!.hex) < 4.5; k++) {
    hoverL = hoverAt(HOVER_L_DELTA + k * 0.01)
    steps[9] = toStep({ l: hoverL, c: seed.c, h: seed.h })
  }
  if (wcagRatio(onSolid, steps[9]!.hex) < 4.5) {
    // Pinned against the rail — re-solve the text colour against both surfaces.
    onSolid = solveOnSolid(seed, [steps[8]!.hex, steps[9]!.hex])
  }

  const past = (l: number, prev: number): number =>
    round6(mode === 'light' ? Math.min(l, prev - 0.02) : Math.max(l, prev + 0.02))

  // Contrast-solve step 7 (border) and step 8 (focus-ring anchor) against
  // steps 1–2 — these are Tier 2's non-text pairings (WCAG 3 / APCA 45).
  // Unlike step 9/10, the curve alone doesn't guarantee the threshold, so
  // steps 7/8 get the same bisection treatment as steps 11/12 below.
  const borderBgs = [steps[0]!.hex, steps[1]!.hex]
  const base7: Oklch = {
    l: past(L_TARGETS[mode][6]!, L_TARGETS[mode][5]!),
    c: round6(seed.c * C_CURVE[6]!),
    h: seed.h,
  }
  const solved7 = solveTextLightness(base7, borderBgs, mode, 3, 45)
  const base8: Oklch = {
    l: past(L_TARGETS[mode][7]!, solved7.l),
    c: round6(seed.c * C_CURVE[7]!),
    h: seed.h,
  }
  const solved8 = solveTextLightness(base8, [...borderBgs, ...ringBackgrounds], mode, 3, 45)
  steps[6] = toBgStep(solved7)
  steps[7] = toBgStep(solved8)

  // Contrast-solve the text steps against steps 1–3 (step 11 is also used on
  // bg-subtle = step 3 by the Tier 2 map, so it must hold there too).
  // Step 10 can now sit on either side of step 9, so step 11 starts past the
  // extreme of the pair — that keeps 10 → 11 → 12 monotonic whichever way the
  // hover step went.
  const textAnchor =
    mode === 'light' ? Math.min(anchored.l, hoverL) : Math.max(anchored.l, hoverL)
  const bgs = [steps[0]!.hex, steps[1]!.hex, steps[2]!.hex]
  const base11: Oklch = {
    l: past(L_TARGETS[mode][10]!, textAnchor),
    c: round6(seed.c * C_CURVE[10]!),
    h: seed.h,
  }
  const solved11 = solveTextLightness(base11, bgs, mode, 4.5, 75)
  const base12: Oklch = {
    l: past(L_TARGETS[mode][11]!, solved11.l),
    c: round6(seed.c * C_CURVE[11]!),
    h: seed.h,
  }
  steps.push(toStep(solved11)) // step 11
  steps.push(toStep(solveTextLightness(base12, bgs, mode, 7, 90))) // step 12

  return { steps, onSolid }
}
