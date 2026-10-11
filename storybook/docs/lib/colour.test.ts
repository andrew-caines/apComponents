import { describe, expect, it } from 'vitest'
import { hslRamp, oklchLightness } from './colour.js'

describe('hslRamp', () => {
  it('returns `steps` hex colours from light to dark at the seed hue', () => {
    const ramp = hslRamp('#2e5fd9', 5)
    expect(ramp).toHaveLength(5)
    for (const hex of ramp) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    // Perturbation: iterate lightness upwards, and this ordering fails.
    const ls = ramp.map(oklchLightness)
    expect([...ls].sort((a, b) => b - a)).toEqual(ls)
  })
  it('spaces HSL lightness evenly, which OKLCH shows is NOT perceptually even', () => {
    // The guide's whole point: equal HSL steps give unequal perceived steps.
    const ls = hslRamp('#2e5fd9', 6).map(oklchLightness)
    const gaps = ls.slice(1).map((l, i) => ls[i]! - l)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.02)
  })
})
