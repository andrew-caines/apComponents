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

  // The AU expectation equals the generic fallback, so deleting AU's entry cannot fail it.
  // It pins the output, not the entry.
  it('keeps the AU city line without commas', () => {
    expect(
      formatAddress(
        { lines: ['1 George St'], locality: 'Sydney', region: 'NSW', postalCode: '2000', country: 'AU' },
        { locale: 'en-US' },
      ),
    ).toBe('1 George St\nSydney NSW 2000\nAustralia')
  })

  it('drops the region for NZ', () => {
    expect(
      formatAddress(
        { lines: ['1 Queen St'], locality: 'Auckland', region: 'Auckland', postalCode: '1010', country: 'NZ' },
        { locale: 'en-US' },
      ),
    ).toBe('1 Queen St\nAuckland 1010\nNew Zealand')
  })

  it('stacks IE locality, region and postal code', () => {
    expect(
      formatAddress(
        { lines: ['1 Grafton St'], locality: 'Dublin', region: 'Co. Dublin', postalCode: 'D02 X285', country: 'IE' },
        { locale: 'en-US' },
      ),
    ).toBe('1 Grafton St\nDublin\nCo. Dublin\nD02 X285\nIreland')
  })

  it('puts the IN region after the postal line', () => {
    expect(
      formatAddress(
        { lines: ['1 MG Road'], locality: 'Bengaluru', region: 'Karnataka', postalCode: '560001', country: 'IN' },
        { locale: 'en-US' },
      ),
    ).toBe('1 MG Road\nBengaluru 560001\nKarnataka\nIndia')
  })

  it('writes the SG postal code after the locality', () => {
    expect(
      formatAddress(
        { lines: ['1 Raffles Place'], locality: 'Singapore', postalCode: '048616', country: 'SG' },
        { locale: 'en-US' },
      ),
    ).toBe('1 Raffles Place\nSingapore 048616\nSingapore')
  })

  it('puts the NL postal code first', () => {
    expect(
      formatAddress(
        { lines: ['Damrak 1'], locality: 'Amsterdam', postalCode: '1012 LG', country: 'NL' },
        { locale: 'en-US' },
      ),
    ).toBe('Damrak 1\n1012 LG Amsterdam\nNetherlands')
  })

  const CA = { lines: ['1 Yonge St'], locality: 'Toronto', region: 'ON', postalCode: 'M5E 1W7', country: 'CA' }

  it('formats CA like US', () => {
    expect(formatAddress(CA, { locale: 'en-US' })).toBe('1 Yonge St\nToronto, ON M5E 1W7\nCanada')
  })

  it('omits the country line for a CA address read in en-CA', () => {
    expect(formatAddress(CA, { locale: 'en-CA' })).toBe('1 Yonge St\nToronto, ON M5E 1W7')
  })

  it('joins a Japanese address on one line in single form', () => {
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
        { locale: 'ja-JP', form: 'single' },
      ),
    ).toBe('\u3012100-0001, \u6771\u4eac\u90fd\u5343\u4ee3\u7530\u533a, 1-2-3, \u5c71\u7530\u592a\u90ce')
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
