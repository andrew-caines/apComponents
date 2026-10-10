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

describe('date-only strings', () => {
  // A date-only ISO string is UTC midnight, so zones west of UTC show the previous day.
  it('shows the previous day west of UTC', () => {
    expect(formatDate('1990-05-12', { locale: 'en-US', timeZone: 'America/New_York' })).toBe('May 11, 1990')
  })
  it('shows the same day with timeZone UTC', () => {
    expect(formatDate('1990-05-12', { locale: 'en-US', timeZone: 'UTC' })).toBe('May 12, 1990')
  })
})
