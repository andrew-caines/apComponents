import { describe, expect, it } from 'vitest'
import { ease, seconds, toMotionVariants } from './emitVariants.js'

const v = toMotionVariants()

describe('toMotionVariants', () => {
  it('emits a variant for every motion', () => {
    expect(Object.keys(v)).toHaveLength(14)
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

  it('reads each declared step value straight into the keyframe array', () => {
    // success.check's opacity is declared at every step (0, 1, 1) — no
    // carry-forward is involved; the emitter reads what's on each step.
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

describe('seconds', () => {
  it('throws on a duration token that is not in the scale', () => {
    expect(() => seconds('nonexistent')).toThrow(
      "Duration token 'nonexistent' is not in the DURATION scale.",
    )
  })

  it('throws when a duration value is not an `Nms` string', () => {
    // Injected scale, not a mutation of the real (frozen) DURATION singleton.
    expect(() => seconds('bad', { bad: '1s' })).toThrow(
      "Duration token 'bad' is not a millisecond value: 1s",
    )
  })
})

describe('ease', () => {
  it('throws on an easing token that is not in the scale', () => {
    expect(() => ease('nonexistent')).toThrow(
      "Easing token 'nonexistent' is not in the EASE scale.",
    )
  })

  it('throws when an easing value is not a cubic-bezier or `linear`', () => {
    expect(() => ease('bad', { bad: 'ease-in-out' })).toThrow(
      "Easing token 'bad' is not a cubic-bezier: ease-in-out",
    )
  })

  it('throws when a cubic-bezier does not parse to exactly four finite numbers', () => {
    expect(() => ease('bad', { bad: 'cubic-bezier(0.1, 0.2, 0.3)' })).toThrow(
      "Easing token 'bad' did not parse to four control points: cubic-bezier(0.1, 0.2, 0.3)",
    )
    expect(() => ease('nan', { nan: 'cubic-bezier(0.1, x, 0.3, 1)' })).toThrow(
      "Easing token 'nan' did not parse to four control points",
    )
  })
})
