import { describe, expect, it } from 'vitest'
import { DURATION, EASE } from '@ap/tokens'
import { MOTIONS } from './motions.js'

const entries = Object.entries(MOTIONS)

describe('MOTIONS record', () => {
  it('defines all twelve named motions from ADR-0010', () => {
    expect(Object.keys(MOTIONS).sort()).toEqual([
      'attention.nudge', 'collapse', 'enter.fade-rise', 'error.shake', 'exit.fade',
      'expand', 'skeleton.shimmer', 'spinner.rotate', 'success.check',
      'toast.slide-in', 'toast.slide-out', 'warning.pulse',
    ])
  })

  it('references only duration and easing tokens that exist in the scale', () => {
    for (const [name, spec] of entries) {
      expect(Object.keys(DURATION), `${name} duration`).toContain(spec.duration)
      expect(Object.keys(EASE), `${name} ease`).toContain(spec.ease)
    }
  })

  it('gives every motion steps running from 0 to 1 in ascending order', () => {
    for (const [name, spec] of entries) {
      const ats = spec.steps.map((s) => s.at)
      expect(ats[0], `${name} first offset`).toBe(0)
      expect(ats.at(-1), `${name} last offset`).toBe(1)
      expect([...ats].sort((a, b) => a - b), `${name} ordering`).toEqual(ats)
      for (const at of ats) expect(at, `${name} offset range`).toBeGreaterThanOrEqual(0)
      for (const at of ats) expect(at, `${name} offset range`).toBeLessThanOrEqual(1)
    }
  })

  it('loops only where the movement is the information (ADR-0010)', () => {
    const infinite = entries.filter(([, s]) => s.iterations === 'infinite').map(([n]) => n)
    // warning.pulse is deliberately finite: perpetual motion is a vestibular
    // hazard and an attention sink.
    expect(infinite.sort()).toEqual(['skeleton.shimmer', 'spinner.rotate'])
  })

  it('gives every opacity-degrading motion an opacity track to degrade to', () => {
    for (const [name, spec] of entries) {
      if (spec.reduced !== 'opacity') continue
      const animatesOpacity = spec.steps.some((s) => s.opacity !== undefined)
      expect(animatesOpacity, `${name} declares reduced:'opacity' but animates no opacity`).toBe(true)
    }
  })

  it('is frozen', () => {
    expect(Object.isFrozen(MOTIONS)).toBe(true)
  })
})
