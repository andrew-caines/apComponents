import type { Oklch } from './types.js'
import { round6 } from './oklch.js'

export const NEUTRAL_CHROMA = 0.008

/**
 * Minimum hue separation, in degrees, between the brand and any status ramp.
 *
 * Without a floor the harmony nudge below is free to walk a status straight
 * into the brand. It did: the default blue brand sits at h=264 and info's base
 * is 250, so the nudge closed 14.2° to 4.2° and `action-bg-subtle` came out
 * #e9f0ff against `info-bg-subtle` #e8f1ff — 1.00:1, ΔE 0.006, the same colour
 * to any eye. This is not specific to one seed: the brand is product-supplied,
 * so a red brand collides with danger the same way.
 *
 * Enforced by construction here and asserted across the seed sweep in gate 4.
 */
export const MIN_BRAND_HUE_SEPARATION = 35

/**
 * When a status has to be pushed off the brand, both sides of it are legal.
 * We take the side the base already sits on, so the status keeps its identity
 * — info stays on the cyan side of blue rather than flipping to violet — and
 * cross to the far side only when the near one would land within this many
 * degrees of another status's base. Identity first, collision as the tie-break:
 * picking by "farthest from everything else" instead sends info to 299° violet
 * for the default brand, winning by 2° of clearance and losing the meaning.
 */
export const STATUS_TIE_BREAK_SEPARATION = 25

export const SEMANTIC_BASES = {
  danger: { l: 0.55, c: 0.19, h: 25 },
  warning: { l: 0.77, c: 0.16, h: 80 },
  success: { l: 0.53, c: 0.15, h: 145 },
  info: { l: 0.55, c: 0.14, h: 250 },
} as const satisfies Record<string, Oklch>

const STATUS_NAMES = ['danger', 'warning', 'success', 'info'] as const
type StatusName = (typeof STATUS_NAMES)[number]

/** Shortest signed arc from `a` to `b`, in (−180, 180]. */
function arc(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180
}

/** Absolute hue distance along the shortest arc. */
export function hueSeparation(a: number, b: number): number {
  return Math.abs(arc(a, b))
}

/** Move `base` toward `toward` along the shortest arc, by at most maxDegrees. */
export function nudgeHue(base: number, toward: number, maxDegrees = 10): number {
  let delta = arc(base, toward)
  delta = Math.max(-maxDegrees, Math.min(maxDegrees, delta))
  return round6((base + delta + 360) % 360)
}

/**
 * The harmony nudge, floored so it can never bring a status within
 * MIN_BRAND_HUE_SEPARATION of the brand.
 */
export function statusHue(base: number, brandHue: number, otherBases: number[]): number {
  const nudged = nudgeHue(base, brandHue)
  if (hueSeparation(nudged, brandHue) >= MIN_BRAND_HUE_SEPARATION) return nudged

  const side = arc(brandHue, base) >= 0 ? 1 : -1
  const near = round6((brandHue + side * MIN_BRAND_HUE_SEPARATION + 360) % 360)
  const far = round6((brandHue - side * MIN_BRAND_HUE_SEPARATION + 360) % 360)
  const clearance = Math.min(...otherBases.map((o) => hueSeparation(near, o)))
  return clearance >= STATUS_TIE_BREAK_SEPARATION ? near : far
}

export function deriveSeeds(brand: Oklch): Record<'neutral' | StatusName, Oklch> {
  const hueFor = (name: StatusName): number =>
    statusHue(
      SEMANTIC_BASES[name].h,
      brand.h,
      STATUS_NAMES.filter((o) => o !== name).map((o) => SEMANTIC_BASES[o].h),
    )
  return {
    neutral: { l: brand.l, c: NEUTRAL_CHROMA, h: brand.h },
    danger: { ...SEMANTIC_BASES.danger, h: hueFor('danger') },
    warning: { ...SEMANTIC_BASES.warning, h: hueFor('warning') },
    success: { ...SEMANTIC_BASES.success, h: hueFor('success') },
    info: { ...SEMANTIC_BASES.info, h: hueFor('info') },
  }
}
