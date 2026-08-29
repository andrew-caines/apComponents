import { describe, expect, it } from 'vitest'
import { hexToOklch } from './oklch.js'
import { inSrgb } from './gamut.js'
import { wcagRatio } from './wcag.js'
import { apcaLc } from './apca.js'
import { generateRamp } from './ramp.js'

const brand = hexToOklch('#2e5fd9')

describe('generateRamp / light', () => {
  const ramp = generateRamp(brand, 'light')

  it('produces exactly 12 steps, all valid hex', () => {
    expect(ramp.steps).toHaveLength(12)
    for (const s of ramp.steps) expect(s.hex).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('step 9 is the seed colour (anchored)', () => {
    expect(ramp.steps[8]!.hex).toBe('#2e5fd9')
  })
  it('lightness decreases monotonically across steps 1→12', () => {
    const ls = ramp.steps.map((s) => hexToOklch(s.hex).l)
    for (let i = 1; i < 12; i++) expect(ls[i]!).toBeLessThan(ls[i - 1]!)
  })
  it('step 11 meets 4.5:1 WCAG and |Lc| ≥ 75 APCA on steps 1 and 2', () => {
    for (const bg of [ramp.steps[0]!.hex, ramp.steps[1]!.hex]) {
      expect(wcagRatio(ramp.steps[10]!.hex, bg)).toBeGreaterThanOrEqual(4.5)
      expect(Math.abs(apcaLc(ramp.steps[10]!.hex, bg))).toBeGreaterThanOrEqual(75)
    }
  })
  it('step 12 meets 7:1 on step 1', () => {
    expect(wcagRatio(ramp.steps[11]!.hex, ramp.steps[0]!.hex)).toBeGreaterThanOrEqual(7)
  })
  it('onSolid meets 4.5:1 on step 9', () => {
    expect(wcagRatio(ramp.onSolid, ramp.steps[8]!.hex)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('generateRamp / dark', () => {
  const ramp = generateRamp(brand, 'dark')
  it('lightness increases monotonically (dark is rebuilt, not inverted)', () => {
    const ls = ramp.steps.map((s) => hexToOklch(s.hex).l)
    for (let i = 1; i < 12; i++) expect(ls[i]!).toBeGreaterThan(ls[i - 1]!)
  })
  it('canvas is never pure black and text never pure white (halation rule)', () => {
    expect(ramp.steps[0]!.hex).not.toBe('#000000')
    expect(ramp.steps[11]!.hex).not.toBe('#ffffff')
  })
  it('step 11 passes 4.5:1 and Lc 75 on steps 1 and 2', () => {
    for (const bg of [ramp.steps[0]!.hex, ramp.steps[1]!.hex]) {
      expect(wcagRatio(ramp.steps[10]!.hex, bg)).toBeGreaterThanOrEqual(4.5)
      expect(Math.abs(apcaLc(ramp.steps[10]!.hex, bg))).toBeGreaterThanOrEqual(75)
    }
  })
})

describe('generateRamp / gamut behaviour', () => {
  it('a high-chroma seed produces in-sRGB hex with a P3 alternative on step 9', () => {
    const vivid = { l: 0.65, c: 0.29, h: 145 } // outside sRGB
    const ramp = generateRamp(vivid, 'light')
    expect(inSrgb(hexToOklch(ramp.steps[8]!.hex))).toBe(true)
    expect(ramp.steps[8]!.p3).toMatch(/^color\(display-p3 /)
  })
  it('in-sRGB steps carry no P3 override', () => {
    const ramp = generateRamp(brand, 'light')
    expect(ramp.steps[0]!.p3).toBeNull()
  })
  it('background/border steps 1–8 are always sRGB-clamped with no P3 override, even for a vivid seed', () => {
    const vivid = { l: 0.65, c: 0.29, h: 145 }
    for (const mode of ['light', 'dark'] as const) {
      const ramp = generateRamp(vivid, mode)
      for (let i = 0; i < 8; i++) expect(ramp.steps[i]!.p3).toBeNull()
    }
  })
})
