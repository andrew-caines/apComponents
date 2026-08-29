import { describe, expect, it } from 'vitest'
import { generateTheme, DEFAULT_BRAND } from '../index.js'
import { contrastPairings } from '../emit/contrastReport.js'

describe('gate 2: WCAG 2.1 AA on every Tier 2 pairing, both modes', () => {
  const pairings = contrastPairings(generateTheme({ brand: DEFAULT_BRAND }))
  for (const p of pairings) {
    it(`[${p.mode}] ${p.fg} on ${p.bg} ≥ ${p.required}:1`, () => {
      expect(p.ratio, `${p.fgHex} on ${p.bgHex} = ${p.ratio}`).toBeGreaterThanOrEqual(p.required)
    })
  }
})
