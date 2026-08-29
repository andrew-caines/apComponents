import { describe, expect, it } from 'vitest'
import { hexToOklch } from './oklch.js'
import { clampToSrgb, formatP3, inP3, inSrgb } from './gamut.js'

describe('gamut', () => {
  it('every hex-derived colour is in sRGB', () => {
    expect(inSrgb(hexToOklch('#2e5fd9'))).toBe(true)
    expect(inSrgb(hexToOklch('#ff0000'))).toBe(true)
  })
  it('detects out-of-sRGB colours', () => {
    // vivid green beyond sRGB: oklch(0.8 0.3 145)
    expect(inSrgb({ l: 0.8, c: 0.3, h: 145 })).toBe(false)
  })
  it('clampToSrgb preserves lightness and hue, reduces chroma into gamut', () => {
    const out = clampToSrgb({ l: 0.8, c: 0.3, h: 145 })
    expect(out.l).toBe(0.8)
    expect(out.h).toBe(145)
    expect(out.c).toBeLessThan(0.3)
    expect(inSrgb(out)).toBe(true)
  })
  it('clampToSrgb is identity for in-gamut colours', () => {
    const c = hexToOklch('#2e5fd9')
    expect(clampToSrgb(c)).toEqual(c)
  })
  it('P3 is wider than sRGB', () => {
    const vivid = { l: 0.7, c: 0.26, h: 145 }
    expect(inSrgb(vivid)).toBe(false)
    expect(inP3(vivid)).toBe(true)
  })
  it('formats display-p3 with 4dp channels', () => {
    expect(formatP3(hexToOklch('#ff0000'))).toMatch(
      /^color\(display-p3 0\.\d{1,4} 0\.\d{1,4} 0(\.\d{1,4})?\)$/,
    )
  })
})
