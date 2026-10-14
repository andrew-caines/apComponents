// Shared helpers for the format functions. Pure: no React, no client
// directive, no clock reads. The determinism gate enforces that for this
// whole directory.

export interface LocaleOptions {
  locale: string
}

export interface ZonedOptions extends LocaleOptions {
  timeZone: string
}

interface TemporalBase<Tag extends string> {
  readonly [Symbol.toStringTag]: Tag
  toString(options?: object): string
}

interface IsoDate {
  readonly year: number
  readonly month: number
  readonly day: number
}
interface IsoTime {
  readonly hour: number
  readonly minute: number
  readonly second: number
  readonly millisecond: number
}

/** The members of `Temporal.PlainDate` the formatters read. A native or polyfill value fits. */
export interface TemporalPlainDate extends TemporalBase<'Temporal.PlainDate'> {
  readonly calendarId: string
  withCalendar(calendar: 'iso8601'): IsoDate
}
export interface TemporalPlainDateTime extends TemporalBase<'Temporal.PlainDateTime'> {
  readonly calendarId: string
  withCalendar(calendar: 'iso8601'): IsoDate & IsoTime
}
export interface TemporalPlainTime extends TemporalBase<'Temporal.PlainTime'>, IsoTime {}
export interface TemporalZonedDateTime extends TemporalBase<'Temporal.ZonedDateTime'> {
  readonly epochMilliseconds: number
  readonly timeZoneId: string
  readonly calendarId: string
}
export interface TemporalInstant extends TemporalBase<'Temporal.Instant'> {
  readonly epochMilliseconds: number
}
export interface TemporalDuration extends TemporalBase<'Temporal.Duration'> {
  readonly sign: -1 | 0 | 1
  readonly years: number
  readonly months: number
  readonly weeks: number
  readonly days: number
  readonly hours: number
  readonly minutes: number
  readonly seconds: number
  readonly milliseconds: number
  readonly microseconds: number
  readonly nanoseconds: number
}

export type TemporalDateLike =
  | TemporalPlainDate
  | TemporalPlainDateTime
  | TemporalPlainTime
  | TemporalZonedDateTime
  | TemporalInstant

export type DateInput = Date | number | string | TemporalDateLike

export type TemporalKind = 'PlainDate' | 'PlainDateTime' | 'PlainTime' | 'ZonedDateTime' | 'Instant' | 'Duration' | 'other'

const TEMPORAL_TAG = /^\[object Temporal\.(\w+)\]$/
const KNOWN_KINDS: ReadonlySet<string> = new Set(['PlainDate', 'PlainDateTime', 'PlainTime', 'ZonedDateTime', 'Instant', 'Duration'])

/**
 * Which Temporal type a value is, read from its `Symbol.toStringTag`, so the
 * native API and the polyfill are recognised alike. Never reads the Temporal
 * global: the library runs where none exists. `'other'` is a Temporal type the
 * formatters do not take (PlainYearMonth, PlainMonthDay).
 */
export function temporalKind(value: unknown): TemporalKind | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const match = TEMPORAL_TAG.exec(Object.prototype.toString.call(value))
  if (!match) return undefined
  return KNOWN_KINDS.has(match[1]!) ? (match[1] as TemporalKind) : 'other'
}

/**
 * An input resolved for `Intl`. `zone`, when present, overrides the caller's
 * time zone: 'UTC' for a value with no zone of its own (rendered as its wall
 * time), or a ZonedDateTime's own zone. `plain` says which fields the value
 * holds. `calendar` is a non-ISO calendar the value was created in.
 */
export interface ResolvedDate {
  ms: number
  zone?: string
  plain?: 'date' | 'datetime' | 'time'
  calendar?: string
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

// From ISO fields, read as UTC wall time. Not Date.UTC: it maps the years 0-99 to 19xx.
function utcMs(year: number, month: number, day: number, time?: IsoTime): number {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(time?.hour ?? 0, time?.minute ?? 0, time?.second ?? 0, time?.millisecond ?? 0)
  return date.getTime()
}

const nonIso = (calendarId: string) => (calendarId === 'iso8601' ? {} : { calendar: calendarId })

function resolveInput(value: DateInput): ResolvedDate | undefined {
  switch (temporalKind(value)) {
    case 'PlainDate': {
      const v = value as TemporalPlainDate
      const iso = v.withCalendar('iso8601')
      return { ms: utcMs(iso.year, iso.month, iso.day), zone: 'UTC', plain: 'date', ...nonIso(v.calendarId) }
    }
    case 'PlainDateTime': {
      const v = value as TemporalPlainDateTime
      const iso = v.withCalendar('iso8601')
      return { ms: utcMs(iso.year, iso.month, iso.day, iso), zone: 'UTC', plain: 'datetime', ...nonIso(v.calendarId) }
    }
    case 'PlainTime':
      return { ms: utcMs(1970, 1, 1, value as TemporalPlainTime), zone: 'UTC', plain: 'time' }
    case 'ZonedDateTime': {
      const v = value as TemporalZonedDateTime
      return { ms: v.epochMilliseconds, zone: v.timeZoneId, ...nonIso(v.calendarId) }
    }
    case 'Instant':
      return { ms: (value as TemporalInstant).epochMilliseconds }
    case 'Duration':
    case 'other':
      return undefined
    case undefined:
      break
  }
  const plain = value as Date | number | string
  if (typeof plain === 'string') {
    const m = DATE_ONLY.exec(plain)
    if (m) {
      const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
      const ms = utcMs(y, mo, d)
      const back = new Date(ms)
      // No roll-over: 2026-02-30 is not 2 March.
      if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return undefined
      return { ms, zone: 'UTC', plain: 'date' }
    }
  }
  return { ms: plain instanceof Date ? plain.getTime() : new Date(plain).getTime() }
}

/**
 * Resolves any date input, or undefined when it is not a valid date. A
 * date-only ISO string ('1990-05-12') is a calendar date, like a PlainDate,
 * not the UTC midnight ECMAScript reads it as. Never throws: a malformed
 * Temporal-tagged object is invalid input, not a crash.
 */
export function toInstant(value: DateInput | null | undefined): ResolvedDate | undefined {
  // Not a truthiness check: the epoch (0) is a valid instant.
  if (value === null || value === undefined) return undefined
  try {
    const resolved = resolveInput(value)
    return resolved !== undefined && Number.isFinite(resolved.ms) ? resolved : undefined
  } catch {
    return undefined
  }
}

/** Milliseconds since the epoch, or undefined when the input is not a valid date. */
export function toTimestamp(value: DateInput | null | undefined): number | undefined {
  return toInstant(value)?.ms
}

/**
 * Text for `<time dateTime>`: Temporal's own ISO form without the calendar
 * or zone-name annotations, which that attribute does not accept. A
 * ZonedDateTime keeps its offset. '' for an invalid input.
 */
export function toIsoString(value: DateInput | null | undefined): string {
  const resolved = toInstant(value)
  if (resolved === undefined) return ''
  try {
    switch (temporalKind(value)) {
      case 'PlainDate':
      case 'PlainDateTime':
        return (value as TemporalPlainDate).toString({ calendarName: 'never' })
      case 'ZonedDateTime':
        return (value as TemporalZonedDateTime).toString({ timeZoneName: 'never', calendarName: 'never' })
      case 'PlainTime':
      case 'Instant':
        return (value as TemporalInstant).toString()
      default:
        return resolved.plain === 'date' ? (value as string) : new Date(resolved.ms).toISOString()
    }
  } catch {
    return ''
  }
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

// Names already warned about. Module scope on purpose: one warning per
// formatter for the life of the page, not one per call in a render loop.
const warned = new Set<string>()

/** Clears the warn-once registry. For tests only; not exported from the barrel. */
export function resetFormatWarningsForTests(): void {
  warned.clear()
}

export function warnOnce(name: string, value: unknown, reason: string, outcome = 'returning an empty string'): void {
  // A bare process.env.NODE_ENV check, never guarded by a typeof check on
  // process: that is the reference bundlers replace (see
  // components/Select/Select.tsx for why).
  if (process.env.NODE_ENV === 'production' || warned.has(name)) return
  warned.add(name)
  let shown: string
  try {
    shown = String(value)
  } catch {
    shown = Object.prototype.toString.call(value)
  }
  console.warn(`[@ap/react/format] ${name}: ${reason} (${shown}); ${outcome}.`)
}

/**
 * Runs `fn`; returns '' if it throws or if `bad` is true. In development,
 * warns once per formatter name with the offending value.
 */
export function guard(name: string, value: unknown, bad: boolean, fn: () => string): string {
  if (bad) {
    warnOnce(name, value, 'invalid input')
    return ''
  }
  try {
    return fn()
  } catch (error) {
    // Intl throws RangeError for a malformed locale or an unknown time zone.
    warnOnce(name, value, error instanceof Error ? error.message : 'formatting failed')
    return ''
  }
}
