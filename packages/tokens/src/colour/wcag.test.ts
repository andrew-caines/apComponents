import { describe, expect, it } from 'vitest'
import { relativeLuminance, wcagRatio } from './wcag.js'

describe('wcag', () => {
  it('white/black is 21:1', () => {
    expect(wcagRatio('#ffffff', '#000000')).toBe(21)
  })
  it('is symmetric', () => {
    expect(wcagRatio('#2e5fd9', '#ffffff')).toBe(wcagRatio('#ffffff', '#2e5fd9'))
  })
  it('matches a known value: #777777 on #ffffff ≈ 4.48', () => {
    expect(wcagRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
  it('luminance of white is 1, black is 0', () => {
    expect(relativeLuminance('#ffffff')).toBe(1)
    expect(relativeLuminance('#000000')).toBe(0)
  })
})
