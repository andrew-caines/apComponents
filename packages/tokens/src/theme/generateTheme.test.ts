import { describe, expect, it } from 'vitest'
import { generateTheme, resolveSemantic } from './generateTheme.js'

const theme = generateTheme({ brand: '#2e5fd9' })

describe('generateTheme', () => {
  it('produces six ramps in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      expect(Object.keys(theme.ramps[mode]).sort()).toEqual(
        ['brand', 'danger', 'info', 'neutral', 'success', 'warning'].sort(),
      )
    }
  })
  it('brand step 9 is the seed in light mode', () => {
    expect(theme.ramps.light.brand.steps[8]!.hex).toBe('#2e5fd9')
  })
  it('defaults to Inter', () => {
    expect(theme.font.family).toBe('Inter')
  })
  it('resolveSemantic maps token → hex through the ramp reference', () => {
    expect(resolveSemantic(theme, 'light', 'color-bg-canvas')).toBe(
      theme.ramps.light.neutral.steps[0]!.hex,
    )
    expect(resolveSemantic(theme, 'light', 'color-action-text')).toBe(
      theme.ramps.light.brand.onSolid,
    )
  })
  it('throws on an unknown semantic token', () => {
    expect(() => resolveSemantic(theme, 'light', 'color-nope')).toThrow()
  })
  it('rejects an invalid brand hex', () => {
    expect(() => generateTheme({ brand: 'blue' })).toThrow()
  })
})
