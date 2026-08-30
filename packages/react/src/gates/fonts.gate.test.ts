import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_BRAND, generateTheme, toFallbackFontFaceCss } from '@ap/tokens'

const ROOT = join(import.meta.dirname, '../..')
const FONTS_CSS = join(ROOT, 'src/theme/fonts.css')

describe('gate: fonts', () => {
  const css = readFileSync(FONTS_CSS, 'utf8')

  it('vendors both woff2 subsets with plausible sizes', () => {
    for (const f of ['inter-latin.woff2', 'inter-latin-ext.woff2']) {
      const p = join(ROOT, 'fonts', f)
      expect(existsSync(p), `${f} missing`).toBe(true)
      expect(statSync(p).size).toBeGreaterThan(10_000)
    }
  })

  it('references the vendored files by relative path, never a remote URL', () => {
    expect(css).toContain("url('../../fonts/inter-latin.woff2')")
    expect(css).toContain("url('../../fonts/inter-latin-ext.woff2')")
    expect(css).not.toMatch(/https?:\/\//)
  })

  it('emits the metric-matched fallback face verbatim from the token engine', () => {
    expect(css).toContain(toFallbackFontFaceCss(generateTheme({ brand: DEFAULT_BRAND })))
  })

  it('uses font-display: swap on the real faces', () => {
    expect(css.match(/font-display: swap;/g)?.length).toBe(2)
  })
})
