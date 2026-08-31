import { describe, expect, it } from 'vitest'
import { tier3 } from './tier3.js'

describe('tier3', () => {
  it('wraps a Tier 2 value in a Tier 3 override with fallback', () => {
    expect(tier3('surface-bg', 'var(--ap-color-bg-surface)')).toBe(
      'var(--ap-surface-bg, var(--ap-color-bg-surface))',
    )
  })
  it('accepts a literal fallback', () => {
    expect(tier3('surface-radius', '6px')).toBe('var(--ap-surface-radius, 6px)')
  })
  it('rejects a name that already carries the prefix', () => {
    expect(() => tier3('--ap-surface-bg', '6px')).toThrow(/without the --ap- prefix/)
  })
})
