import { describe, expect, it } from 'vitest'
import { generateTheme } from '../theme/generateTheme.js'
import { toCssText, toFallbackFontFaceCss } from './cssText.js'

const theme = generateTheme({ brand: '#2e5fd9' })
const css = toCssText(theme)

const norm = (s: string): string => s.split('\n').map((l) => l.trim()).filter(Boolean).join('\n')

/**
 * Every block body in `source` whose selector is exactly `selector`.
 * The old single-match regex only ever saw the FIRST `[data-ap-scheme="dark"]`
 * block, which is precisely why the P3 cascade defect went unnoticed — the P3
 * blocks were never compared to anything.
 */
function blockBodies(source: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|\\n)\\s*${escaped} \\{([^{}]*)\\}`, 'g')
  return [...source.matchAll(re)].map((m) => m[2]!)
}

/**
 * Index of the `{` that closes the block opened by the `{` at `openIndex`,
 * found by counting nested braces. Pattern-matching (e.g. `lastIndexOf('}')`)
 * cannot prove containment when the outer block itself contains other
 * `{...}` blocks — it just finds *a* closing brace, not necessarily the one
 * that matches this opener.
 */
function matchingClose(source: string, openIndex: number): number {
  let depth = 0
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  throw new Error(`no matching close brace found for opener at index ${openIndex}`)
}

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

  it('finds exactly two dark attribute blocks and two dark media blocks (hex + P3)', () => {
    expect(blockBodies(css, '[data-ap-scheme="dark"]')).toHaveLength(2)
    expect(blockBodies(css, ':root:not([data-ap-scheme="light"])')).toHaveLength(2)
  })

  it('the main hex dark attribute block matches the main dark media block', () => {
    const [attrHex] = blockBodies(css, '[data-ap-scheme="dark"]')
    const [mediaHex] = blockBodies(css, ':root:not([data-ap-scheme="light"])')
    expect(norm(attrHex!)).toBe(norm(mediaHex!))
    expect(norm(attrHex!)).toContain('--ap-brand-1:')
  })

  it('the P3 dark attribute block matches the nested P3 dark media block', () => {
    const attrP3 = blockBodies(css, '[data-ap-scheme="dark"]')[1]!
    const mediaP3 = blockBodies(css, ':root:not([data-ap-scheme="light"])')[1]!
    expect(norm(attrP3)).toBe(norm(mediaP3))
    // guard against the pair being empty and passing vacuously
    expect(norm(attrP3)).toContain('display-p3')
  })

  it('the nested P3 dark media block sits inside the gamut query, after the P3 attribute block', () => {
    const gamut = css.indexOf('@media (color-gamut: p3)')
    const coarse = css.indexOf('@media (pointer: coarse)')
    const nested = css.indexOf('@media (prefers-color-scheme: dark)', gamut)
    expect(gamut).toBeGreaterThan(-1)
    expect(nested).toBeGreaterThan(gamut)
    expect(nested).toBeLessThan(coarse)
  })

  it('light P3 declarations only ever land under :root:not([data-ap-scheme="dark"])', () => {
    const gamut = css.indexOf('@media (color-gamut: p3)')
    const coarse = css.indexOf('@media (pointer: coarse)')
    const section = css.slice(gamut, coarse)
    // no bare `:root {` anywhere in the gamut section — a bare :root there has
    // the same specificity as the dark attribute block but comes later in
    // source order, so it would repaint attribute-dark with light values
    expect(section).not.toMatch(/(^|\n)\s*:root \{/)

    const lightBody = blockBodies(section, ':root:not([data-ap-scheme="dark"])')
    expect(lightBody).toHaveLength(1)
    const declared = norm(lightBody[0]!).split('\n')
    expect(declared.length).toBeGreaterThan(0)
    const expected = new Set<string>()
    for (const [name, ramp] of Object.entries(theme.ramps.light)) {
      ramp.steps.forEach((s, i) => {
        if (s.p3) expected.add(`--ap-${name}-${i + 1}: ${s.p3};`)
      })
    }
    expect(new Set(declared)).toEqual(expected)
  })

  it('both dark P3 blocks declare every token name the light P3 block declares', () => {
    // Structural subset guard, seed-independent. The light P3 selector
    // :root:not([data-ap-scheme="dark"]) is (0,2,0) — same specificity as the
    // dark hex media block, later in source — so in system-dark on P3 hardware
    // any token the dark P3 blocks fail to redeclare falls through to the LIGHT
    // P3 value. For the default seed that was --ap-success-11/-12, dropping
    // color-success-text to 2.78:1 on the dark canvas.
    const gamut = css.indexOf('@media (color-gamut: p3)')
    const coarse = css.indexOf('@media (pointer: coarse)')
    const section = css.slice(gamut, coarse)
    const names = (body: string): string[] =>
      norm(body).split('\n').map((l) => l.slice(0, l.indexOf(':')))

    const lightNames = names(blockBodies(section, ':root:not([data-ap-scheme="dark"])')[0]!)
    expect(lightNames.length).toBeGreaterThan(0)

    const darkAttrNames = new Set(names(blockBodies(section, '[data-ap-scheme="dark"]')[0]!))
    const darkMediaNames = new Set(names(blockBodies(section, ':root:not([data-ap-scheme="light"])')[0]!))
    for (const name of lightNames) {
      expect(darkAttrNames, `${name} missing from the P3 dark attribute block`).toContain(name)
      expect(darkMediaNames, `${name} missing from the nested P3 dark media block`).toContain(name)
    }
  })

  it('a dark P3 token with no dark P3 value falls back to the dark hex, not the light P3', () => {
    const gamut = css.indexOf('@media (color-gamut: p3)')
    const coarse = css.indexOf('@media (pointer: coarse)')
    const darkAttr = blockBodies(css.slice(gamut, coarse), '[data-ap-scheme="dark"]')[0]!
    // success 11/12 have light P3 but no dark P3 for the default seed
    for (const step of [11, 12]) {
      const dark = theme.ramps.dark.success.steps[step - 1]!
      expect(dark.p3).toBeNull()
      expect(theme.ramps.light.success.steps[step - 1]!.p3).not.toBeNull()
      expect(norm(darkAttr)).toContain(`--ap-success-${step}: ${dark.hex};`)
    }
  })

  it('P3 values appear only under the gamut media query', () => {
    const first = css.indexOf('display-p3')
    expect(first).toBeGreaterThan(css.indexOf('@media (color-gamut: p3)'))
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

describe('toCssText / scoped emission', () => {
  it('an explicit :root selector reproduces the default output byte for byte', () => {
    expect(toCssText(theme, { selector: ':root' })).toBe(css)
    expect(toCssText(theme, {})).toBe(css)
  })
  it('a custom selector replaces :root everywhere and qualifies the scheme attribute', () => {
    const scoped = toCssText(theme, { selector: '.my-scope' })
    expect(scoped).toContain('.my-scope {')
    expect(scoped).toContain('.my-scope[data-ap-scheme="dark"] {')
    expect(scoped).toContain('.my-scope:not([data-ap-scheme="light"]) {')
    expect(scoped).toContain('.my-scope:not([data-ap-scheme="dark"]) {')
    expect(scoped).not.toContain(':root')
    // the bare attribute selector must not survive either — it would leak the
    // dark palette out of the scope onto any ancestor carrying the attribute
    expect(scoped).not.toMatch(/(^|\n)\s*\[data-ap-scheme="dark"\] \{/)
  })
  it('scoping changes only selectors, never declarations', () => {
    const scoped = toCssText(theme, { selector: '.my-scope' })
    const decls = (s: string): string[] =>
      s.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('--ap-'))
    expect(decls(scoped)).toEqual(decls(css))
  })
})

describe('motion primitives', () => {
  it('emits every duration and easing custom property', () => {
    for (const k of ['instant', 'fast', 'base', 'slow', 'slower']) {
      expect(css).toContain(`--ap-duration-${k}:`)
    }
    for (const k of ['out', 'in', 'in-out', 'linear']) {
      expect(css).toContain(`--ap-ease-${k}:`)
    }
  })

  it('collapses every non-zero duration under prefers-reduced-motion', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(block).toContain('--ap-duration-fast: 1ms;')
    expect(block).toContain('--ap-duration-base: 1ms;')
    expect(block).toContain('--ap-duration-slow: 1ms;')
    expect(block).toContain('--ap-duration-slower: 1ms;')
  })

  it('leaves the already-zero duration alone', () => {
    // `instant` is 0ms in both modes; re-declaring it as 1ms would make the
    // reduced-motion sheet slower than the normal one.
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(block).not.toContain('--ap-duration-instant')
  })

  it('emits the reduced-motion block inside the token layer', () => {
    const layerOpener = '@layer ap.tokens {'
    const openBrace = css.indexOf(layerOpener) + layerOpener.length - 1
    const layerClose = matchingClose(css, openBrace)
    const mediaIndex = css.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(mediaIndex).toBeGreaterThan(openBrace)
    expect(mediaIndex).toBeLessThan(layerClose)
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
