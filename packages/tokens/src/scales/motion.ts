// Motion primitives (ADR-0010). Frozen at declaration for the same reason as
// every other scale in scales.ts: these singletons are handed straight out on
// `theme.scales`, so a consumer mutating one would change every later theme.

export const DURATION = Object.freeze({
  instant: '0ms',
  fast: '120ms',
  base: '200ms',
  slow: '320ms',
  slower: '480ms',
} as Record<string, string>)

// Entrances decelerate (`out`) and take longer; exits accelerate (`in`) and are
// shorter — users wait for entrances but not for exits, so a slow exit reads as
// lag. `linear` exists for the two infinite motions: any eased curve visibly
// stutters at a loop boundary, because a continuous loop has no start or end
// to shape.
export const EASE = Object.freeze({
  out: 'cubic-bezier(0.16, 1, 0.30, 1)',
  in: 'cubic-bezier(0.70, 0, 0.84, 0)',
  'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
  linear: 'linear',
} as Record<string, string>)

/**
 * The duration every non-zero duration collapses to under
 * `prefers-reduced-motion: reduce`.
 *
 * 1ms rather than 0ms, deliberately: a zero-length animation may never fire
 * `transitionend`/`animationend`, which would strand any component that
 * unmounts or advances state on that event — a dialog that closes on animation
 * end would hang open forever for a reduced-motion user. 1ms is imperceptible
 * and still fires the event.
 */
export const REDUCED_MOTION_DURATION = '1ms'
