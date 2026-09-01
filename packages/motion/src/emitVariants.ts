import { DURATION, EASE } from '@ap/tokens'
import { MOTIONS } from './motions.js'
import type { MotionSpec, MotionVariant, Step } from './types.js'

/** Our step property names → Motion's keyframe keys. */
const KEY_MAP: Record<string, string> = {
  opacity: 'opacity',
  translateX: 'x',
  translateY: 'y',
  scale: 'scale',
  rotate: 'rotate',
  height: 'height',
  strokeDashoffset: 'strokeDashoffset',
}

/** '320ms' → 0.32. Motion expresses duration in seconds. */
function seconds(token: string): number {
  const raw = DURATION[token]
  if (raw === undefined) throw new Error(`Duration token '${token}' is not in the DURATION scale.`)
  const m = /^(\d+(?:\.\d+)?)ms$/.exec(raw)
  if (!m) throw new Error(`Duration token '${token}' is not a millisecond value: ${raw}`)
  return Number(m[1]) / 1000
}

/** 'cubic-bezier(0.16, 1, 0.30, 1)' → [0.16, 1, 0.3, 1]; 'linear' → 'linear'. */
function ease(token: string): number[] | 'linear' {
  const value = EASE[token]
  if (value === undefined) throw new Error(`Easing token '${token}' is not in the EASE scale.`)
  if (value === 'linear') return 'linear'
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(value)
  if (!m) throw new Error(`Easing token '${token}' is not a cubic-bezier: ${value}`)
  const points = m[1]!.split(',').map((n) => Number(n.trim()))
  if (points.length !== 4 || points.some((n) => Number.isNaN(n))) {
    throw new Error(`Easing token '${token}' did not parse to four control points: ${value}`)
  }
  return points
}

/**
 * Motion needs one value per step for every animated property, but a step may
 * omit a property it does not change. The previous value is carried forward;
 * for a leading gap the first defined value is carried backward, so the
 * property starts where it will first be set rather than jumping.
 */
function track(steps: readonly Step[], prop: keyof Step): (string | number)[] {
  const raw = steps.map((s) => s[prop] as string | number | undefined)
  const firstDefined = raw.find((x) => x !== undefined)!
  const out: (string | number)[] = []
  let carried: string | number = firstDefined
  for (const value of raw) {
    if (value !== undefined) carried = value
    out.push(carried)
  }
  return out
}

function variant(spec: MotionSpec): MotionVariant {
  const animated = new Set<string>()
  for (const step of spec.steps) {
    for (const key of Object.keys(step)) {
      if (key !== 'at' && step[key as keyof Step] !== undefined) animated.add(key)
    }
  }

  const keyframes: Record<string, (string | number)[]> = {}
  for (const prop of animated) {
    keyframes[KEY_MAP[prop] ?? prop] = track(spec.steps, prop as keyof Step)
  }

  return {
    keyframes,
    transition: {
      duration: seconds(spec.duration),
      ease: ease(spec.ease),
      times: spec.steps.map((s) => s.at),
      // Motion's `repeat` counts additional plays: repeat 0 plays once, so a
      // 2-iteration motion is repeat 1.
      repeat: spec.iterations === 'infinite' ? Infinity : spec.iterations - 1,
    },
  }
}

export function toMotionVariants(
  motions: Readonly<Record<string, MotionSpec>> = MOTIONS,
): Record<string, MotionVariant> {
  return Object.fromEntries(Object.entries(motions).map(([n, s]) => [n, variant(s)]))
}
