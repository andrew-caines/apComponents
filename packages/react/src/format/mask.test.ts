import { beforeEach, describe, expect, it, vi } from 'vitest'
import { maskCardNumber, maskEmail, maskPhone, maskTaxId } from './mask.js'
import { resetFormatWarningsForTests } from './shared.js'

beforeEach(() => {
  resetFormatWarningsForTests()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('maskEmail', () => {
  it('keeps the first character of the local part and the whole domain', () => {
    expect(maskEmail('john.doe@example.com')).toBe('j*******@example.com')
  })
  it('masks a one-character local part whole', () => {
    expect(maskEmail('a@example.com')).toBe('*@example.com')
  })
  it('returns an empty string for input with no usable @, or null/undefined', () => {
    expect(maskEmail('no-at-sign')).toBe('')
    expect(maskEmail('')).toBe('')
    expect(maskEmail(null)).toBe('')
    expect(maskEmail(undefined)).toBe('')
    expect(maskEmail('@example.com')).toBe('')
    expect(maskEmail('john@')).toBe('')
  })
  it('splits on the last @', () => {
    expect(maskEmail('x@y@example.com')).toBe('x**@example.com')
  })
})

describe('maskPhone', () => {
  it('keeps the last four digits and every separator', () => {
    expect(maskPhone('+1 (555) 123-4567')).toBe('+* (***) ***-4567')
    expect(maskPhone('020 7946 0958')).toBe('*** **** 0958')
  })
  it('masks everything when there are four digits or fewer', () => {
    expect(maskPhone('12-34')).toBe('**-**')
  })
  it('returns an empty string for empty input', () => {
    expect(maskPhone('')).toBe('')
    expect(maskPhone(null)).toBe('')
  })
})

describe('maskCardNumber', () => {
  it('keeps the last four digits', () => {
    expect(maskCardNumber('4111 1111 1111 1111')).toBe('**** **** **** 1111')
    expect(maskCardNumber('4111111111111111')).toBe('************1111')
  })
  it('returns an empty string for empty input', () => {
    expect(maskCardNumber('')).toBe('')
    expect(maskCardNumber(undefined)).toBe('')
  })
})

describe('maskTaxId', () => {
  it('US: last four, format kept, including EIN', () => {
    expect(maskTaxId('123-45-6789', 'US')).toBe('***-**-6789')
    expect(maskTaxId('12-3456789', 'US')).toBe('**-***6789')
  })
  it('CA: last three, case-insensitive country', () => {
    expect(maskTaxId('123-456-789', 'CA')).toBe('***-***-789')
    expect(maskTaxId('123-456-789', 'ca')).toBe('***-***-789')
    expect(maskTaxId('123-456-789', ' ca ')).toBe('***-***-789')
  })
  it('IN and SG: the generic last-four rule', () => {
    expect(maskTaxId('1234 5678 9012', 'IN')).toBe('**** **** 9012')
    expect(maskTaxId('S1234567A', 'SG')).toBe('*****567A')
  })
  it('uncited countries and a blank country use the generic rule', () => {
    expect(maskTaxId('AB123456C', 'GB')).toBe('*****456C')
    expect(maskTaxId('AB123456C', '')).toBe('*****456C')
    expect(maskTaxId('AB123456C', '  ')).toBe('*****456C')
  })
  it('masks every character when the value is no longer than the kept count (Review Focus 2)', () => {
    expect(maskTaxId('1234', 'US')).toBe('****')
    expect(maskTaxId('12', 'DE')).toBe('**')
    expect(maskTaxId('789', 'CA')).toBe('***')
  })
  it('returns an empty string for empty input', () => {
    expect(maskTaxId('', 'US')).toBe('')
    expect(maskTaxId(null, 'US')).toBe('')
  })
})

describe('masks with non-ASCII digits and letters', () => {
  // Every maskable character except the last four becomes '*'; separators pass through.
  it('masks a full-width phone number', () => {
    expect(maskPhone('\uff10\uff19\uff10-\uff11\uff12\uff13\uff14-\uff15\uff16\uff17\uff18')).toBe('***-****-\uff15\uff16\uff17\uff18')
  })
  it('masks Arabic-Indic card digits', () => {
    expect(
      maskCardNumber('\u0664\u0661\u0661\u0661 \u0661\u0661\u0661\u0661 \u0661\u0661\u0661\u0661 \u0661\u0662\u0663\u0664'),
    ).toBe('**** **** **** \u0661\u0662\u0663\u0664')
  })
  it('masks a full-width JP My Number', () => {
    expect(maskTaxId('\uff11\uff12\uff13\uff14 \uff15\uff16\uff17\uff18 \uff19\uff10\uff11\uff12', 'JP')).toBe(
      '**** **** \uff19\uff10\uff11\uff12',
    )
  })
  it('masks accented letters in a tax ID', () => {
    expect(maskTaxId('\u00c9\u00c9123456', 'FR')).toBe('****3456')
  })
})

describe('determinism', () => {
  it('returns identical output across calls', () => {
    const calls = [
      () => maskEmail('john.doe@example.com'),
      () => maskPhone('+1 (555) 123-4567'),
      () => maskCardNumber('4111 1111 1111 1111'),
      () => maskTaxId('123-456-789', 'CA'),
    ]
    for (const call of calls) {
      const first = call()
      expect(call()).toBe(first)
      expect(call()).toBe(first)
    }
  })
})
