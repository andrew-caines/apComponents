import { describe, expect, it } from 'vitest'
import { VERSION } from './index.js'

describe('toolchain', () => {
  it('resolves the package source', () => {
    expect(VERSION).toBe('0.1.0')
  })
})
