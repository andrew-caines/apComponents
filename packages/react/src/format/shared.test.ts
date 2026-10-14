import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Temporal } from '@js-temporal/polyfill'
import { guard, resetFormatWarningsForTests, temporalKind, toInstant, toIsoString, toTimestamp } from './shared.js'

const T = Date.UTC(2026, 2, 5, 14, 30)

describe('toTimestamp', () => {
  it('reads a Date', () => {
    expect(toTimestamp(new Date(T))).toBe(T)
  })
  it('parses an ISO string', () => {
    expect(toTimestamp('2026-03-05T14:30:00Z')).toBe(T)
  })
  it('treats the epoch as a valid instant, not as falsy', () => {
    expect(toTimestamp(0)).toBe(0)
  })
  it.each([
    ['unparseable string', 'not a date'],
    ['NaN', NaN],
    ['null', null],
    ['undefined', undefined],
    ['invalid Date', new Date('x')],
  ])('returns undefined for %s', (_label, value) => {
    expect(toTimestamp(value as never)).toBeUndefined()
  })
})

describe('guard', () => {
  beforeEach(() => {
    resetFormatWarningsForTests()
    vi.restoreAllMocks()
  })

  it('returns the result of fn', () => {
    expect(guard('f', 1, false, () => 'ok')).toBe('ok')
  })

  it("returns '' without calling fn when bad", () => {
    const fn = vi.fn(() => 'ok')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(guard('f', 1, true, fn)).toBe('')
    expect(fn).not.toHaveBeenCalled()
  })

  it("returns '' when fn throws", () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      guard('f', 1, false, () => {
        throw new RangeError()
      }),
    ).toBe('')
  })

  it('warns once per formatter name, naming the formatter and the value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    guard('g', 'oops', true, () => 'ok')
    guard('g', 'oops', true, () => 'ok')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain('g')
    expect(String(warn.mock.calls[0]![0])).toContain('oops')
    guard('h', 'again', true, () => 'ok')
    expect(warn).toHaveBeenCalledTimes(2)
  })
})


describe('the test runtime', () => {
  it('has no global Temporal, so every Temporal path here is duck-typed (non-vacuity)', () => {
    expect((globalThis as { Temporal?: unknown }).Temporal).toBeUndefined()
  })
})

describe('temporalKind', () => {
  it.each([
    ['PlainDate', Temporal.PlainDate.from('1990-05-12')],
    ['PlainDateTime', Temporal.PlainDateTime.from('2026-03-05T09:00')],
    ['PlainTime', Temporal.PlainTime.from('09:00')],
    ['ZonedDateTime', Temporal.ZonedDateTime.from('2026-03-05T09:00[Asia/Tokyo]')],
    ['Instant', Temporal.Instant.from('2026-03-05T00:00Z')],
    ['Duration', Temporal.Duration.from({ hours: 2 })],
    ['other', Temporal.PlainYearMonth.from('2026-03')],
  ])('recognises %s', (kind, value) => {
    expect(temporalKind(value)).toBe(kind)
  })
  it.each([['a Date', new Date(0)], ['a number', 0], ['a string', '2026-03-05'], ['null', null], ['a plain object', {}]])(
    'returns undefined for %s',
    (_label, value) => {
      expect(temporalKind(value)).toBeUndefined()
    },
  )
})

describe('toInstant', () => {
  it('reads a PlainDate as that date at UTC midnight, zone UTC', () => {
    expect(toInstant(Temporal.PlainDate.from('1990-05-12'))).toEqual({ ms: Date.UTC(1990, 4, 12), zone: 'UTC', plain: 'date' })
  })
  it('keeps the years 0-99 (never Date.UTC, which maps them to 19xx)', () => {
    expect(new Date(toInstant(Temporal.PlainDate.from('0045-01-02'))!.ms).getUTCFullYear()).toBe(45)
  })
  it('reads a non-ISO PlainDate through its ISO fields and carries its calendar', () => {
    const hebrew = Temporal.PlainDate.from('1990-05-12').withCalendar('hebrew')
    expect(toInstant(hebrew)).toEqual({ ms: Date.UTC(1990, 4, 12), zone: 'UTC', plain: 'date', calendar: 'hebrew' })
  })
  it('reads a PlainDateTime as wall time in UTC', () => {
    expect(toInstant(Temporal.PlainDateTime.from('2026-03-05T09:15:30.250'))).toEqual({
      ms: Date.UTC(2026, 2, 5, 9, 15, 30, 250),
      zone: 'UTC',
      plain: 'datetime',
    })
  })
  it('reads a PlainTime on 1970-01-01 UTC', () => {
    expect(toInstant(Temporal.PlainTime.from('09:00'))).toEqual({ ms: 9 * 3_600_000, zone: 'UTC', plain: 'time' })
  })
  it('reads a ZonedDateTime as its instant in its own zone', () => {
    const zdt = Temporal.ZonedDateTime.from('2026-03-05T09:00[Asia/Tokyo]')
    expect(toInstant(zdt)).toEqual({ ms: Date.UTC(2026, 2, 5, 0), zone: 'Asia/Tokyo' })
  })
  it('reads an Instant with no zone, like a Date', () => {
    expect(toInstant(Temporal.Instant.from('2026-03-05T00:00Z'))).toEqual({ ms: Date.UTC(2026, 2, 5) })
  })
  it('reads a date-only string as a calendar date', () => {
    expect(toInstant('1990-05-12')).toEqual({ ms: Date.UTC(1990, 4, 12), zone: 'UTC', plain: 'date' })
  })
  it('rejects a date-only string that is not on the calendar (no roll-over)', () => {
    expect(toInstant('2026-02-30')).toBeUndefined()
  })
  it('reads a timestamp string, a Date and a number as before', () => {
    expect(toInstant('2026-03-05T14:30:00Z')).toEqual({ ms: T })
    expect(toInstant(new Date(T))).toEqual({ ms: T })
    expect(toInstant(T)).toEqual({ ms: T })
  })
  it.each([
    ['a Duration', Temporal.Duration.from({ hours: 2 })],
    ['a PlainYearMonth', Temporal.PlainYearMonth.from('2026-03')],
  ])('returns undefined for %s', (_label, value) => {
    expect(toInstant(value as never)).toBeUndefined()
  })
  it('returns undefined, never throws, for a Temporal-tagged object with no methods', () => {
    const fake = { [Symbol.toStringTag]: 'Temporal.PlainDate' }
    expect(() => toInstant(fake as never)).not.toThrow()
    expect(toInstant(fake as never)).toBeUndefined()
  })
  it('accepts a hand-built object with the right tag and members (structural, not instanceof)', () => {
    const fake = {
      [Symbol.toStringTag]: 'Temporal.Instant',
      epochMilliseconds: T,
      toString: () => '2026-03-05T14:30:00Z',
    }
    expect(toInstant(fake as never)).toEqual({ ms: T })
  })
})

describe('toIsoString', () => {
  it.each([
    ['a PlainDate, without its calendar annotation', Temporal.PlainDate.from('1990-05-12').withCalendar('hebrew'), '1990-05-12'],
    ['a PlainDateTime', Temporal.PlainDateTime.from('2026-03-05T09:00'), '2026-03-05T09:00:00'],
    ['a PlainTime', Temporal.PlainTime.from('09:00'), '09:00:00'],
    ['a ZonedDateTime, in offset form', Temporal.ZonedDateTime.from('2026-03-05T09:00[Asia/Tokyo]'), '2026-03-05T09:00:00+09:00'],
    ['an Instant', Temporal.Instant.from('2026-03-05T00:00Z'), '2026-03-05T00:00:00Z'],
    ['a date-only string', '1990-05-12', '1990-05-12'],
    ['a Date', new Date(T), '2026-03-05T14:30:00.000Z'],
    ['an invalid string', 'not a date', ''],
    ['a PlainYearMonth', Temporal.PlainYearMonth.from('2026-03'), ''],
  ])('%s', (_label, value, expected) => {
    expect(toIsoString(value as never)).toBe(expected)
  })
})
