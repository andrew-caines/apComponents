import { describe, expect, it } from 'vitest'
import { FONT_FALLBACKS } from './metrics.generated.js'
import { resolveFont } from './fonts.js'

describe('metrics table', () => {
  it('covers the preferred five', () => {
    expect(Object.keys(FONT_FALLBACKS).sort()).toEqual(
      ['Inter', 'Manrope', 'Open Sans', 'Poppins', 'Roboto'].sort(),
    )
  })
  it('all values are percent strings', () => {
    for (const m of Object.values(FONT_FALLBACKS)) {
      expect(m.sizeAdjust).toMatch(/^[\d.]+%$/)
      expect(m.ascentOverride).toMatch(/^[\d.]+%$/)
    }
  })
})

describe('resolveFont', () => {
  it('defaults to Inter with bundled metrics', () => {
    const f = resolveFont()
    expect(f.family).toBe('Inter')
    expect(f.metrics).not.toBeNull()
    expect(f.stack).toBe("'Inter', 'Inter Fallback', system-ui, sans-serif")
  })
  it('known family gets bundled metrics', () => {
    expect(resolveFont({ family: 'Poppins' }).metrics).toEqual(FONT_FALLBACKS['Poppins'])
  })
  it('unknown family gets null metrics and no fallback face', () => {
    const f = resolveFont({ family: 'Comic Neue' })
    expect(f.metrics).toBeNull()
    expect(f.fallbackName).toBeNull()
    expect(f.stack).toBe("'Comic Neue', system-ui, sans-serif")
  })
  it('unknown family with supplied metrics keeps them', () => {
    const metrics = { sizeAdjust: '100%', ascentOverride: '90%', descentOverride: '22%', lineGapOverride: '0%' }
    expect(resolveFont({ family: 'Comic Neue', metrics }).metrics).toEqual(metrics)
  })
})
