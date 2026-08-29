import { describe, expect, it } from 'vitest'
import { hexToOklch, oklchToHex } from './oklch.js'

describe('hexToOklch', () => {
  it('converts white', () => {
    const c = hexToOklch('#ffffff')
    expect(c.l).toBeCloseTo(1, 4)
    expect(c.c).toBeCloseTo(0, 4)
  })
  it('converts black', () => {
    expect(hexToOklch('#000000').l).toBeCloseTo(0, 4)
  })
  it('converts sRGB red to the published OKLCH value', () => {
    // reference: oklch(0.627955 0.257683 29.2339) — Ottosson / CSS Color 4
    const c = hexToOklch('#ff0000')
    expect(c.l).toBeCloseTo(0.627955, 3)
    expect(c.c).toBeCloseTo(0.257683, 3)
    expect(c.h).toBeCloseTo(29.2339, 1)
  })
  it('accepts shorthand and uppercase', () => {
    expect(hexToOklch('#F00')).toEqual(hexToOklch('#ff0000'))
  })
  it('throws on malformed input', () => {
    expect(() => hexToOklch('red')).toThrow()
    expect(() => hexToOklch('#12345')).toThrow()
  })
})

describe('round-trip', () => {
  it('hex → oklch → hex is identity for a sample set', () => {
    for (const hex of ['#2e5fd9', '#ff0000', '#00ff00', '#123456', '#fafafa', '#111111']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex)
    }
  })
})
