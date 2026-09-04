import { describe, expect, it } from 'vitest'
import { generateTheme, resolveSemantic } from './generateTheme.js'
import { media } from '../breakpoints.js'
import type { SemanticEntry } from './semanticMap.js'

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
    expect(resolveSemantic(theme, 'light', 'color-action-on-solid')).toBe(
      theme.ramps.light.brand.onSolid,
    )
  })
  it('throws on an unknown semantic token', () => {
    expect(() => resolveSemantic(theme, 'light', 'color-nope')).toThrow()
  })
  it('rejects an invalid brand hex', () => {
    expect(() => generateTheme({ brand: 'blue' })).toThrow()
  })
  it('normalizes the seed brand to lowercase six-digit hex (M6)', () => {
    expect(generateTheme({ brand: '#F00' }).seed.brand).toBe('#ff0000')
    expect(generateTheme({ brand: '#2E5FD9' }).seed.brand).toBe('#2e5fd9')
    expect(generateTheme({ brand: '  #2e5fd9  ' }).seed.brand).toBe('#2e5fd9')
  })
  it('#rgb shorthand and its expansion produce identical themes', () => {
    expect(generateTheme({ brand: '#F00' })).toEqual(generateTheme({ brand: '#ff0000' }))
  })
})

describe('shared singletons are frozen (I6)', () => {
  it('every scale, the semantic map and breakpoints are frozen', () => {
    expect(Object.isFrozen(theme.scales)).toBe(true)
    expect(Object.isFrozen(theme.scales.space)).toBe(true)
    expect(Object.isFrozen(theme.scales.text)).toBe(true)
    for (const entry of Object.values(theme.scales.text)) {
      expect(Object.isFrozen(entry)).toBe(true)
    }
    expect(Object.isFrozen(theme.scales.text.md)).toBe(true)
    expect(Object.isFrozen(theme.scales.radius)).toBe(true)
    expect(Object.isFrozen(theme.scales.z)).toBe(true)
    expect(Object.isFrozen(theme.scales.misc)).toBe(true)
    expect(Object.isFrozen(theme.scales.elevation)).toBe(true)
    expect(Object.isFrozen(theme.scales.elevation.light)).toBe(true)
    expect(Object.isFrozen(theme.scales.elevation.dark)).toBe(true)
    expect(Object.isFrozen(theme.semantic)).toBe(true)
    for (const entry of theme.semantic) expect(Object.isFrozen(entry)).toBe(true)
    expect(Object.isFrozen(theme.breakpoints)).toBe(true)
    expect(Object.isFrozen(media)).toBe(true)
  })
  it('mutating a scale throws in strict mode', () => {
    expect(() => {
      ;(theme.scales.space as Record<string, string>)['5'] = '999px'
    }).toThrow(TypeError)
    expect(() => {
      ;(theme.semantic as SemanticEntry[])[0]!.step = 99
    }).toThrow(TypeError)
    // nested text entries too — freezing only the container let
    // theme.scales.text.md.size through, polluting every later theme
    expect(() => {
      ;(theme.scales.text.md as { size: string }).size = '99px'
    }).toThrow(TypeError)
    expect(generateTheme({ brand: '#2e5fd9' }).scales.text.md!.size).toBe('16px')
  })
  it('two themes share the same frozen scale objects', () => {
    expect(generateTheme({ brand: '#2e5fd9' }).scales.space).toBe(theme.scales.space)
  })
})
