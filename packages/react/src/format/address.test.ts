import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatAddress } from './address.js'
import { resetFormatWarningsForTests } from './shared.js'

beforeEach(() => {
  resetFormatWarningsForTests()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

const US = {
  name: 'Ada Lovelace',
  lines: ['1 Main St', 'Apt 2'],
  locality: 'Springfield',
  region: 'IL',
  postalCode: '62701',
  country: 'US',
}
const BODY = 'Ada Lovelace\n1 Main St\nApt 2\nSpringfield, IL 62701'

describe('formatAddress', () => {
  it.each([
    ['en-US', BODY],
    // A bare language still implies a region (en is US), so no country line.
    ['en', BODY],
    ['en-GB', `${BODY}\nUnited States`],
    ['de-DE', `${BODY}\nVereinigte Staaten`],
  ])('omits the country line only for a reader in the same region (%s)', (locale, expected) => {
    expect(formatAddress(US, { locale })).toBe(expected)
  })

  it('joins lines with a comma in single form', () => {
    expect(formatAddress(US, { locale: 'en-US', form: 'single' })).toBe(
      'Ada Lovelace, 1 Main St, Apt 2, Springfield, IL 62701',
    )
  })

  it('accepts a lowercase country code', () => {
    expect(
      formatAddress({ lines: ['Hauptstr. 5'], locality: 'Berlin', postalCode: '10115', country: 'de' }, { locale: 'de-DE' }),
    ).toBe('Hauptstr. 5\n10115 Berlin')
  })

  it('puts locality, region and postal code on separate lines for GB', () => {
    expect(
      formatAddress(
        { lines: ['10 Downing St'], locality: 'London', postalCode: 'SW1A 2AA', country: 'GB' },
        { locale: 'en-US' },
      ),
    ).toBe('10 Downing St\nLondon\nSW1A 2AA\nUnited Kingdom')
  })

  it('writes Japanese addresses largest to smallest', () => {
    expect(
      formatAddress(
        {
          name: '\u5c71\u7530\u592a\u90ce',
          lines: ['1-2-3'],
          locality: '\u5343\u4ee3\u7530\u533a',
          region: '\u6771\u4eac\u90fd',
          postalCode: '100-0001',
          country: 'JP',
        },
        { locale: 'ja-JP' },
      ),
    ).toBe('\u3012100-0001\n\u6771\u4eac\u90fd\u5343\u4ee3\u7530\u533a\n1-2-3\n\u5c71\u7530\u592a\u90ce')
  })

  it('omits the postal mark for a Japanese address without a postal code', () => {
    expect(formatAddress({ locality: '\u5343\u4ee3\u7530\u533a', country: 'JP' }, { locale: 'ja-JP' })).toBe(
      '\u5343\u4ee3\u7530\u533a',
    )
  })

  it('emits no dangling comma when the US region is missing', () => {
    expect(formatAddress({ locality: 'Springfield', postalCode: '62701', country: 'US' }, { locale: 'en-US' })).toBe(
      'Springfield 62701',
    )
  })

  it('emits no dangling comma when the US locality is missing', () => {
    expect(formatAddress({ region: 'IL', postalCode: '62701', country: 'US' }, { locale: 'en-US' })).toBe('IL 62701')
  })

  it('drops empty lines and appends the country for a foreign reader', () => {
    expect(formatAddress({ locality: 'Paris', country: 'FR' }, { locale: 'en-US' })).toBe('Paris\nFrance')
  })

  it('uses the generic template for an unknown country', () => {
    expect(formatAddress({ locality: 'Atlantis', postalCode: '1', country: 'ZZ' }, { locale: 'en-US' })).toBe(
      'Atlantis 1\nUnknown Region',
    )
  })

  it('returns an empty string for missing input', () => {
    expect(formatAddress(null, { locale: 'en-US' })).toBe('')
    expect(formatAddress(undefined, { locale: 'en-US' })).toBe('')
    expect(formatAddress({ country: '' }, { locale: 'en-US' })).toBe('')
    expect(formatAddress({ country: '  ' }, { locale: 'en-US' })).toBe('')
  })

  it('returns an empty string and warns once for a malformed locale', () => {
    expect(formatAddress(US, { locale: 'en_US' })).toBe('')
    expect(console.warn).toHaveBeenCalledTimes(1)
  })
  it('a null country returns an empty string without throwing', () => {
    expect(formatAddress({ country: null as unknown as string, locality: 'X' }, { locale: 'en-US' })).toBe('')
  })

  it('an alpha-3 country drops only the country line', () => {
    expect(
      formatAddress(
        { lines: ['1 Main St'], locality: 'Springfield', region: 'IL', postalCode: '62701', country: 'USA' },
        { locale: 'en-GB' },
      ),
    ).toBe('1 Main St\nSpringfield IL 62701')
  })
})
