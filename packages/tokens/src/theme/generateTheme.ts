import type { Mode } from '../colour/types.js'
import { hexToOklch, normalizeHex } from '../colour/oklch.js'
import { deriveSeeds } from '../colour/semantics.js'
import { generateRamp, type Ramp } from '../colour/ramp.js'
import { resolveFont, type FallbackMetrics, type ResolvedFont } from '../typography/fonts.js'
import { ELEVATION, ICON, MISC, RADIUS, SPACE, TEXT, Z } from '../scales/scales.js'
import { DURATION, EASE } from '../scales/motion.js'
import { breakpoints } from '../breakpoints.js'
import { SEMANTIC_MAP, type SemanticEntry } from './semanticMap.js'

export type RampName = 'brand' | 'neutral' | 'danger' | 'warning' | 'success' | 'info'

export interface ThemeSeed {
  brand: string
  font?: { family: string; metrics?: FallbackMetrics }
}

export interface Theme {
  seed: { brand: string }
  font: ResolvedFont
  ramps: Record<Mode, Record<RampName, Ramp>>
  semantic: readonly SemanticEntry[]
  scales: Readonly<{
    space: typeof SPACE
    text: typeof TEXT
    radius: typeof RADIUS
    icon: typeof ICON
    elevation: typeof ELEVATION
    z: typeof Z
    misc: typeof MISC
    duration: typeof DURATION
    ease: typeof EASE
  }>
  breakpoints: typeof breakpoints
}

export function generateTheme(seed: ThemeSeed): Theme {
  // Canonical seed form: lowercase six-digit hex, `#rgb` shorthand expanded.
  const brandHex = normalizeHex(seed.brand)
  const brand = hexToOklch(brandHex)
  const seeds = { brand, ...deriveSeeds(brand) }

  const modeRamps = (mode: Mode): Record<RampName, Ramp> => {
    const danger = generateRamp(seeds.danger, mode)
    const warning = generateRamp(seeds.warning, mode)
    const success = generateRamp(seeds.success, mode)
    const info = generateRamp(seeds.info, mode)
    const neutral = generateRamp(seeds.neutral, mode)
    // The brand focus ring (step 8) is drawn on bg-canvas, bg-surface and
    // bg-raised (neutral steps 1-3) and on each status ramp's subtle fill
    // (step 3). Those belong to other ramps, so the brand ramp is handed them
    // and solves its ring against every one: 3:1 by construction, not by the
    // brand's own steps 1-2 happening to match the neutral surfaces.
    const ringBackgrounds = [
      ...[danger, warning, success, info].map((r) => r.steps[2]!.hex),
      ...neutral.steps.slice(0, 3).map((s) => s.hex),
    ]
    return {
      brand: generateRamp(seeds.brand, mode, ringBackgrounds),
      neutral,
      danger,
      warning,
      success,
      info,
    }
  }

  return {
    seed: { brand: brandHex },
    font: resolveFont(seed.font),
    ramps: { light: modeRamps('light'), dark: modeRamps('dark') },
    semantic: SEMANTIC_MAP,
    scales: Object.freeze({
      space: SPACE, text: TEXT, radius: RADIUS, icon: ICON, elevation: ELEVATION, z: Z, misc: MISC,
      duration: DURATION, ease: EASE,
    }),
    breakpoints,
  }
}

export function resolveSemantic(theme: Theme, mode: Mode, token: string): string {
  const entry = theme.semantic.find((e) => e.token === token)
  if (!entry) throw new Error(`Unknown semantic token: ${token}`)
  const ramp = theme.ramps[mode][entry.ramp]
  return entry.step === 'onSolid' ? ramp.onSolid : ramp.steps[entry.step - 1]!.hex
}
