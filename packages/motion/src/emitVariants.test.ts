import { describe, expect, it } from 'vitest'
import { toMotionVariants } from './emitVariants.js'

const v = toMotionVariants()

describe('toMotionVariants', () => {
  it('emits a variant for every motion', () => {
    expect(Object.keys(v)).toHaveLength(12)
  })

  it('resolves duration tokens to seconds', () => {
    // Motion expresses duration in seconds; our scale is in milliseconds.
    expect(v['error.shake']!.transition.duration).toBe(0.32)
    expect(v['exit.fade']!.transition.duration).toBe(0.12)
  })

  it('resolves easing tokens to cubic-bezier control points', () => {
    expect(v['enter.fade-rise']!.transition.ease).toEqual([0.16, 1, 0.3, 1])
  })

  it('passes linear through as a keyword', () => {
    expect(v['spinner.rotate']!.transition.ease).toBe('linear')
  })

  it('converts iteration count to Motion repeat semantics', () => {
    // Motion's `repeat` counts ADDITIONAL plays: repeat 0 plays once.
    expect(v['error.shake']!.transition.repeat).toBe(0)
    expect(v['warning.pulse']!.transition.repeat).toBe(1)
    expect(v['spinner.rotate']!.transition.repeat).toBe(Infinity)
  })

  it('carries step offsets through as times', () => {
    expect(v['attention.nudge']!.transition.times).toEqual([0, 0.5, 1])
  })

  it('maps translate to Motion x and y keys', () => {
    expect(v['enter.fade-rise']!.keyframes['y']).toEqual(['8px', '0px'])
    expect(v['toast.slide-in']!.keyframes['x']).toEqual(['100%', '0px'])
  })

  it('carries a value forward when a step omits a property', () => {
    // success.check's opacity reaches 1 at 0.6 and is unchanged at 1.
    expect(v['success.check']!.keyframes['opacity']).toEqual([0, 1, 1])
  })

  it('emits arrays of equal length to times, for every property', () => {
    for (const [name, variant] of Object.entries(v)) {
      const n = variant.transition.times.length
      for (const [prop, values] of Object.entries(variant.keyframes)) {
        expect(values, `${name}.${prop} length`).toHaveLength(n)
      }
    }
  })

  it('is deterministic', () => {
    expect(toMotionVariants()).toEqual(v)
  })
})
