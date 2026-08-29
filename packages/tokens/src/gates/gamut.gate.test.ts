import { describe, expect, it } from 'vitest'
import { generateTheme, hexToOklch, DEFAULT_BRAND } from '../index.js'
import { oklchToLinearSrgb } from '../colour/oklch.js'

// 1e-4 tolerates hex→OKLCH 6dp round-trip; gamut.ts EPS stays 1e-6.
const TOL = 1e-4
function expectInSrgbRoundTrip(hex: string): void {
  const { r, g, b } = oklchToLinearSrgb(hexToOklch(hex))
  for (const ch of [r, g, b]) {
    expect(ch).toBeGreaterThanOrEqual(-TOL)
    expect(ch).toBeLessThanOrEqual(1 + TOL)
  }
}

describe('gate 3: every emitted sRGB value is in gamut, every P3 string is valid', () => {
  const theme = generateTheme({ brand: DEFAULT_BRAND })
  for (const mode of ['light', 'dark'] as const) {
    it(`${mode}: all ramp hexes are in sRGB and all p3 values are well-formed`, () => {
      for (const ramp of Object.values(theme.ramps[mode])) {
        for (const step of ramp.steps) {
          expectInSrgbRoundTrip(step.hex)
          if (step.p3) {
            expect(step.p3).toMatch(/^color\(display-p3 [01](\.\d{1,4})? [01](\.\d{1,4})? [01](\.\d{1,4})?\)$/)
          }
        }
        expectInSrgbRoundTrip(ramp.onSolid)
      }
    })
  }
})
