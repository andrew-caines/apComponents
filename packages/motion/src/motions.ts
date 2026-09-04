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
 * here because the nesting is three deep across fourteen motions.
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
 * The fourteen named semantic motions (ADR-0010). This record is the single
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
  // The bottom-sheet pair. ADR-0017 makes Dialog present as a sheet below the
  // `sm` breakpoint and names `enter.slide-up` for it; the token did not exist
  // until Phase 4d went looking for it.
  //
  // A sheet travels its own height, so the offset is `100%` rather than a fixed
  // step — `8px` on a full-height surface would read as a twitch, not an
  // entrance. Both carry an opacity track, which `reduced: 'opacity'` requires
  // and which also softens the edge of a surface sliding past the viewport
  // boundary at full motion.
  'enter.slide-up': {
    duration: 'base', ease: 'out', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, translateY: '100%', opacity: 0 },
      { at: 1, translateY: '0px', opacity: 1 },
    ],
  },
  // Faster and accelerating, per this ADR's entrance/exit asymmetry: users wait
  // for entrances but not for exits, so a slow exit reads as lag.
  'exit.slide-down': {
    duration: 'fast', ease: 'in', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, translateY: '0px', opacity: 1 },
      { at: 1, translateY: '100%', opacity: 0 },
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
  // `reduced: 'opacity'`, not 'none'. A spinner is the one motion where the
  // movement IS the information, so degrading it to nothing leaves a
  // reduced-motion user looking at a static glyph with no indication that
  // anything is happening at all. Rotation is a vestibular trigger; an opacity
  // fade is not — so this keeps the state perceivable without the property
  // that causes harm.
  //
  // The opacity track is therefore not decoration: a reduced variant is the
  // opacity SUBSET of these same keyframes (see emitCss.ts), so a spinner with
  // no opacity to degrade to degrades to nothing. `motions.test.ts` enforces
  // exactly that pairing. At full motion this reads as a gentle breath under
  // the rotation; under reduce the breath is all that remains, and it is
  // enough to say "still working".
  'spinner.rotate': {
    duration: 'slower', ease: 'linear', iterations: 'infinite', reduced: 'opacity',
    steps: [
      { at: 0, rotate: '0deg', opacity: 1 },
      { at: 0.5, rotate: '180deg', opacity: 0.4 },
      { at: 1, rotate: '360deg', opacity: 1 },
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
