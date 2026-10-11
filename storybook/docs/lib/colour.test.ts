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
    // Perturbation: shrink the lightness span to a tenth (0.08 instead of 0.8) and the gap spread falls under the floor.
    // The guide's whole point: equal HSL steps give unequal perceived steps.
    const ls = hslRamp('#2e5fd9', 6).map(oklchLightness)
    const gaps = ls.slice(1).map((l, i) => ls[i]! - l)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.02)
  })
  it('rejects fewer than two steps instead of returning NaN colours', () => {
    // Perturbation: remove the RangeError guard and steps=1 divides by zero, so this fails.
    expect(() => hslRamp('#2e5fd9', 1)).toThrow(RangeError)
    expect(() => hslRamp('#2e5fd9', 0)).toThrow(RangeError)
  })
})
