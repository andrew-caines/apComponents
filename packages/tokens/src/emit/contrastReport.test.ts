import { describe, expect, it } from 'vitest'
import { generateTheme } from '../theme/generateTheme.js'
import { assertThemeContrast, contrastPairings } from './contrastReport.js'

const theme = generateTheme({ brand: '#2e5fd9' })

describe('contrastPairings', () => {
  it('covers 55 pairings in each mode', () => {
    const pairings = contrastPairings(theme)
    expect(pairings).toHaveLength(110)
    expect(pairings.filter((p) => p.mode === 'light')).toHaveLength(55)
    expect(pairings.filter((p) => p.mode === 'dark')).toHaveLength(55)
  })

  it('includes the pairings added by the final-review fix wave (I3)', () => {
    const light = contrastPairings(theme).filter((p) => p.mode === 'light')
    const has = (fg: string, bg: string): boolean =>
      light.some((p) => p.fg === fg && p.bg === bg)
    expect(has('color-action-on-solid', 'color-action-bg-hover')).toBe(true)
    expect(has('color-border-normal', 'color-bg-canvas')).toBe(true)
    expect(has('color-border-normal', 'color-bg-surface')).toBe(true)
    expect(has('color-text-secondary', 'color-bg-raised')).toBe(true)
  })
})

describe('assertThemeContrast', () => {
  it('returns void for a clean theme', () => {
    expect(assertThemeContrast(theme)).toBeUndefined()
  })

  it('throws listing every failing pairing', () => {
    // a theme whose ramps are hand-broken: brand step 9 recoloured to match its
    // own on-solid text, so color-action-on-solid on color-action-bg collapses
    const broken = structuredClone(theme) as typeof theme
    for (const mode of ['light', 'dark'] as const) {
      broken.ramps[mode].brand.onSolid = broken.ramps[mode].brand.steps[8]!.hex
    }
    expect(() => assertThemeContrast(broken)).toThrow(/assertThemeContrast: \d+ failing pairing/)
    expect(() => assertThemeContrast(broken)).toThrow(/color-action-on-solid on color-action-bg/)
  })
})
