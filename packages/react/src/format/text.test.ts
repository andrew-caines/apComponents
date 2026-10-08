import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFormatWarningsForTests } from './shared.js'
import { collator, formatList, formatName, pluralize, truncate } from './text.js'

beforeEach(() => {
  resetFormatWarningsForTests()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('formatName', () => {
  it.each([
    ['given-first', { given: 'Ada', family: 'Lovelace' }, 'en-US', 'Ada Lovelace'],
    ['family-first', { given: 'Ada', family: 'Lovelace', order: 'family-first' as const }, 'en-US', 'Lovelace Ada'],
    [
      'CJK joins without a space, order from the record not the reader',
      { given: '\u592a\u90ce', family: '\u5c71\u7530', order: 'family-first' as const },
      'en-US',
      '\u5c71\u7530\u592a\u90ce',
    ],
    ['a Western name is not reordered for a ja-JP reader', { given: 'Ada', family: 'Lovelace' }, 'ja-JP', 'Ada Lovelace'],
    [
      'displayName wins',
      { given: 'Ada', family: 'Lovelace', displayName: 'Countess of Lovelace' },
      'en-US',
      'Countess of Lovelace',
    ],
    ['parts are trimmed and empty parts dropped', { given: '  Ada ', family: '' }, 'en-US', 'Ada'],
    ['empty record', {}, 'en-US', ''],
  ])('%s', (_label, name, locale, expected) => {
    expect(formatName(name, { locale })).toBe(expected)
  })

  it('returns an empty string for null and undefined', () => {
    expect(formatName(null, { locale: 'en-US' })).toBe('')
    expect(formatName(undefined, { locale: 'en-US' })).toBe('')
  })

  it('returns an empty string and warns once for a malformed locale in initials', () => {
    expect(formatName({ given: 'a', family: 'b' }, { locale: 'en_US', form: 'initials' })).toBe('')
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  describe('initials', () => {
    it.each([
      [{ given: 'Ada', family: 'Lovelace' }, 'en-US', 'AL'],
      [{ given: '\u00f6laf', family: 'berg' }, 'de-DE', '\u00d6B'],
      [{ given: 'istanbul', family: 'x' }, 'tr-TR', '\u0130X'],
      [{ displayName: 'Grace Brewster Hopper' }, 'en-US', 'GH'],
      [{ given: 'Ada' }, 'en-US', 'A'],
      // displayName wins for initials too, so they match the name shown.
      [{ given: 'Ada', family: 'Lovelace', displayName: 'Countess of Lovelace' }, 'en-US', 'CL'],
      [{ given: 'Ada', family: 'Lovelace', order: 'family-first' as const }, 'en-US', 'LA'],
      // A grapheme, not a code unit: the combining accent stays with its base letter.
      [{ given: 'e\u0301mile', family: 'zola' }, 'en-US', 'E\u0301Z'],
    ])('%j in %s is %s', (name, locale, expected) => {
      expect(formatName(name, { locale, form: 'initials' })).toBe(expected)
    })
  })
})

describe('formatList', () => {
  it.each([
    [['a', 'b', 'c'], { locale: 'en-US' }, 'a, b, and c'],
    [['a', 'b', 'c'], { locale: 'en-GB' }, 'a, b and c'],
    [['a', 'b', 'c'], { locale: 'de-DE', type: 'disjunction' as const }, 'a, b oder c'],
    [['a', 'b', 'c'], { locale: 'ja-JP' }, 'a\u3001b\u3001c'],
    [['\u05d0', '\u05d1', '\u05d2'], { locale: 'he-IL' }, '\u05d0, \u05d1 \u05d5\u05d2'],
  ])('%j with %j is %s', (items, options, expected) => {
    expect(formatList(items, options)).toBe(expected)
  })

  it('returns an empty string for an empty or missing list', () => {
    expect(formatList([], { locale: 'en-US' })).toBe('')
    expect(formatList(null, { locale: 'en-US' })).toBe('')
    expect(formatList(undefined, { locale: 'en-US' })).toBe('')
  })

  it('returns an empty string and warns once for a malformed locale', () => {
    expect(formatList(['a'], { locale: 'en_US' })).toBe('')
    expect(console.warn).toHaveBeenCalledTimes(1)
  })
})

describe('pluralize', () => {
  const en = { one: '{count} file', other: '{count} files' }
  const ru = {
    one: '{count} \u0444\u0430\u0439\u043b',
    few: '{count} \u0444\u0430\u0439\u043b\u0430',
    many: '{count} \u0444\u0430\u0439\u043b\u043e\u0432',
    other: '{count} \u0444\u0430\u0439\u043b\u0430',
  }

  it.each([
    [1, en, 'en-US', '1 file'],
    [1234, en, 'en-US', '1,234 files'],
    [3, ru, 'ru-RU', '3 \u0444\u0430\u0439\u043b\u0430'],
    [5, ru, 'ru-RU', '5 \u0444\u0430\u0439\u043b\u043e\u0432'],
    [2, { other: 'items' }, 'en-US', 'items'],
    [1, { one: '{count} of {count}', other: 'x' }, 'en-US', '1 of 1'],
  ])('pluralize(%j, %j, %s) is %s', (count, forms, locale, expected) => {
    expect(pluralize(count, forms, { locale })).toBe(expected)
  })

  it('returns an empty string for non-finite and missing counts', () => {
    expect(pluralize(NaN, en, { locale: 'en-US' })).toBe('')
    expect(pluralize(null, en, { locale: 'en-US' })).toBe('')
  })

  it('returns an empty string for a malformed locale', () => {
    expect(pluralize(1, en, { locale: 'en_US' })).toBe('')
  })
})

describe('truncate', () => {
  it.each([
    ['Hello world', 20, 'Hello world'],
    ['Hello world', 7, 'Hello\u2026'],
    ['Hello world', 11, 'Hello world'],
    ['\u{1F469}\u200d\u{1F469}\u200d\u{1F467}e\u0301xyz', 3, '\u{1F469}\u200d\u{1F469}\u200d\u{1F467}e\u0301\u2026'],
    ['abc', 0, ''],
    ['abc', -2, ''],
  ])('truncate(%j, %j) is %j', (text, length, expected) => {
    expect(truncate(text, { locale: 'en', length })).toBe(expected)
  })

  it('uses a custom ellipsis', () => {
    expect(truncate('Hello world', { locale: 'en', length: 6, ellipsis: '...' })).toBe('Hello...')
  })

  it('returns an empty string for missing text and a non-finite length', () => {
    expect(truncate(null, { locale: 'en', length: 5 })).toBe('')
    expect(truncate(undefined, { locale: 'en', length: 5 })).toBe('')
    expect(truncate('abc', { locale: 'en', length: NaN })).toBe('')
  })

  it('returns an empty string for a malformed locale', () => {
    expect(truncate('abc', { locale: 'en_US', length: 2 })).toBe('')
  })
})

describe('collator', () => {
  it('sorts German names with accents beside their base letters', () => {
    expect(['Zo\u00eb', '\u00c9mile', 'alice', 'Bob', 'zed', '\u00d6laf'].sort(collator('de-DE'))).toEqual([
      'alice',
      'Bob',
      '\u00c9mile',
      '\u00d6laf',
      'zed',
      'Zo\u00eb',
    ])
  })

  it('sorts O-umlaut after Z in Swedish', () => {
    expect(['Zo\u00eb', '\u00d6laf', 'alice'].sort(collator('sv-SE'))).toEqual(['alice', 'Zo\u00eb', '\u00d6laf'])
  })

  it('passes options through', () => {
    expect(['a10', 'a2'].sort(collator('en', { numeric: true }))).toEqual(['a2', 'a10'])
  })
})
