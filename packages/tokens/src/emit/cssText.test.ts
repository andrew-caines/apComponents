import { describe, expect, it } from 'vitest'
import { generateTheme } from '../theme/generateTheme.js'
import { toCssText, toFallbackFontFaceCss } from './cssText.js'

const theme = generateTheme({ brand: '#2e5fd9' })
const css = toCssText(theme)

describe('toCssText', () => {
  it('declares layer order first', () => {
    expect(css.startsWith('@layer ap.tokens, ap.components;')).toBe(true)
  })
  it('wraps everything else in @layer ap.tokens', () => {
    expect(css).toContain('@layer ap.tokens {')
  })
  it('emits Tier 1 primitives and Tier 2 references', () => {
    expect(css).toContain(`--ap-brand-9: ${theme.ramps.light.brand.steps[8]!.hex};`)
    expect(css).toContain('--ap-color-action-bg: var(--ap-brand-9);')
    expect(css).toContain('--ap-color-text-primary: var(--ap-neutral-12);')
  })
  it('emits the dark block both ways (attribute and media)', () => {
    expect(css).toContain('[data-ap-scheme="dark"]')
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain(':root:not([data-ap-scheme="light"])')
  })
  it('dark attribute and media blocks are identical in content', () => {
    // the two blocks sit at different indent depths — compare trimmed lines
    const norm = (s: string): string => s.split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
    const attr = /\[data-ap-scheme="dark"\] \{([^}]+)\}/.exec(css)![1]!
    const media = /:root:not\(\[data-ap-scheme="light"\]\) \{([^}]+)\}/.exec(css)![1]!
    expect(norm(attr)).toBe(norm(media))
  })
  it('P3 values appear only under the gamut media query (if any exist for this seed)', () => {
    const first = css.indexOf('display-p3')
    // the default seed may legitimately produce zero out-of-sRGB ideals;
    // the vivid-seed case in gamut.test.ts guarantees the mechanism itself.
    if (first !== -1) {
      expect(first).toBeGreaterThan(css.indexOf('@media (color-gamut: p3)'))
    }
  })
  it('bumps hit target under pointer: coarse', () => {
    expect(css).toContain('@media (pointer: coarse)')
    expect(css).toContain('--ap-hit-target: 44px;')
  })
  it('emits z-scale and font tokens', () => {
    expect(css).toContain('--ap-z-toast: 1600;')
    expect(css).toContain("--ap-font-body: 'Inter', 'Inter Fallback', system-ui, sans-serif;")
  })
  it('is deterministic', () => {
    expect(toCssText(generateTheme({ brand: '#2e5fd9' }))).toBe(css)
  })
  it('matches the committed snapshot', () => {
    expect(css).toMatchSnapshot()
  })
})

describe('toFallbackFontFaceCss', () => {
  it('emits a metric-matched @font-face for Inter', () => {
    const face = toFallbackFontFaceCss(theme)
    expect(face).toContain("font-family: 'Inter Fallback';")
    expect(face).toContain("src: local('Arial');")
    expect(face).toMatch(/size-adjust: [\d.]+%;/)
  })
  it('is empty for a metrics-less custom font', () => {
    expect(toFallbackFontFaceCss(generateTheme({ brand: '#2e5fd9', font: { family: 'X' } }))).toBe('')
  })
})
