import {
  guard,
  isFiniteNumber,
  toTimestamp,
  type DateInput,
  type LocaleOptions,
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

export function formatDate(value: DateInput | null | undefined, options: DateFormatOptions): string {
  const ts = toTimestamp(value)
  return guard('formatDate', value, ts === undefined, () => {
    const [locale, opts] = resolve(options, { dateStyle: 'medium' })
    return new Intl.DateTimeFormat(locale, opts).format(ts!)
  })
}

export function formatTime(value: DateInput | null | undefined, options: DateFormatOptions): string {
  const ts = toTimestamp(value)
  return guard('formatTime', value, ts === undefined, () => {
    const [locale, opts] = resolve(options, { timeStyle: 'short' })
    return new Intl.DateTimeFormat(locale, opts).format(ts!)
  })
}

export function formatDateTime(value: DateInput | null | undefined, options: DateFormatOptions): string {
  const ts = toTimestamp(value)
  return guard('formatDateTime', value, ts === undefined, () => {
    const [locale, opts] = resolve(options, { dateStyle: 'medium', timeStyle: 'short' })
    return new Intl.DateTimeFormat(locale, opts).format(ts!)
  })
}

export function formatDateRange(
  start: DateInput | null | undefined,
  end: DateInput | null | undefined,
  options: DateFormatOptions,
): string {
  const a = toTimestamp(start)
  const b = toTimestamp(end)
  return guard('formatDateRange', `${String(start)} - ${String(end)}`, a === undefined || b === undefined, () => {
    const [locale, opts] = resolve(options, { dateStyle: 'medium' })
    return new Intl.DateTimeFormat(locale, opts).formatRange(a!, b!)
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
 */
export function formatRelative(value: DateInput | null | undefined, options: RelativeOptions): string {
  const ts = toTimestamp(value)
  const now = toTimestamp(options.now)
  return guard('formatRelative', value, ts === undefined || now === undefined, () => {
    const diff = ts! - now!
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

/**
 * Composed from NumberFormat and ListFormat, never from Intl.DurationFormat:
 * that API is missing on Node 22, and output must not differ by runtime.
 */
export function formatDuration(duration: Duration | null | undefined, options: DurationOptions): string {
  const present = duration
    ? DURATION_UNITS.flatMap(([key, unit]) => {
        const amount = duration[key]
        return amount === undefined ? [] : [{ unit, amount }]
      })
    : []
  const bad = !duration || present.some(({ amount }) => !isFiniteNumber(amount) || amount < 0)
  return guard('formatDuration', duration, bad, () => {
    const style = options.style ?? 'short'
    const parts = present.filter(({ amount }) => amount !== 0)
    if (parts.length === 0) parts.push({ unit: 'second', amount: 0 })
    const pieces = parts.map(({ unit, amount }) =>
      new Intl.NumberFormat(options.locale, { style: 'unit', unit, unitDisplay: style }).format(amount),
    )
    return new Intl.ListFormat(options.locale, { type: 'unit', style }).format(pieces)
  })
}
