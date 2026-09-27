import { describe, expect, it } from 'vitest'
import {
  defaultToStringValue,
  equalBySerialisation,
  findLabel,
  flattenItems,
  formatLabelList,
  isGrouped,
  type SelectGroup,
  type SelectItem,
} from './selectItems.js'

interface Country {
  code: string
  name: string
}

describe('isGrouped', () => {
  it('is true for a list of groups (each item has an `items` array)', () => {
    const groups: ReadonlyArray<SelectGroup<string>> = [{ label: 'G', items: [] }]
    expect(isGrouped(groups)).toBe(true)
  })

  it('is false for a flat list of items', () => {
    const items: ReadonlyArray<SelectItem<string>> = [{ value: 'a', label: 'A' }]
    expect(isGrouped(items)).toBe(false)
  })

  it('is false for an empty list', () => {
    expect(isGrouped([])).toBe(false)
  })
})

describe('flattenItems', () => {
  it('passes a flat list through unchanged', () => {
    const items: ReadonlyArray<SelectItem<string>> = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]
    expect(flattenItems(items)).toEqual(items)
  })

  it('preserves order across groups', () => {
    // Perturbation: flattening with `[...groups].reverse().flatMap(...)` (or
    // any group-order shuffle) makes this fail, since it asserts the exact
    // sequence, not just set membership.
    const groups: ReadonlyArray<SelectGroup<string>> = [
      {
        label: 'Group 1',
        items: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      },
      {
        label: 'Group 2',
        items: [{ value: 'c', label: 'C' }],
      },
    ]
    expect(flattenItems(groups).map((item) => item.value)).toEqual(['a', 'b', 'c'])
  })
})

describe('defaultToStringValue', () => {
  it('returns a string value as-is', () => {
    expect(defaultToStringValue('ca')).toBe('ca')
  })

  it('throws for a non-string value, naming itemToStringValue in the message', () => {
    // Perturbation: a message that says only "cannot serialise value" without
    // naming `itemToStringValue` would still throw but fail this assertion,
    // since the point is telling the consumer which prop to supply.
    expect(() => defaultToStringValue({})).toThrowError(/itemToStringValue/)
  })
})

describe('equalBySerialisation', () => {
  const toString = (country: Country) => country.code

  it('is true for two distinct objects with the same key', () => {
    const a: Country = { code: 'ca', name: 'California' }
    const b: Country = { code: 'ca', name: 'Cali' }
    expect(a).not.toBe(b)
    expect(equalBySerialisation(toString)(a, b)).toBe(true)
  })

  it('is false for two objects with different keys', () => {
    const a: Country = { code: 'ca', name: 'California' }
    const b: Country = { code: 'ny', name: 'New York' }
    expect(equalBySerialisation(toString)(a, b)).toBe(false)
  })
})

describe('findLabel', () => {
  const toString = (country: Country) => country.code
  const flat: ReadonlyArray<SelectItem<Country>> = [
    { value: { code: 'ca', name: 'California' }, label: 'California' },
    { value: { code: 'ny', name: 'New York' }, label: 'New York' },
  ]

  it('finds an object value rebuilt as a new object, by serialisation', () => {
    // Perturbation: looking the item up with `flat.find((item) => item.value
    // === value)` (identity comparison) fails this, since `value` below is a
    // distinct object from the one stored in `flat` — exactly the case Base
    // UI's rebuilt `defaultValue` produces.
    const value: Country = { code: 'ca', name: 'California' }
    expect(flat.some((item) => item.value === value)).toBe(false)
    expect(findLabel(value, flat, toString)).toBe('California')
  })

  it('returns undefined for a value matching no item', () => {
    const value: Country = { code: 'tx', name: 'Texas' }
    expect(findLabel(value, flat, toString)).toBeUndefined()
  })

  it('returns undefined for null', () => {
    expect(findLabel(null, flat, toString)).toBeUndefined()
  })

  it('returns undefined for undefined', () => {
    expect(findLabel(undefined, flat, toString)).toBeUndefined()
  })
})

describe('formatLabelList', () => {
  it('formats an English conjunction list', () => {
    expect(formatLabelList(['Red', 'Green', 'Blue'], 'en-US')).toBe('Red, Green, and Blue')
  })

  it('formats a German conjunction list, differently punctuated than English', () => {
    // Perturbation: `labels.join(', ')` produces "Rot, Grün, Blau" for the
    // German case — no "und", no Oxford-style final separator — so it fails
    // this exact-string assertion. This is the whole point of the helper:
    // the join-based shortcut cannot produce locale-correct conjunctions.
    expect(formatLabelList(['Rot', 'Grün', 'Blau'], 'de-DE')).toBe('Rot, Grün und Blau')
  })

  it('returns an empty string for an empty list', () => {
    expect(formatLabelList([], 'en-US')).toBe('')
  })
})
