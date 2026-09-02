import type { MotionSpec } from './types.js'

/**
 * Freezes `value` and everything reachable from it, in place.
 *
 * `Object.freeze` is shallow. Frozen only at the top, `MOTIONS` still let
 * `MOTIONS['error.shake'].steps[1].translateX = '-99px'` through silently,
 * and `steps.push(...)` grow the array — mutating the single record BOTH
 * emitters read, so a consumer could change what every later emission
 * produces. `as const` rules that out for TypeScript callers only; `MOTIONS`
 * is publicly exported and reaches JavaScript ones too.
 *
 * `packages/tokens/src/scales/scales.ts` sets the precedent (its `TEXT` entries are
 * frozen individually for exactly this reason); a recursive helper is used
 * here because the nesting is three deep across twelve motions.
 *
 * The `isFrozen` early return doubles as the cycle guard: each object is
 * frozen before its children are visited, so a cycle's back-edge stops.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
  return value
}

/**
 * The twelve named semantic motions (ADR-0010). This record is the single
 * source of truth: both the CSS and the JavaScript emissions derive from it,
 * which is what keeps them from drifting.
 *
 * `duration` and `ease` are token names, resolved against @ap/tokens' scales.
 */
export const MOTIONS = deepFreeze({
  'error.shake': {
    duration: 'slow', ease: 'in-out', iterations: 1, reduced: 'none',
    steps: [
      { at: 0, translateX: '0px' },
      { at: 0.167, translateX: '-4px' },
      { at: 0.333, translateX: '4px' },
      { at: 0.5, translateX: '-4px' },
      { at: 0.667, translateX: '4px' },
      { at: 0.833, translateX: '-4px' },
      { at: 1, translateX: '0px' },
    ],
  },
  // Finite by construction. ADR-0010: perpetual motion is a vestibular hazard.
  'warning.pulse': {
    duration: 'slow', ease: 'in-out', iterations: 2, reduced: 'none',
    steps: [
      { at: 0, scale: 1 },
      { at: 0.5, scale: 1.04 },
      { at: 1, scale: 1 },
    ],
  },
  'success.check': {
    duration: 'slower', ease: 'out', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, strokeDashoffset: 1, scale: 0.9, opacity: 0 },
      { at: 0.6, strokeDashoffset: 0, scale: 1.06, opacity: 1 },
      { at: 1, strokeDashoffset: 0, scale: 1, opacity: 1 },
    ],
  },
  'enter.fade-rise': {
    duration: 'base', ease: 'out', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, opacity: 0, translateY: '8px' },
      { at: 1, opacity: 1, translateY: '0px' },
    ],
  },
  'exit.fade': {
    duration: 'fast', ease: 'in', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, opacity: 1 },
      { at: 1, opacity: 0 },
    ],
  },
  // `--panel-height` is supplied by Base UI's primitives, which arrive in
  // Phase 4. Until then these two emit correctly but cannot be demonstrated.
  collapse: {
    duration: 'fast', ease: 'in', iterations: 1, reduced: 'none',
    steps: [
      { at: 0, height: 'var(--panel-height)' },
      { at: 1, height: '0px' },
    ],
  },
  expand: {
    duration: 'base', ease: 'out', iterations: 1, reduced: 'none',
    steps: [
      { at: 0, height: '0px' },
      { at: 1, height: 'var(--panel-height)' },
    ],
  },
  'toast.slide-in': {
    duration: 'base', ease: 'out', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, translateX: '100%', opacity: 0 },
      { at: 1, translateX: '0px', opacity: 1 },
    ],
  },
  'toast.slide-out': {
    duration: 'fast', ease: 'in', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, translateX: '0px', opacity: 1 },
      { at: 1, translateX: '100%', opacity: 0 },
    ],
  },
  'skeleton.shimmer': {
    duration: 'slower', ease: 'linear', iterations: 'infinite', reduced: 'none',
    steps: [
      { at: 0, translateX: '-100%' },
      { at: 1, translateX: '100%' },
    ],
  },
  'spinner.rotate': {
    duration: 'slower', ease: 'linear', iterations: 'infinite', reduced: 'none',
    steps: [
      { at: 0, rotate: '0deg' },
      { at: 1, rotate: '360deg' },
    ],
  },
  'attention.nudge': {
    duration: 'fast', ease: 'out', iterations: 1, reduced: 'none',
    steps: [
      { at: 0, translateX: '0px' },
      { at: 0.5, translateX: '6px' },
      { at: 1, translateX: '0px' },
    ],
  },
} as const satisfies Readonly<Record<string, MotionSpec>>)

export type MotionName = keyof typeof MOTIONS
