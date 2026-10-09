import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatPhone } from './phone.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('formatPhone', () => {
  it('trims and upper-cases defaultCountry', () => {
    const expected = formatPhone('020 7946 0958', { defaultCountry: 'GB', format: 'international' })
    expect(expected, 'the GB parse must succeed or the comparison is vacuous').toBe('+44 20 7946 0958')
    expect(formatPhone('020 7946 0958', { defaultCountry: ' gb ', format: 'international' })).toBe(expected)
  })

  it('empty, null and undefined return an empty string without a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(formatPhone('')).toBe('')
    expect(formatPhone('  ')).toBe('')
    expect(formatPhone(null)).toBe('')
    expect(formatPhone(undefined)).toBe('')
    expect(warn).not.toHaveBeenCalled()
  })

  it('formats a number that carries its own country as international by default', () => {
    expect(formatPhone('+442079460958')).toBe('+44 20 7946 0958')
  })

  it("formats national when format is 'national'", () => {
    expect(formatPhone('+442079460958', { format: 'national' })).toBe('020 7946 0958')
  })

  it("formats E.164 using the default country for a national-style input", () => {
    expect(formatPhone('(213) 373-4253', { defaultCountry: 'US', format: 'E.164' })).toBe('+12133734253')
  })

  it('formats a bare national number through the default country', () => {
    expect(formatPhone('2133734253', { defaultCountry: 'US', format: 'national' })).toBe('(213) 373-4253')
  })

  it('returns the trimmed input when it cannot be parsed', () => {
    expect(formatPhone('  not a phone  ')).toBe('not a phone')
  })

  it('returns the trimmed input when there is no + and no default country', () => {
    expect(formatPhone('2133734253')).toBe('2133734253')
  })

  it('returns an empty string for empty, null and undefined', () => {
    expect(formatPhone('', { defaultCountry: 'US' })).toBe('')
    expect(formatPhone(null)).toBe('')
    expect(formatPhone(undefined)).toBe('')
  })

  it('does not throw on an unknown default country when the number carries its own', () => {
    expect(formatPhone('+12133734253', { defaultCountry: 'XX' })).toBe('+1 213 373 4253')
  })
})
