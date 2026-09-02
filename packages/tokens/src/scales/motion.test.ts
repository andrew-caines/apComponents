import { describe, expect, it } from 'vitest'
import { DURATION, EASE, REDUCED_MOTION_DURATION } from './motion.js'

describe('motion primitives', () => {
  it('carries ADR-0010 durations verbatim', () => {
    expect(DURATION).toEqual({
      instant: '0ms', fast: '120ms', base: '200ms', slow: '320ms', slower: '480ms',
    })
  })

  it('carries ADR-0010 easings, plus linear for looped motions', () => {
    expect(EASE).toEqual({
      out: 'cubic-bezier(0.16, 1, 0.30, 1)',
      in: 'cubic-bezier(0.70, 0, 0.84, 0)',
      'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
      linear: 'linear',
    })
  })

  it('collapses to 1ms and never 0ms under reduced motion', () => {
    // 0ms can suppress transitionend/animationend, stranding any component
    // that unmounts or advances state on that event.
    expect(REDUCED_MOTION_DURATION).toBe('1ms')
  })

  it('freezes both scales, like every other shared singleton', () => {
    expect(Object.isFrozen(DURATION)).toBe(true)
    expect(Object.isFrozen(EASE)).toBe(true)
  })
})
