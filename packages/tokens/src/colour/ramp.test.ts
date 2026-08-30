import { describe, expect, it } from 'vitest'
import { hexToOklch } from './oklch.js'
import { inSrgb } from './gamut.js'
import { wcagRatio } from './wcag.js'
import { apcaLc } from './apca.js'
import { generateRamp, solveTextLightness } from './ramp.js'

const brand = hexToOklch('#2e5fd9')
const vivid = { l: 0.65, c: 0.29, h: 145 } // outside sRGB

describe('generateRamp / light', () => {
  const ramp = generateRamp(brand, 'light')

  it('produces exactly 12 steps, all valid hex', () => {
    expect(ramp.steps).toHaveLength(12)
    for (const s of ramp.steps) expect(s.hex).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('step 9 is the seed colour (anchored)', () => {
    expect(ramp.steps[8]!.hex).toBe('#2e5fd9')
  })
  it('lightness decreases monotonically across steps 1→8 and 10→12', () => {
    // The 8→9 boundary is not compared (the seed anchor may sit between solved
    // neighbours), and neither is 9→10: under Ruling F step 10 moves away from
    // the on-solid text colour, so it can land on either side of step 9.
    const ls = ramp.steps.map((s) => hexToOklch(s.hex).l)
    for (let i = 1; i < 8; i++) expect(ls[i]!).toBeLessThan(ls[i - 1]!)
    for (let i = 10; i < 12; i++) expect(ls[i]!).toBeLessThan(ls[i - 1]!)
  })
  it('steps 7 and 8 meet WCAG ≥3 and |Lc| ≥ 45 APCA on steps 1 and 2', () => {
    for (const step of [ramp.steps[6]!, ramp.steps[7]!]) {
      for (const bg of [ramp.steps[0]!.hex, ramp.steps[1]!.hex]) {
        expect(wcagRatio(step.hex, bg)).toBeGreaterThanOrEqual(3)
        expect(Math.abs(apcaLc(step.hex, bg))).toBeGreaterThanOrEqual(45)
      }
    }
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
})

describe('generateRamp / dark', () => {
  const ramp = generateRamp(brand, 'dark')
  it('lightness increases monotonically across steps 1→8 and 10→12 (dark is rebuilt, not inverted)', () => {
    const ls = ramp.steps.map((s) => hexToOklch(s.hex).l)
    for (let i = 1; i < 8; i++) expect(ls[i]!).toBeGreaterThan(ls[i - 1]!)
    for (let i = 10; i < 12; i++) expect(ls[i]!).toBeGreaterThan(ls[i - 1]!)
  })
  it('canvas is never pure black and text never pure white (halation rule)', () => {
    expect(ramp.steps[0]!.hex).not.toBe('#000000')
    expect(ramp.steps[11]!.hex).not.toBe('#ffffff')
  })
  it('steps 7 and 8 meet WCAG ≥3 and |Lc| ≥ 45 APCA on steps 1 and 2', () => {
    for (const step of [ramp.steps[6]!, ramp.steps[7]!]) {
      for (const bg of [ramp.steps[0]!.hex, ramp.steps[1]!.hex]) {
        expect(wcagRatio(step.hex, bg)).toBeGreaterThanOrEqual(3)
        expect(Math.abs(apcaLc(step.hex, bg))).toBeGreaterThanOrEqual(45)
      }
    }
  })
  it('step 11 passes 4.5:1 and Lc 75 on steps 1 and 2', () => {
    for (const bg of [ramp.steps[0]!.hex, ramp.steps[1]!.hex]) {
      expect(wcagRatio(ramp.steps[10]!.hex, bg)).toBeGreaterThanOrEqual(4.5)
      expect(Math.abs(apcaLc(ramp.steps[10]!.hex, bg))).toBeGreaterThanOrEqual(75)
    }
  })
})

describe('generateRamp / onSolid (I1 + Ruling F)', () => {
  const seeds: Array<[string, ReturnType<typeof hexToOklch>]> = [
    ['default #2e5fd9', brand],
    ['vivid l .65 c .29 h 145', vivid],
    // regression: this seed used to settle at 4.15:1 because the dark on-solid
    // candidate was picked but never solved
    ['#5a875e', hexToOklch('#5a875e')],
    // a pale seed where white can never work
    ['#f2e4a8', hexToOklch('#f2e4a8')],
  ]

  for (const [label, seed] of seeds) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${label} / ${mode}: onSolid clears 4.5:1 on step 9 and step 10`, () => {
        const ramp = generateRamp(seed, mode)
        expect(wcagRatio(ramp.onSolid, ramp.steps[8]!.hex)).toBeGreaterThanOrEqual(4.5)
        expect(wcagRatio(ramp.onSolid, ramp.steps[9]!.hex)).toBeGreaterThanOrEqual(4.5)
      })

      it(`${label} / ${mode}: step 10 moves away from the on-solid text colour`, () => {
        const ramp = generateRamp(seed, mode)
        const l9 = hexToOklch(ramp.steps[8]!.hex).l
        const l10 = hexToOklch(ramp.steps[9]!.hex).l
        // hover must never move toward the text colour: white text ⇒ darker
        // solid, dark text ⇒ lighter solid
        if (ramp.onSolid === '#ffffff') expect(l10).toBeLessThan(l9)
        else expect(l10).toBeGreaterThan(l9)
        // and the ratio must not degrade
        expect(wcagRatio(ramp.onSolid, ramp.steps[9]!.hex)).toBeGreaterThanOrEqual(
          wcagRatio(ramp.onSolid, ramp.steps[8]!.hex),
        )
      })
    }
  }
})

describe('solveTextLightness / lattice bisection (I2)', () => {
  // Real-world hexes that made the old bisect-then-round-toward-bound guard
  // throw: the pass predicate is not monotone at 1e-6 scale because the chroma
  // clamp moves with L near the gamut boundary.
  for (const hex of ['#e1be89', '#4f5a63', '#ab92c6']) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${hex} / ${mode}: every ramp step solves without throwing`, () => {
        expect(() => generateRamp(hexToOklch(hex), mode)).not.toThrow()
      })
    }
  }

  it('returns a lightness that is exactly on the 1e-6 lattice', () => {
    const solved = solveTextLightness(hexToOklch('#e1be89'), ['#ffffff'], 'light', 4.5, 75)
    expect(Math.round(solved.l * 1e6)).toBe(solved.l * 1e6)
  })

  it('returns the input unchanged when it already passes', () => {
    const colour = hexToOklch('#101010')
    expect(solveTextLightness(colour, ['#ffffff'], 'light', 4.5, 75).l).toBe(colour.l)
  })

  it('throws with a clear message when genuinely unsatisfiable', () => {
    // nothing can reach 21:1 against both extremes at once
    expect(() =>
      solveTextLightness(hexToOklch('#808080'), ['#ffffff', '#000000'], 'light', 21, 90),
    ).toThrow(/unsatisfiable/)
  })
})

describe('generateRamp / gamut behaviour', () => {
  it('a high-chroma seed produces in-sRGB hex with a P3 alternative on step 9', () => {
    const ramp = generateRamp(vivid, 'light')
    expect(inSrgb(hexToOklch(ramp.steps[8]!.hex))).toBe(true)
    expect(ramp.steps[8]!.p3).toMatch(/^color\(display-p3 /)
  })
  it('in-sRGB steps carry no P3 override', () => {
    const ramp = generateRamp(brand, 'light')
    expect(ramp.steps[0]!.p3).toBeNull()
  })
  it('background/border steps 1–8 are always sRGB-clamped with no P3 override, even for a vivid seed', () => {
    for (const mode of ['light', 'dark'] as const) {
      const ramp = generateRamp(vivid, mode)
      for (let i = 0; i < 8; i++) expect(ramp.steps[i]!.p3).toBeNull()
    }
  })
})
