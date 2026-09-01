export type DurationToken = 'instant' | 'fast' | 'base' | 'slow' | 'slower'
export type EaseToken = 'out' | 'in' | 'in-out' | 'linear'

/** How a motion degrades under `prefers-reduced-motion: reduce`. */
export type ReducedBehaviour = 'opacity' | 'none'

/**
 * One keyframe stop. `at` is a 0–1 offset. Properties left undefined are not
 * animated at that stop; the emitters carry the previous value forward.
 */
export interface Step {
  at: number
  opacity?: number
  translateX?: string
  translateY?: string
  scale?: number
  rotate?: string
  height?: string
  strokeDashoffset?: number
}

export interface MotionSpec {
  /** A token name, never a value — so a motion cannot drift from the scale. */
  duration: DurationToken
  ease: EaseToken
  steps: readonly Step[]
  /** Finite count, or 'infinite' where the movement IS the information. */
  iterations: number | 'infinite'
  reduced: ReducedBehaviour
}
