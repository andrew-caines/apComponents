import type { Oklch } from './types.js'
import { round6 } from './oklch.js'

export const NEUTRAL_CHROMA = 0.008

export const SEMANTIC_BASES = {
  danger: { l: 0.55, c: 0.19, h: 25 },
  warning: { l: 0.77, c: 0.16, h: 80 },
  success: { l: 0.53, c: 0.15, h: 145 },
  info: { l: 0.55, c: 0.14, h: 250 },
} as const satisfies Record<string, Oklch>

/** Move `base` toward `toward` along the shortest arc, by at most maxDegrees. */
export function nudgeHue(base: number, toward: number, maxDegrees = 10): number {
  let delta = ((toward - base + 540) % 360) - 180 // shortest signed arc
  delta = Math.max(-maxDegrees, Math.min(maxDegrees, delta))
  return round6((base + delta + 360) % 360)
}

export function deriveSeeds(brand: Oklch): {
  neutral: Oklch
  danger: Oklch
  warning: Oklch
  success: Oklch
  info: Oklch
} {
  const nudged = (base: Oklch): Oklch => ({ ...base, h: nudgeHue(base.h, brand.h) })
  return {
    neutral: { l: brand.l, c: NEUTRAL_CHROMA, h: brand.h },
    danger: nudged(SEMANTIC_BASES.danger),
    warning: nudged(SEMANTIC_BASES.warning),
    success: nudged(SEMANTIC_BASES.success),
    info: nudged(SEMANTIC_BASES.info),
  }
}
