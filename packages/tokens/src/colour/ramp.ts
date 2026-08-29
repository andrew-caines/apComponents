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

const HOVER_L_DELTA = 0.04 // step 10: darker in light mode, lighter in dark

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

/**
 * Move colour.l away from the given backgrounds (darker in light mode,
 * lighter in dark mode) by bisection until WCAG and APCA thresholds hold
 * against every background. Throws if the extreme bound cannot satisfy —
 * a generator bug, not a data condition.
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
  if (passes(colour.l)) return colour
  if (!passes(bound)) {
    throw new Error(
      `solveTextLightness: unsatisfiable at bound ${bound} for ${JSON.stringify(colour)}`,
    )
  }
  let lo = colour.l // fails
  let hi = bound // passes
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (passes(mid)) hi = mid
    else lo = mid
  }
  return { ...colour, l: round6(hi) }
}

const DARK_TEXT: Oklch = { l: 0.22, c: 0, h: 0 }

export function generateRamp(seed: Oklch, mode: Mode): Ramp {
  const anchored = clampToSrgb(seed)
  const steps: RampStep[] = []

  const hoverL = round6(
    mode === 'light'
      ? Math.max(0.1, anchored.l - HOVER_L_DELTA)
      : Math.min(0.95, anchored.l + HOVER_L_DELTA),
  )

  for (let i = 0; i < 12; i++) {
    if (i === 8) {
      steps.push(toStep(seed)) // step 9: the seed itself (P3 kept if richer)
      continue
    }
    if (i === 9) {
      steps.push(toStep({ l: hoverL, c: seed.c, h: seed.h })) // step 10: hover
      continue
    }
    const cap = C_ABS_CAP[i]
    const c = round6(Math.min(seed.c * C_CURVE[i]!, cap ?? Infinity))
    steps.push(toBgStep({ l: L_TARGETS[mode][i]!, c, h: seed.h }))
  }

  // Contrast-solve the text steps against steps 1–3 (step 11 is also used on
  // bg-subtle = step 3 by the Tier 2 map, so it must hold there too).
  // Start L is clamped past step 10 / step 11 so monotonic order survives a
  // seed whose own L sits between the fixed targets.
  const bgs = [steps[0]!.hex, steps[1]!.hex, steps[2]!.hex]
  const past = (l: number, prev: number): number =>
    round6(mode === 'light' ? Math.min(l, prev - 0.02) : Math.max(l, prev + 0.02))
  const base11: Oklch = {
    l: past(L_TARGETS[mode][10]!, hoverL),
    c: round6(seed.c * C_CURVE[10]!),
    h: seed.h,
  }
  const solved11 = solveTextLightness(base11, bgs, mode, 4.5, 75)
  const base12: Oklch = {
    l: past(L_TARGETS[mode][11]!, solved11.l),
    c: round6(seed.c * C_CURVE[11]!),
    h: seed.h,
  }
  steps[10] = toStep(solved11)
  steps[11] = toStep(solveTextLightness(base12, bgs, mode, 7, 90))

  // onSolid: white or dark tinted text on step 9, whichever contrasts better.
  const solid = steps[8]!.hex
  const darkCandidate = oklchToHex(
    clampToSrgb({ ...DARK_TEXT, c: Math.min(0.03, seed.c * 0.2), h: seed.h }),
  )
  const onSolid =
    wcagRatio('#ffffff', solid) >= wcagRatio(darkCandidate, solid) ? '#ffffff' : darkCandidate

  return { steps, onSolid }
}
