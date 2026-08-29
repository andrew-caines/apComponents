import { describe, expect, it } from 'vitest'
import { deriveSeeds, nudgeHue } from './semantics.js'

describe('nudgeHue', () => {
  it('moves toward the target, capped at 10°', () => {
    expect(nudgeHue(25, 260)).toBe(15) // shortest arc from 25 to 260 goes DOWN through 0 (−125°), capped at −10
    expect(nudgeHue(250, 260)).toBe(260) // |Δ|=10 → lands exactly
    expect(nudgeHue(145, 148)).toBe(148) // |Δ|<10 → lands on target
  })
  it('takes the shortest arc across 0°', () => {
    expect(nudgeHue(5, 350)).toBe(355)
  })
  it('never exceeds the cap', () => {
    expect(Math.abs(nudgeHue(80, 260) - 80)).toBeLessThanOrEqual(10)
  })
})

describe('deriveSeeds', () => {
  const brand = { l: 0.55, c: 0.17, h: 262 } // blue-family
  const seeds = deriveSeeds(brand)
  it('neutral takes brand hue at low chroma', () => {
    expect(seeds.neutral.h).toBe(262)
    expect(seeds.neutral.c).toBe(0.008)
  })
  it('danger stays in the red family (25° ± 10°)', () => {
    expect(Math.abs(seeds.danger.h - 25)).toBeLessThanOrEqual(10)
  })
  it('success stays in the green family', () => {
    expect(Math.abs(seeds.success.h - 145)).toBeLessThanOrEqual(10)
  })
})
