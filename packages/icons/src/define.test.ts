import { forwardRef } from 'react'
import { describe, expect, it } from 'vitest'
import { defineIcon, isIconDefinition } from './define.js'

describe('defineIcon', () => {
  it('returns a frozen definition with frozen layer arrays', () => {
    const def = defineIcon({ name: 'bell', primary: ['M0 0'], secondary: ['M1 1'] })
    expect(Object.isFrozen(def)).toBe(true)
    expect(Object.isFrozen(def.primary)).toBe(true)
    expect(Object.isFrozen(def.secondary)).toBe(true)
  })
  it('copies its input: mutating the input array afterwards changes nothing', () => {
    const primary = ['M0 0']
    const def = defineIcon({ name: 'bell', primary })
    primary.push('M1 1')
    expect(def.primary.length).toBe(1)
  })
  it("accepts secondary: 'halo'", () => {
    expect(defineIcon({ name: 'bell', primary: ['M0 0'], secondary: 'halo' }).secondary).toBe('halo')
  })
  it.each(['Bell', 'bell_icon', '-bell', 'bell-', ''])('rejects name %j', (name) =>
    expect(() => defineIcon({ name, primary: ['M0 0'] })).toThrow(
      `defineIcon: name "${name}" must be kebab-case`,
    ),
  )
  it('rejects an empty primary', () => {
    expect(() => defineIcon({ name: 'bell', primary: [] })).toThrow(
      'defineIcon(bell): primary must contain at least one path',
    )
  })
  it('rejects an empty path string', () => {
    expect(() => defineIcon({ name: 'bell', primary: [''] })).toThrow(
      'defineIcon(bell): every path must be a non-empty string',
    )
  })
  it('rejects an empty secondary array', () => {
    expect(() => defineIcon({ name: 'bell', primary: ['M0 0'], secondary: [] })).toThrow(
      "defineIcon(bell): secondary must be 'halo' or a non-empty array of paths",
    )
  })
  it.each(['0 0 24', '0 0 0 24', 'a b c d'])('rejects viewBox %j', (viewBox) =>
    expect(() => defineIcon({ name: 'bell', primary: ['M0 0'], viewBox })).toThrow(
      `defineIcon(bell): viewBox "${viewBox}" must be four numbers with positive width and height`,
    ),
  )
})

describe('isIconDefinition', () => {
  it('is true for a defineIcon result and false for a look-alike plain object', () => {
    expect(isIconDefinition(defineIcon({ name: 'bell', primary: ['M0 0'] }))).toBe(true)
    expect(isIconDefinition({ name: 'bell', primary: ['M0 0'] })).toBe(false)
  })
  it('is false for null, a string, a function and a forwardRef object', () => {
    expect(isIconDefinition(null)).toBe(false)
    expect(isIconDefinition('bell')).toBe(false)
    expect(isIconDefinition(() => null)).toBe(false)
    expect(isIconDefinition(forwardRef(() => null))).toBe(false)
  })
  it("recognises an object branded with Symbol.for('ap.icon') by another copy of the package", () => {
    const foreign = { name: 'bell', primary: ['M0 0'] }
    Object.defineProperty(foreign, Symbol.for('ap.icon'), { value: true })
    expect(isIconDefinition(foreign)).toBe(true)
  })
  it('keeps the brand non-enumerable: Object.keys(def) is the data keys only', () => {
    const def = defineIcon({ name: 'bell', primary: ['M0 0'], viewBox: '0 0 8 8' })
    expect(Object.keys(def)).toEqual(['name', 'primary', 'viewBox'])
    expect(Object.getOwnPropertySymbols(def)).toHaveLength(1)
  })
})
