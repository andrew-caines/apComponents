import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatBytes,
  formatCompact,
  formatCurrency,
  formatNumber,
  formatOrdinal,
  formatPercent,
  formatPercentChange,
} from './number.js'
import { resetFormatWarningsForTests } from './shared.js'

beforeEach(() => {
  resetFormatWarningsForTests()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('formatNumber', () => {
  it.each([
    ['de-DE', '1.234.567,891'],
    ['fr-FR', '1\u202f234\u202f567,891'],
    ['en-IN', '12,34,567.891'],
    ['he-IL', '1,234,567.891'],
  ])('groups by %s rules', (locale, expected) => {
    expect(formatNumber(1234567.891, { locale })).toBe(expected)
  })

  it('returns an empty string for non-finite and missing values', () => {
    expect(formatNumber(NaN, { locale: 'en-US' })).toBe('')
    expect(formatNumber(Infinity, { locale: 'en-US' })).toBe('')
    expect(formatNumber(null, { locale: 'en-US' })).toBe('')
    expect(formatNumber(undefined, { locale: 'en-US' })).toBe('')
  })

  it('returns an empty string and warns once for a malformed locale', () => {
    expect(formatNumber(1, { locale: 'en_US' })).toBe('')
    expect(formatNumber(1, { locale: 'en_US' })).toBe('')
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('passes Intl options through', () => {
    expect(formatNumber(1.5, { locale: 'en-US', minimumFractionDigits: 2 })).toBe('1.50')
  })
})

describe('formatCurrency', () => {
  it.each([
    ['en-US', 'USD', 1234.5, '$1,234.50'],
    ['de-DE', 'EUR', 1234.5, '1.234,50\u00a0\u20ac'],
    ['ja-JP', 'JPY', 1234.5, '\uffe51,235'],
    ['he-IL', 'ILS', 1234.5, '\u200f1,234.50\u00a0\u200f\u20aa'],
  ])('formats %s %s', (locale, currency, value, expected) => {
    expect(formatCurrency(value, { locale, currency })).toBe(expected)
  })

  it('returns an empty string for an invalid currency code', () => {
    expect(formatCurrency(1, { locale: 'en-US', currency: 'XX' })).toBe('')
  })

  it('returns an empty string for a missing value', () => {
    expect(formatCurrency(null, { locale: 'en-US', currency: 'USD' })).toBe('')
  })
})

describe('formatPercent', () => {
  it('treats the value as a ratio', () => {
    expect(formatPercent(0.125, { locale: 'en-US' })).toBe('13%')
  })
  it('honours fraction digits', () => {
    expect(formatPercent(0.125, { locale: 'en-US', maximumFractionDigits: 1 })).toBe('12.5%')
  })
  it('uses the locale spacing', () => {
    expect(formatPercent(0.125, { locale: 'de-DE' })).toBe('13\u00a0%')
  })
  it('returns an empty string for NaN', () => {
    expect(formatPercent(NaN, { locale: 'en-US' })).toBe('')
  })
})

describe('formatPercentChange', () => {
  it.each([
    [80, 90, 'en-US', '+12.5%'],
    [100, 97, 'en-US', '-3%'],
    [100, 97, 'de-DE', '-3\u00a0%'],
    [50, 50, 'en-US', '0%'],
    [-50, -25, 'en-US', '+50%'],
  ])('change from %s to %s in %s', (previous, current, locale, expected) => {
    expect(formatPercentChange(previous, current, { locale })).toBe(expected)
  })

  it('returns an empty string for a zero base or bad input', () => {
    expect(formatPercentChange(0, 10, { locale: 'en-US' })).toBe('')
    expect(formatPercentChange(NaN, 10, { locale: 'en-US' })).toBe('')
    expect(formatPercentChange(10, null, { locale: 'en-US' })).toBe('')
    expect(formatPercentChange(null, 10, { locale: 'en-US' })).toBe('')
  })

  it('lets the caller override the defaults', () => {
    expect(formatPercentChange(80, 90, { locale: 'en-US', maximumFractionDigits: 0 })).toBe('+13%')
    expect(formatPercentChange(80, 90, { locale: 'en-US', signDisplay: 'never' })).toBe('12.5%')
  })
})

describe('formatCompact', () => {
  it.each([
    ['en-US', '1.2M'],
    ['de-DE', '1,2\u00a0Mio.'],
    ['ja-JP', '123\u4e07'],
  ])('compacts in %s', (locale, expected) => {
    expect(formatCompact(1234567, { locale })).toBe(expected)
  })
  it('returns an empty string for Infinity', () => {
    expect(formatCompact(Infinity, { locale: 'en-US' })).toBe('')
  })
})

describe('formatOrdinal', () => {
  it('negative zero reads as zero', () => {
    expect(formatOrdinal(-0, { locale: 'en-US' })).toBe('0th')
  })
  it('suffixes English numbers', () => {
    const values = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112]
    expect(values.map((n) => formatOrdinal(n, { locale: 'en-US' })).join(' ')).toBe(
      '1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 23rd 101st 111th 112th',
    )
  })
  it('treats any English region as English', () => {
    expect(formatOrdinal(2, { locale: 'en-GB' })).toBe('2nd')
  })
  it('uses French one/other suffixes', () => {
    expect(formatOrdinal(1, { locale: 'fr-FR' })).toBe('1er')
    expect(formatOrdinal(2, { locale: 'fr-FR' })).toBe('2e')
  })
  it('uses a trailing dot for German', () => {
    expect(formatOrdinal(3, { locale: 'de-DE' })).toBe('3.')
  })
  it('returns the bare number for a language without a table entry', () => {
    expect(formatOrdinal(5, { locale: 'ja-JP' })).toBe('5')
  })
  it('returns an empty string for non-integers, negatives and a bad locale', () => {
    expect(formatOrdinal(1.5, { locale: 'en-US' })).toBe('')
    expect(formatOrdinal(-1, { locale: 'en-US' })).toBe('')
    expect(formatOrdinal(null, { locale: 'en-US' })).toBe('')
    expect(formatOrdinal(1, { locale: 'en_US' })).toBe('')
  })
})

describe('formatBytes', () => {
  it('a negative value that rounds to zero has no minus sign', () => {
    expect(formatBytes(-0.04, { locale: 'en-US' })).toBe('0 bytes')
    expect(formatBytes(-0, { locale: 'en-US' })).toBe('0 bytes')
  })
  it.each([
    [0, 'en-US', '0 bytes'],
    [1, 'en-US', '1 byte'],
    [512, 'en-US', '512 bytes'],
    [1500, 'en-US', '1.5 kB'],
    [1_500_000, 'en-US', '1.5 MB'],
    [999_950, 'en-US', '1 MB'],
    [2e15, 'en-US', '2 PB'],
    [5e18, 'en-US', '5,000 PB'],
    [512, 'de-DE', '512 Byte'],
    [1500, 'de-DE', '1,5 kB'],
    [1500, 'fr-FR', '1,5\u202fko'],
    [-1500, 'en-US', '-1.5 kB'],
  ])('formats %s in %s', (value, locale, expected) => {
    expect(formatBytes(value, { locale })).toBe(expected)
  })

  it('honours maximumFractionDigits', () => {
    expect(formatBytes(1234, { locale: 'en-US', maximumFractionDigits: 2 })).toBe('1.23 kB')
  })

  it('returns an empty string for NaN and null', () => {
    expect(formatBytes(NaN, { locale: 'en-US' })).toBe('')
    expect(formatBytes(null, { locale: 'en-US' })).toBe('')
  })
})
