import { describe, expect, it } from 'vitest'
import { generateTheme } from './index.js'

describe('toolchain', () => {
  it('resolves the package source', () => {
    expect(typeof generateTheme).toBe('function')
  })
})
