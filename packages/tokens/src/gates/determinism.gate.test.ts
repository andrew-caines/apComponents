import { describe, expect, it } from 'vitest'
import { generateTheme, toCssText, DEFAULT_BRAND } from '../index.js'

describe('gate 1: determinism', () => {
  it('two runs produce deeply equal themes', () => {
    expect(generateTheme({ brand: DEFAULT_BRAND })).toEqual(generateTheme({ brand: DEFAULT_BRAND }))
  })
  it('css output is byte-identical across runs', () => {
    expect(toCssText(generateTheme({ brand: DEFAULT_BRAND }))).toBe(
      toCssText(generateTheme({ brand: DEFAULT_BRAND })),
    )
  })
  it('the full theme matches the committed snapshot', () => {
    expect(generateTheme({ brand: DEFAULT_BRAND })).toMatchSnapshot()
  })
})
