import { DURATION, EASE } from '@ap/tokens'
import { MOTIONS } from './motions.js'
import type { MotionSpec, MotionVariant, Step } from './types.js'

/**
 * Our step property names → Motion's keyframe keys. Only properties whose
 * Motion key differs from our own need an entry — lookups fall back to the
 * raw property name (see `KEY_MAP[prop] ?? prop` below).
 */
const KEY_MAP: Record<string, string> = {
  translateX: 'x',
  translateY: 'y',
}

/**
 * '320ms' → 0.32. Motion expresses duration in seconds.
 *
 * `scale` defaults to the real DURATION scale and exists only so tests can
 * exercise the error paths with a throwaway scale, without mutating the
 * frozen singleton every other consumer shares.
 */
export function seconds(token: string, scale: Record<string, string> = DURATION): number {
  const raw = scale[token]
  if (raw === undefined) throw new Error(`Duration token '${token}' is not in the DURATION scale.`)
  const m = /^(\d+(?:\.\d+)?)ms$/.exec(raw)
  if (!m) throw new Error(`Duration token '${token}' is not a millisecond value: ${raw}`)
  return Number(m[1]) / 1000
}

/**
 * 'cubic-bezier(0.16, 1, 0.30, 1)' → [0.16, 1, 0.3, 1]; 'linear' → 'linear'.
 *
 * `scale` defaults to the real EASE scale, for the same reason as `seconds`.
 */
export function ease(token: string, scale: Record<string, string> = EASE): number[] | 'linear' {
  const value = scale[token]
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

function variant(name: string, spec: MotionSpec): MotionVariant {
  const animated = new Set<string>()
  for (const step of spec.steps) {
    for (const key of Object.keys(step)) {
      if (key !== 'at' && step[key as keyof Step] !== undefined) animated.add(key)
    }
  }

  const keyframes: Record<string, (string | number)[]> = {}
  for (const prop of animated) {
    keyframes[KEY_MAP[prop] ?? prop] = spec.steps.map((step, i) => {
      const value = step[prop as keyof Step] as string | number | undefined
      // Unreachable given the "same properties at every step" invariant
      // enforced in motions.test.ts — this is defence in depth. It must never
      // silently emit a wrong keyframe array by falling back to some default.
      if (value === undefined) {
        throw new Error(
          `Motion '${name}' step ${i} does not declare '${prop}', but another step of ` +
            `this motion does. Every step of a motion must declare the same properties.`,
        )
      }
      return value
    })
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
  return Object.fromEntries(Object.entries(motions).map(([n, s]) => [n, variant(n, s)]))
}
