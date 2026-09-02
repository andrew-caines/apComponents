export type DurationToken = 'instant' | 'fast' | 'base' | 'slow' | 'slower'
export type EaseToken = 'out' | 'in' | 'in-out' | 'linear'

/** How a motion degrades under `prefers-reduced-motion: reduce`. */
export type ReducedBehaviour = 'opacity' | 'none'

/**
 * One keyframe stop. `at` is a 0–1 offset. Every step of a given motion MUST
 * declare the same set of animatable properties (all keys except `at`) — this
 * is enforced by the "declares the same set of animatable properties at every
 * step, so the CSS and JS emitters cannot diverge" test in motions.test.ts.
 *
 * Sparse steps (a property present at some steps but not others) are outlawed
 * rather than reconciled: emitCss.ts relies on native CSS keyframe
 * interpolation across the properties a step declares, while emitVariants.ts
 * reads each step's value directly. A sparse step would make the CSS emitter
 * interpolate smoothly across the gap while the JS emitter froze the last
 * value and then jumped — the same input producing two different animations.
 * If a genuinely sparse motion is ever needed, pick a carry-forward semantics
 * deliberately and change both emitters together; don't just drop a property.
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

/**
 * A Motion-compatible variant. Shaped for `motion/react`'s keyframes +
 * transition convention, but typed by us — this package does not depend on
 * Motion, and nothing in Phase 3 imports it.
 */
export interface MotionVariant {
  keyframes: Record<string, (string | number)[]>
  transition: {
    /** Seconds, per Motion's convention. */
    duration: number
    ease: number[] | 'linear'
    times: number[]
    /** ADDITIONAL plays beyond the first, per Motion's convention. */
    repeat: number
  }
}
