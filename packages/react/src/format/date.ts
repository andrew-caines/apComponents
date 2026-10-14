import {
  guard,
  isFiniteNumber,
  temporalKind,
  toInstant,
  type DateInput,
  type LocaleOptions,
  type ResolvedDate,
  type TemporalDuration,
  type ZonedOptions,
} from './shared.js'

export type DateFormatOptions = ZonedOptions & Omit<Intl.DateTimeFormatOptions, 'timeZone'>

// Intl throws if a style (dateStyle/timeStyle) is mixed with a component
// option, and that is how a caller asks for { month: 'long' } alone. So the
// style defaults apply only when the caller named none of these. timeZoneName
// counts too: Intl rejects it beside timeStyle. hour12 and hourCycle do not,
// they combine with a style.
const COMPONENT_KEYS = [
  'dateStyle',
  'timeStyle',
  'weekday',
  'era',
  'year',
  'month',
  'day',
  'dayPeriod',
  'hour',
  'minute',
  'second',
  'fractionalSecondDigits',
  'timeZoneName',
] as const

function resolve(
  options: DateFormatOptions,
  defaults: Intl.DateTimeFormatOptions,
): [string, Intl.DateTimeFormatOptions] {
  const { locale, ...rest } = options
  const callerPicked = COMPONENT_KEYS.some((key) => rest[key] !== undefined)
  return [locale, callerPicked ? rest : { ...defaults, ...rest }]
}

const TIME_KEYS = ['timeStyle', 'hour', 'minute', 'second', 'fractionalSecondDigits', 'dayPeriod'] as const
const DATE_KEYS = ['dateStyle', 'weekday', 'era', 'year', 'month', 'day'] as const

/**
 * True when the options ask a plain value for something it does not hold: a
 * time of a PlainDate, a date of a PlainTime, or a zone name of either. Intl
 * would print a midnight, a 1 January 1970 or 'UTC'. Temporal's own
 * toLocaleString throws for the same cases.
 */
function asksForMissing(r: ResolvedDate, options: DateFormatOptions): boolean {
  if (r.plain === undefined) return false
  if (options.timeZoneName !== undefined) return true
  if (r.plain === 'date') return TIME_KEYS.some((k) => options[k] !== undefined)
  if (r.plain === 'time') return DATE_KEYS.some((k) => options[k] !== undefined)
  return false
}

/**
 * The resolved value's zone overrides the caller's: 'UTC' renders a plain
 * value's wall time, and a ZonedDateTime keeps its own zone. Its calendar is
 * the default; an explicit calendar wins.
 */
function intlOptions(r: ResolvedDate, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  const calendar = opts.calendar ?? r.calendar
  return {
    ...opts,
    ...(calendar !== undefined ? { calendar } : {}),
    ...(r.zone !== undefined ? { timeZone: r.zone } : {}),
  }
}

/**
 * Formats the date part.
 *
 * A PlainDate, or a date-only ISO string such as '1990-05-12', is a calendar
 * date: it renders as that day in every zone. A ZonedDateTime renders in its
 * own zone and ignores `timeZone`. To show it in the reader's zone, format
 * `zdt.toInstant()`, which follows the two-pass rule; `withTimeZone(zone)` is for
 * a fixed zone that is known on the server too. An Instant, a Date, a number or a timestamp string renders in
 * `timeZone`.
 */
export function formatDate(value: DateInput | null | undefined, options: DateFormatOptions): string {
  const r = toInstant(value)
  return guard('formatDate', value, r === undefined || r.plain === 'time' || asksForMissing(r, options), () => {
    const [locale, opts] = resolve(options, { dateStyle: 'medium' })
    return new Intl.DateTimeFormat(locale, intlOptions(r!, opts)).format(r!.ms)
  })
}

/**
 * Formats the time of day. Passing only `timeZoneName` switches off the time default,
 * so `Intl` fills in its default date fields. To get a time with a zone name, pass
 * `hour` and `minute` too.
 *
 * A PlainTime or PlainDateTime renders its wall time. A ZonedDateTime renders
 * in its own zone and ignores `timeZone`. A PlainDate or a date-only string has
 * no time and is invalid.
 */
export function formatTime(value: DateInput | null | undefined, options: DateFormatOptions): string {
  const r = toInstant(value)
  return guard('formatTime', value, r === undefined || r.plain === 'date' || asksForMissing(r, options), () => {
    const [locale, opts] = resolve(options, { timeStyle: 'short' })
    return new Intl.DateTimeFormat(locale, intlOptions(r!, opts)).format(r!.ms)
  })
}

/**
 * Formats the date and time. A PlainDateTime renders its wall time, and a
 * ZonedDateTime renders in its own zone and ignores `timeZone`. A PlainDate, a
 * PlainTime or a date-only string lacks half of the output and is invalid.
 */
export function formatDateTime(value: DateInput | null | undefined, options: DateFormatOptions): string {
  const r = toInstant(value)
  const bad = r === undefined || r.plain === 'date' || r.plain === 'time' || asksForMissing(r, options)
  return guard('formatDateTime', value, bad, () => {
    const [locale, opts] = resolve(options, { dateStyle: 'medium', timeStyle: 'short' })
    return new Intl.DateTimeFormat(locale, intlOptions(r!, opts)).format(r!.ms)
  })
}

/**
 * Formats a start and end as a range. Both ends must be the same kind of
 * value: two calendar dates, two plain date-times, two plain times, or two
 * instants (ZonedDateTime, Instant, Date, number, timestamp string). A range
 * renders in one zone, the start's: a ZonedDateTime start brings its own, while
 * an Instant or Date start uses `timeZone`, so a mixed instant-like pair renders in
 * the start's zone.
 */
export function formatDateRange(
  start: DateInput | null | undefined,
  end: DateInput | null | undefined,
  options: DateFormatOptions,
): string {
  const a = toInstant(start)
  const b = toInstant(end)
  const bad = a === undefined || b === undefined || a.plain !== b.plain || asksForMissing(a, options)
  return guard('formatDateRange', `${String(start)} - ${String(end)}`, bad, () => {
    const defaults: Intl.DateTimeFormatOptions = a!.plain === 'time' ? { timeStyle: 'short' } : { dateStyle: 'medium' }
    const [locale, opts] = resolve(options, defaults)
    return new Intl.DateTimeFormat(locale, intlOptions(a!, opts)).formatRange(a!.ms, b!.ms)
  })
}

export interface RelativeOptions extends LocaleOptions {
  now: DateInput
  numeric?: 'auto' | 'always' | undefined
  style?: Intl.RelativeTimeFormatStyle | undefined
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * `now` is a required input, never read from the clock, so the same props
 * give the same string on the server and in the browser.
 *
 * Takes an Instant or a ZonedDateTime for `value` and `now`. A PlainDate,
 * PlainDateTime, PlainTime or date-only string is invalid.
 */
export function formatRelative(value: DateInput | null | undefined, options: RelativeOptions): string {
  const r = toInstant(value)
  const n = toInstant(options.now)
  // Relative time between calendar dates is calendar arithmetic, out of scope:
  // a plain value (including a date-only string) is invalid here.
  const bad = r === undefined || n === undefined || r.plain !== undefined || n.plain !== undefined
  return guard('formatRelative', value, bad, () => {
    const diff = r!.ms - n!.ms
    const abs = Math.abs(diff)
    const days = diff / DAY
    let unit: Intl.RelativeTimeFormatUnit
    let amount: number
    if (abs < MINUTE) [unit, amount] = ['second', diff / SECOND]
    else if (abs < HOUR) [unit, amount] = ['minute', diff / MINUTE]
    else if (abs < DAY) [unit, amount] = ['hour', diff / HOUR]
    else if (abs < 7 * DAY) [unit, amount] = ['day', days]
    else if (abs < 30 * DAY) [unit, amount] = ['week', days / 7]
    else if (abs < 365 * DAY) [unit, amount] = ['month', days / 30.4375]
    else [unit, amount] = ['year', days / 365.25]
    const formatter = new Intl.RelativeTimeFormat(options.locale, {
      numeric: options.numeric ?? 'auto',
      ...(options.style !== undefined ? { style: options.style } : {}),
    })
    // Adding zero turns a rounded negative zero into zero.
    return formatter.format(Math.round(amount) + 0, unit)
  })
}

export interface Duration {
  years?: number | undefined
  months?: number | undefined
  weeks?: number | undefined
  days?: number | undefined
  hours?: number | undefined
  minutes?: number | undefined
  seconds?: number | undefined
}

export interface DurationOptions extends LocaleOptions {
  style?: 'long' | 'short' | 'narrow' | undefined
}

const DURATION_UNITS = [
  ['years', 'year'],
  ['months', 'month'],
  ['weeks', 'week'],
  ['days', 'day'],
  ['hours', 'hour'],
  ['minutes', 'minute'],
  ['seconds', 'second'],
] as const

/** Temporal.Duration's fields, with the sub-second ones folded into fractional seconds. */
function fromTemporalDuration(d: TemporalDuration): Duration | undefined {
  if (d.sign === -1) return undefined
  const seconds = d.seconds + d.milliseconds / 1e3 + d.microseconds / 1e6 + d.nanoseconds / 1e9
  return { years: d.years, months: d.months, weeks: d.weeks, days: d.days, hours: d.hours, minutes: d.minutes, seconds }
}

/**
 * Composed from NumberFormat and ListFormat, never from Intl.DurationFormat:
 * that API is missing on Node 22, and output must not differ by runtime.
 * Takes a Temporal.Duration too; a negative one is invalid, as a negative
 * field already is.
 */
export function formatDuration(input: Duration | TemporalDuration | null | undefined, options: DurationOptions): string {
  const kind = temporalKind(input)
  const duration = kind === 'Duration' ? fromTemporalDuration(input as TemporalDuration) : kind === undefined ? (input as Duration | null | undefined) : undefined
  const present = duration
    ? DURATION_UNITS.flatMap(([key, unit]) => {
        const amount = duration[key]
        return amount === undefined ? [] : [{ unit, amount }]
      })
    : []
  const bad = !duration || present.some(({ amount }) => !isFiniteNumber(amount) || amount < 0)
  return guard('formatDuration', input, bad, () => {
    const style = options.style ?? 'short'
    const parts = present.filter(({ amount }) => amount !== 0)
    if (parts.length === 0) parts.push({ unit: 'second', amount: 0 })
    const pieces = parts.map(({ unit, amount }) =>
      new Intl.NumberFormat(options.locale, { style: 'unit', unit, unitDisplay: style }).format(amount),
    )
    return new Intl.ListFormat(options.locale, { type: 'unit', style }).format(pieces)
  })
}
