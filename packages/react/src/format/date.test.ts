import { Temporal } from '@js-temporal/polyfill'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDuration,
  formatRelative,
  formatTime,
} from './date.js'
import { resetFormatWarningsForTests } from './shared.js'

const T = Date.UTC(2026, 2, 5, 14, 30)
const DAY = 864e5
const MIN = 60_000
const HOUR = 3_600_000
const utc = { locale: 'en-US', timeZone: 'UTC' }

beforeEach(() => {
  resetFormatWarningsForTests()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('formatDate', () => {
  it.each([
    ['en-US', 'Mar 5, 2026'],
    ['en-GB', '5 Mar 2026'],
    ['de-DE', '05.03.2026'],
    ['ja-JP', '2026/03/05'],
    ['he-IL', '5 \u05D1\u05DE\u05E8\u05E5 2026'],
  ])('formats %s', (locale, expected) => {
    expect(formatDate(T, { locale, timeZone: 'UTC' })).toBe(expected)
  })

  it('honours the time zone', () => {
    expect(formatDate(Date.UTC(2026, 2, 5, 23, 30), { locale: 'en-US', timeZone: 'Asia/Tokyo' })).toBe(
      'Mar 6, 2026',
    )
  })

  it('formats an ISO string exactly like the Date (Review Focus 1)', () => {
    expect(formatDate('2026-03-05T14:30:00Z', utc)).toBe('Mar 5, 2026')
  })

  it("returns '' for a malformed string or null, with a warning, never 'Invalid Date' (Review Focus 1)", () => {
    expect(formatDate('not a date', utc)).toBe('')
    expect(formatDate(null, utc)).toBe('')
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('applies no style default when a component option is given', () => {
    expect(formatDate(T, { ...utc, month: 'long' })).toBe('March')
  })

  it('formats the epoch', () => {
    expect(formatDate(0, utc)).toBe('Jan 1, 1970')
  })

  it("returns '' for a malformed locale (Review Focus 5)", () => {
    expect(formatDate(T, { locale: 'en_US', timeZone: 'UTC' })).toBe('')
  })

  it("returns '' for an unknown time zone (Review Focus 5)", () => {
    expect(formatDate(T, { locale: 'en-US', timeZone: 'Mars/Base' })).toBe('')
  })
})

describe('formatTime', () => {
  it('formats in a zone', () => {
    expect(formatTime(T, { locale: 'en-US', timeZone: 'America/New_York' })).toBe('9:30 AM')
  })
  it('shows the zone name with component options', () => {
    expect(
      formatTime(T, { locale: 'en-US', timeZone: 'UTC', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
    ).toBe('2:30 PM UTC')
  })
  it('does not merge the style default when only timeZoneName is given', () => {
    expect(formatTime(T, { locale: 'en-US', timeZone: 'UTC', timeZoneName: 'short' })).toBe('3/5/2026, UTC')
  })
  it('formats 24-hour locales', () => {
    expect(formatTime(T, { locale: 'de-DE', timeZone: 'Europe/Berlin' })).toBe('15:30')
  })
})

describe('formatDateTime', () => {
  it('combines date and time', () => {
    expect(formatDateTime(T, utc)).toBe('Mar 5, 2026, 2:30 PM')
  })
  it('formats he-IL in Jerusalem', () => {
    expect(formatDateTime(T, { locale: 'he-IL', timeZone: 'Asia/Jerusalem' })).toBe(
      '5 \u05D1\u05DE\u05E8\u05E5 2026, 16:30',
    )
  })
})

describe('formatDateRange', () => {
  it('collapses a shared month and year', () => {
    expect(formatDateRange(T, T + 3 * DAY, utc)).toBe('Mar 5\u2009\u2013\u20098, 2026')
  })
  it('collapses in de-DE', () => {
    expect(formatDateRange(T, T + 3 * DAY, { locale: 'de-DE', timeZone: 'UTC' })).toBe('05.\u201308.03.2026')
  })
  it('collapses an equal start and end to one date', () => {
    expect(formatDateRange(T, T, utc)).toBe('Mar 5, 2026')
  })
  it("returns '' when an end is malformed", () => {
    expect(formatDateRange(T, 'nope', utc)).toBe('')
  })
})

describe('formatRelative', () => {
  const rel = (value: number | string, locale = 'en-US') => formatRelative(value, { locale, now: T })

  it.each([
    [T, 'en-US', 'now'],
    [T - 30_000, 'en-US', '30 seconds ago'],
    [T - 60_000, 'en-US', '1 minute ago'],
    [T - 59 * MIN, 'en-US', '59 minutes ago'],
    [T - 3 * HOUR, 'en-US', '3 hours ago'],
    [T - DAY, 'en-US', 'yesterday'],
    [T - 6 * DAY, 'en-US', '6 days ago'],
    [T - 7 * DAY, 'en-US', 'last week'],
    [T + 14 * DAY, 'de-DE', 'in 2 Wochen'],
    [T + 91 * DAY, 'en-US', 'in 3 months'],
    [T - 2 * 365.25 * DAY, 'en-US', '2 years ago'],
    [T - 5 * MIN, 'fr-FR', 'il y a 5 minutes'],
    [T - 3 * HOUR, 'he-IL', '\u05DC\u05E4\u05E0\u05D9 3 \u05E9\u05E2\u05D5\u05EA'],
  ])('%s in %s reads %s', (value, locale, expected) => {
    expect(rel(value, locale)).toBe(expected)
  })

  it("returns '' for a malformed value or now", () => {
    expect(rel('nope')).toBe('')
    expect(formatRelative(T, { locale: 'en-US', now: 'nope' })).toBe('')
  })

  it("honours numeric: 'always'", () => {
    expect(formatRelative(T - DAY, { locale: 'en-US', now: T, numeric: 'always' })).toBe('1 day ago')
  })
})

describe('formatDuration', () => {
  const d = { hours: 2, minutes: 30 }
  it.each([
    [{ locale: 'en-US', style: 'long' as const }, '2 hours, 30 minutes'],
    [{ locale: 'en-US' }, '2 hr, 30 min'],
    [{ locale: 'de-DE', style: 'long' as const }, '2 Stunden, 30 Minuten'],
    [{ locale: 'de-DE' }, '2 Std., 30 Min.'],
    [{ locale: 'he-IL', style: 'long' as const }, '\u05E9\u05E2\u05EA\u05D9\u05D9\u05DD, 30 \u05D3\u05E7\u05D5\u05EA'],
  ])('formats %j', (options, expected) => {
    expect(formatDuration(d, options)).toBe(expected)
  })

  it('omits zero fields', () => {
    expect(formatDuration({ days: 1, hours: 1, minutes: 0, seconds: 5 }, { locale: 'en-US' })).toBe(
      '1 day, 1 hr, 5 sec',
    )
  })

  it('formats an empty duration as zero seconds', () => {
    expect(formatDuration({}, { locale: 'en-US' })).toBe('0 sec')
  })

  it("returns '' for a negative or non-finite field, or null", () => {
    expect(formatDuration({ hours: -1 }, { locale: 'en-US' })).toBe('')
    expect(formatDuration({ minutes: NaN }, { locale: 'en-US' })).toBe('')
    expect(formatDuration(null, { locale: 'en-US' })).toBe('')
  })

  // Fact 3: Intl.DurationFormat exists on Node 24 and not on Node 22. The
  // composed path is the only one, so output cannot differ between them.
  describe('where Intl.DurationFormat exists (Fact 3)', () => {
    const intl = Intl as unknown as { DurationFormat?: unknown }
    const original = intl.DurationFormat
    afterEach(() => {
      if (original === undefined) delete intl.DurationFormat
      else intl.DurationFormat = original
    })
    it('still composes from NumberFormat and ListFormat', () => {
      intl.DurationFormat = class {
        format(): string {
          return 'NATIVE'
        }
      }
      expect(formatDuration({ hours: 2 }, { locale: 'en-US' })).toBe('2 hr')
    })
  })
})

const pd = Temporal.PlainDate.from('1990-05-12')
const pdt = Temporal.PlainDateTime.from('2026-03-05T09:00')
const pt = Temporal.PlainTime.from('09:00')
const zdt = Temporal.ZonedDateTime.from('2026-03-05T09:00[Asia/Tokyo]')
const inst = Temporal.Instant.from('2026-03-05T00:00Z')
const ny = { locale: 'en-US', timeZone: 'America/New_York' }

describe('date-only strings are calendar dates', () => {
  it('shows the same day west of UTC', () => {
    expect(formatDate('1990-05-12', ny)).toBe('May 12, 1990')
  })
  it('are invalid for formatTime and formatDateTime (no time to show)', () => {
    expect(formatTime('1990-05-12', ny)).toBe('')
    expect(formatDateTime('1990-05-12', ny)).toBe('')
  })
})

describe('Temporal values', () => {
  it.each([
    ['formatDate(PlainDate)', () => formatDate(pd, ny), 'May 12, 1990'],
    ['formatDate(PlainDateTime)', () => formatDate(pdt, ny), 'Mar 5, 2026'],
    ['formatDate(ZonedDateTime) in its own zone', () => formatDate(zdt, ny), 'Mar 5, 2026'],
    ['formatDate(Instant) in the given zone', () => formatDate(inst, ny), 'Mar 4, 2026'],
    ['formatTime(PlainTime)', () => formatTime(pt, ny), '9:00 AM'],
    ['formatTime(PlainDateTime)', () => formatTime(pdt, ny), '9:00 AM'],
    ['formatTime(ZonedDateTime) in its own zone', () => formatTime(zdt, ny), '9:00 AM'],
    ['formatDateTime(PlainDateTime)', () => formatDateTime(pdt, ny), 'Mar 5, 2026, 9:00 AM'],
    ['formatDateTime(ZonedDateTime) ignores timeZone', () => formatDateTime(zdt, ny), 'Mar 5, 2026, 9:00 AM'],
    ['formatDateTime(Instant)', () => formatDateTime(inst, ny), 'Mar 4, 2026, 7:00 PM'],
    ['a year below 100', () => formatDate(Temporal.PlainDate.from('0045-01-02'), ny), 'Jan 2, 45'],
    ['a Hebrew-calendar PlainDate defaults to its calendar', () => formatDate(pd.withCalendar('hebrew'), ny), '17 Iyar 5750'],
    ['an explicit calendar wins', () => formatDate(pd.withCalendar('hebrew'), { ...ny, calendar: 'gregory' }), 'May 12, 1990'],
    ['an explicit undefined calendar keeps the value\u2019s', () => formatDate(pd.withCalendar('hebrew'), { ...ny, calendar: undefined }), '17 Iyar 5750'],
  ])('%s', (_label, run, expected) => {
    expect(run()).toBe(expected)
  })

  it.each([
    ['formatDate(PlainTime)', () => formatDate(pt, ny)],
    ['formatTime(PlainDate)', () => formatTime(pd, ny)],
    ['formatDateTime(PlainDate)', () => formatDateTime(pd, ny)],
    ['formatDateTime(PlainTime)', () => formatDateTime(pt, ny)],
    ['formatDate(PlainYearMonth)', () => formatDate(Temporal.PlainYearMonth.from('2026-03') as never, ny)],
    ['formatDate(Duration)', () => formatDate(Temporal.Duration.from({ days: 1 }) as never, ny)],
    ['a PlainDate with a time field', () => formatDate(pd, { ...ny, hour: 'numeric' })],
    ['a PlainTime with a date field', () => formatTime(pt, { ...ny, dateStyle: 'full' })],
    ['timeZoneName on a plain value', () => formatDateTime(pdt, { ...ny, timeZoneName: 'short' })],
    ['a malformed Temporal-tagged object', () => formatDate({ [Symbol.toStringTag]: 'Temporal.PlainDate' } as never, ny)],
  ])('%s is invalid: empty string and a warning', (_label, run) => {
    expect(run()).toBe('')
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('timeZoneName on a ZonedDateTime names its own zone', () => {
    expect(formatTime(zdt, { locale: 'en-US', timeZone: 'UTC', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })).toBe('9:00 AM GMT+9')
  })
})

describe('Temporal ranges', () => {
  it('formats a PlainDate pair as calendar dates', () => {
    expect(formatDateRange(Temporal.PlainDate.from('2026-03-05'), Temporal.PlainDate.from('2026-03-09'), ny)).toBe(
      'Mar 5\u2009\u2013\u20099, 2026',
    )
  })
  it('renders a zoned pair in the start\u2019s zone', () => {
    const end = Temporal.ZonedDateTime.from('2026-03-05T12:00[Europe/London]') // 21:00 in Tokyo
    expect(formatDateRange(zdt, end, { ...ny, timeStyle: 'short' })).toBe('9:00\u202fAM\u2009\u2013\u20099:00\u202fPM')
  })
  it('rejects mixed classes', () => {
    expect(formatDateRange(pd, inst, ny)).toBe('')
  })
  it('defaults a PlainTime pair to a short time range', () => {
    expect(formatDateRange(pt, Temporal.PlainTime.from('17:00'), ny)).toBe('9:00\u202fAM\u2009\u2013\u20095:00\u202fPM')
  })
  it('rejects a PlainTime pair with a date style', () => {
    expect(formatDateRange(pt, Temporal.PlainTime.from('17:00'), { ...ny, dateStyle: 'medium' })).toBe('')
    expect(console.warn).toHaveBeenCalledTimes(1)
  })
  it('rejects a PlainDate pair with a time field', () => {
    expect(formatDateRange(pd, pd, { ...ny, hour: 'numeric' })).toBe('')
    expect(console.warn).toHaveBeenCalledTimes(1)
  })
})

describe('Temporal relative and duration', () => {
  it('formatRelative takes an Instant and a ZonedDateTime', () => {
    expect(formatRelative(inst, { locale: 'en-US', now: zdt.add({ hours: 3 }) as never })).toBe('3 hours ago')
  })
  it('formatRelative rejects a plain value, including a date-only string', () => {
    expect(formatRelative(pd, { locale: 'en-US', now: inst })).toBe('')
    expect(formatRelative('1990-05-12', { locale: 'en-US', now: inst })).toBe('')
  })
  it('formatRelative rejects a plain now', () => {
    expect(formatRelative(inst, { locale: 'en-US', now: pd })).toBe('')
  })
  it('formatDuration rejects another Temporal class', () => {
    expect(formatDuration(pd as never, { locale: 'en-US' })).toBe('')
  })
  it('formatDuration takes a Temporal.Duration and folds sub-second fields into seconds', () => {
    expect(formatDuration(Temporal.Duration.from({ hours: 2, milliseconds: 500 }), { locale: 'en-US' })).toBe('2 hr, 0.5 sec')
  })
  it('formatDuration rejects a negative Temporal.Duration', () => {
    expect(formatDuration(Temporal.Duration.from({ hours: -2 }), { locale: 'en-US' })).toBe('')
  })
})

describe('calendar dates do not depend on the process zone', () => {
  // Perturbation: drop `zone: 'UTC'` from the PlainDate branch of resolveInput and
  // pass no timeZone override; the Los Angeles case must then read May 11.
  it.each(['America/Los_Angeles', 'Pacific/Kiritimati'])('renders the same day under TZ=%s', (zone) => {
    const saved = process.env.TZ
    process.env.TZ = zone
    try {
      expect(formatDate(pd, { locale: 'en-US', timeZone: zone })).toBe('May 12, 1990')
      expect(formatDate('1990-05-12', { locale: 'en-US', timeZone: zone })).toBe('May 12, 1990')
    } finally {
      if (saved === undefined) delete process.env.TZ
      else process.env.TZ = saved
    }
  })
})
