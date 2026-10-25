import { describe, expect, it, vi } from 'vitest'
import { generateRamp } from '../colour/ramp.js'
import { generateTheme } from './generateTheme.js'

// A passthrough: every ramp is still the real one, the mock only records the
// calls. No real seed separates "solved against the surfaces" from "passes by
// luck" (a 2520-seed scan found none; the tightest ring was 3.017:1 on
// bg-raised), so the construction itself is what is asserted.
vi.mock('../colour/ramp.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../colour/ramp.js')>()
  return { ...real, generateRamp: vi.fn(real.generateRamp) }
})

describe('generateTheme focus ring', () => {
  // The ring (brand step 8) is drawn on bg-canvas, bg-surface and bg-raised
  // (neutral steps 1-3), so it is solved against them, not only against the
  // status subtle fills. Perturbation: dropping the neutral fills from the
  // brand ramp's `ringBackgrounds` in `generateTheme.ts` fails this.
  it('solves the brand ramp against canvas, surface and raised', () => {
    const theme = generateTheme({ brand: '#2e5fd9' })
    const calls = vi.mocked(generateRamp).mock.calls
    for (const mode of ['light', 'dark'] as const) {
      const neutral = theme.ramps[mode].neutral.steps.slice(0, 3).map((s) => s.hex)
      const brandCall = calls.find(
        ([, m, bgs]) => m === mode && bgs !== undefined && bgs.length > 0,
      )
      expect(brandCall, `${mode}: brand ramp call`).toBeDefined()
      expect(brandCall![2], mode).toEqual(expect.arrayContaining(neutral))
    }
  })
})
