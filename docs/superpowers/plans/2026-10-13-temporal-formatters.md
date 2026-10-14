# Temporal in the Formatters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The date formatters and `useFormatter` accept Temporal values and format each one by what it means. A `PlainDate` never shifts by a day, and a `ZonedDateTime` keeps its own zone. A date-only ISO string becomes a calendar date.

**Architecture:**
- `format/shared.ts` turns every date input into `{ ms, zone?, plain?, calendar? }`. It recognises Temporal objects by `Object.prototype.toString` and never through `globalThis.Temporal`.
- `format/date.ts` validates the result against each formatter's rules, then formats it on the existing `Intl.DateTimeFormat` path, with the resolved zone and calendar overriding the options.
- The library adds no runtime dependency. `@js-temporal/polyfill` is a root devDependency for the tests, and a dependency of the SSR fixture app.

**Tech Stack:** TypeScript 5.9 (no Temporal lib), Vitest (unit project), React 19, React Router 8 SSR fixture, Playwright, Storybook MDX.

**Spec:** `docs/superpowers/specs/2026-10-13-temporal-support-design.md`

## Global Constraints

- The runtime floor is Node `>=22.22.0`. Library code never reads `globalThis.Temporal`.
- `exactOptionalPropertyTypes` is on, so a conditional key is built with a spread: `...(x !== undefined ? { x } : {})`.
- `format/` stays pure. The determinism gate forbids `Date.now(`, `new Date()` with no arguments, `performance.now(`, `Math.random(`, React imports and `'use client'`. It scans comments too, so write about these in prose rather than as code.
- Invalid input returns `''` and warns once per formatter name, through `guard` and `warnOnce`.
- House style: no semicolons, single quotes, 2-space indent, `.js` import specifiers. **Do not run prettier.**
- Files must be valid UTF-8. Write ` ` and `–` as escapes in tests, as the existing tests do.
- Never use `Date.UTC(y, …)` to build a value from ISO fields. Use `new Date(0)` with `setUTCFullYear` and `setUTCHours`, because `Date.UTC` maps the years 0–99 to 1900–1999.

## Review Focus

1. **A malformed Temporal-tagged object**, one with the right `Symbol.toStringTag` but missing methods, must return `''` and warn, never throw. `toInstant` catches.
2. **A date-only string that doesn't exist on the calendar** (`'2026-02-30'`) is invalid. It must not roll over to 2 March.
3. **A plain value with a field it doesn't hold** must return `''`: a `PlainDate` with `{ hour: 'numeric' }`, or a `PlainTime` with `{ dateStyle: 'full' }`.
4. **A caller's explicit `calendar: undefined`** must not wipe out the value's own calendar, and an explicit `calendar: 'gregory'` must override it.
5. **A non-ISO-calendar PlainDate** has to be read through `withCalendar('iso8601')`. Its own `.month` is a Hebrew month number and would give the wrong day.

Each item is pinned by a test in Task 1 or Task 2.

---

### Task 1: Temporal recognition and conversion in `format/shared.ts`

**Files:**
- Modify: `package.json` (root devDependencies), `package-lock.json`
- Modify: `packages/react/src/format/shared.ts`
- Modify: `packages/react/src/format/index.ts`
- Test: `packages/react/src/format/shared.test.ts`

**Interfaces:**
- Produces:
  - `type TemporalKind = 'PlainDate' | 'PlainDateTime' | 'PlainTime' | 'ZonedDateTime' | 'Instant' | 'Duration' | 'other'`
  - `temporalKind(value: unknown): TemporalKind | undefined`
  - `interface ResolvedDate { ms: number; zone?: string; plain?: 'date' | 'datetime' | 'time'; calendar?: string }`
  - `toInstant(value: DateInput | null | undefined): ResolvedDate | undefined`
  - `toIsoString(value: DateInput | null | undefined): string`
  - the types `TemporalPlainDate`, `TemporalPlainDateTime`, `TemporalPlainTime`, `TemporalZonedDateTime`, `TemporalInstant`, `TemporalDuration` and `TemporalDateLike`
  - `DateInput = Date | number | string | TemporalDateLike`
  - `toTimestamp(value)` is kept, as `toInstant(value)?.ms`

- [ ] **Step 1: Install the polyfill as a root devDependency**

Run: `npm install --save-dev @js-temporal/polyfill@0.5.1`
Expected: `package.json` devDependencies gain `"@js-temporal/polyfill": "^0.5.1"`, and the lockfile updates.

- [ ] **Step 2: Write the failing tests** (append to `shared.test.ts`, and extend its import line)

```ts
import { Temporal } from '@js-temporal/polyfill'
import { guard, resetFormatWarningsForTests, temporalKind, toInstant, toIsoString, toTimestamp } from './shared.js'

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
```

- [ ] **Step 3: Run the tests to make sure they fail**

Run: `npm test -- packages/react/src/format/shared.test.ts`
Expected: FAIL, because `temporalKind`, `toInstant` and `toIsoString` are not exported.

- [ ] **Step 4: Implement them in `shared.ts`.** Replace the `DateInput` line and `toTimestamp`.

```ts
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
```

- [ ] **Step 5: Export the new types from `format/index.ts`.** Replace the `shared.js` type line.

```ts
export type {
  DateInput,
  LocaleOptions,
  TemporalDateLike,
  TemporalDuration,
  TemporalInstant,
  TemporalPlainDate,
  TemporalPlainDateTime,
  TemporalPlainTime,
  TemporalZonedDateTime,
  ZonedOptions,
} from './shared.js'
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npm test -- packages/react/src/format/shared.test.ts && npm run typecheck`
Expected: PASS, and tsc exits 0. The existing `toTimestamp` tests still pass. `date.ts` still reads only `ms`, so `date.test.ts` is unchanged until Task 2.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json packages/react/src/format/shared.ts packages/react/src/format/shared.test.ts packages/react/src/format/index.ts
git commit -m "feat(format): recognise and resolve Temporal date inputs"
```

---

### Task 2: Formatter rules for Temporal values in `format/date.ts`

**Files:**
- Modify: `packages/react/src/format/date.ts`
- Test: `packages/react/src/format/date.test.ts`

**Interfaces:**
- Consumes (from Task 1): `toInstant`, `temporalKind`, `ResolvedDate`, `TemporalDuration`, `DateInput`
- Produces: the same exported signatures, except `formatDuration(duration: Duration | TemporalDuration | null | undefined, options: DurationOptions): string`

- [ ] **Step 1: Write the failing tests.** Add the import `import { Temporal } from '@js-temporal/polyfill'` and **replace** the `describe('date-only strings', …)` block at the end of `date.test.ts` with:

```ts
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
    ['an explicit undefined calendar keeps the value’s', () => formatDate(pd.withCalendar('hebrew'), { ...ny, calendar: undefined }), '17 Iyar 5750'],
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
      'Mar 5 – 9, 2026',
    )
  })
  it('renders a zoned pair in the start’s zone', () => {
    const end = Temporal.ZonedDateTime.from('2026-03-05T12:00[Europe/London]') // 21:00 in Tokyo
    expect(formatDateRange(zdt, end, { ...ny, timeStyle: 'short' })).toBe('9:00 AM – 9:00 PM')
  })
  it('rejects mixed classes', () => {
    expect(formatDateRange(pd, inst, ny)).toBe('')
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
```

The `zdt.add(...) as never` cast is needed because `RelativeOptions.now` is `DateInput`, and the polyfill's class type is checked structurally against `TemporalZonedDateTime`. If tsc accepts it without the cast, drop the cast.

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `npm test -- packages/react/src/format/date.test.ts`
Expected: FAIL. `date.ts` still reads only `ms` and ignores `zone`, so `formatDate('1990-05-12', ny)` gives 'May 11, 1990'. Several invalid-kind cases also return non-empty strings.

- [ ] **Step 3: Implement.** In `date.ts`, change the imports and add the helpers below `resolve`.

```ts
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
```

```ts
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
```

Then rewrite the four Intl formatters:

```ts
/**
 * Formats the date part.
 *
 * A PlainDate, or a date-only ISO string such as '1990-05-12', is a calendar
 * date: it renders as that day in every zone. A ZonedDateTime renders in its
 * own zone and ignores `timeZone`; convert it first with `withTimeZone` to show
 * it elsewhere. An Instant, a Date, a number or a timestamp string renders in
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
 * renders in one zone, the start's: a ZonedDateTime start brings its own.
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
    const [locale, opts] = resolve(options, { dateStyle: 'medium' })
    return new Intl.DateTimeFormat(locale, intlOptions(a!, opts)).formatRange(a!.ms, b!.ms)
  })
}
```

In `formatRelative`, replace the first three lines of the body:

```ts
  const r = toInstant(value)
  const n = toInstant(options.now)
  // Relative time between calendar dates is calendar arithmetic, out of scope:
  // a plain value (including a date-only string) is invalid here.
  const bad = r === undefined || n === undefined || r.plain !== undefined || n.plain !== undefined
  return guard('formatRelative', value, bad, () => {
    const diff = r!.ms - n!.ms
```

Update its JSDoc to add: "Takes an Instant or a ZonedDateTime for `value` and `now`. A PlainDate, PlainDateTime, PlainTime or date-only string is invalid."

For `formatDuration`, add this helper above it and change the head of the function:

```ts
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
```

Keep the rest of the body. Change the `guard` call's value argument from `duration` to `input`, so the warning shows what the caller passed.

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `npm test -- packages/react/src/format`
Expected: PASS. Every existing `date.test.ts` case still passes. The zoned-range expectation was checked on Node 24.19 / ICU: `formatRange` puts U+202F before AM and PM, whereas the single `formatTime` output uses a plain space. If CI's ICU differs, match its exact code points (print with `JSON.stringify`). The behaviour asserted, 9:00 to 21:00 in Tokyo, must not change.

- [ ] **Step 5: Run the perturbation from the TZ test's comment.** Apply it, confirm the Los Angeles case fails, then revert it.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: exit 0.

```bash
git add packages/react/src/format/date.ts packages/react/src/format/date.test.ts
git commit -m "feat(format): format Temporal values by their own semantics"
```

---

### Task 3: `useFormatter` with Temporal values

**Files:**
- Modify: `packages/react/src/hooks/useFormatter.ts`
- Test: `packages/react/src/hooks/useFormatter.test.tsx`, `packages/react/src/hooks/useFormatter.ssr.test.tsx`

**Interfaces:**
- Consumes: `toIsoString` (Task 1) and the widened formatter signatures (Task 2)
- Produces: no new names. `isoFor` delegates to `toIsoString`.

- [ ] **Step 1: Write the failing tests.** In `useFormatter.test.tsx`, import `Temporal` from `@js-temporal/polyfill`, and add inside `describe('useFormatter inside a provider', …)`. The wrapper there binds `Asia/Tokyo` and `de-DE`.

```ts
  it('a ZonedDateTime keeps its own zone under the provider zone', () => {
    render(wrap(<Capture />))
    const zdt = Temporal.ZonedDateTime.from('2026-03-05T09:00[America/New_York]')
    expect(f().formatTime(zdt)).toBe('09:00')
  })

  it('a PlainDate is the same day under the provider zone', () => {
    render(wrap(<Capture />))
    expect(f().formatDate(Temporal.PlainDate.from('1990-05-12'))).toBe('12.05.1990')
  })

  it('isoFor gives <time dateTime> text for Temporal values and date-only strings', () => {
    render(wrap(<Capture />))
    expect(f().isoFor(Temporal.ZonedDateTime.from('2026-03-05T09:00[Asia/Tokyo]'))).toBe('2026-03-05T09:00:00+09:00')
    expect(f().isoFor('1990-05-12')).toBe('1990-05-12')
  })
```

Add to `describe('the two-pass date rule', …)`:

```ts
  it('a PlainDate renders the same text on the server, the hydration pass and after', () => {
    stubBrowserZone('Pacific/Honolulu')
    const pd = Temporal.PlainDate.from('1990-05-12')
    function PlainProbe() {
      const { formatDate } = useFormatter()
      const text = formatDate(pd)
      seen.push(text)
      return <span>{text}</span>
    }
    const tree = (
      <LocaleProvider locale="en-US">
        <PlainProbe />
      </LocaleProvider>
    )
    const html = renderToString(tree)
    expect(html).toContain('May 12, 1990')
    const result = hydrate(tree, html)
    expect(result.seen).toEqual(result.seen.map(() => 'May 12, 1990'))
    expect(result.text).toBe('May 12, 1990')
  })
```

`hydrate` sets `seen = []` before hydrating, so the server pass doesn't pollute the array.

In `useFormatter.ssr.test.tsx`, add:

```ts
it('renders a ZonedDateTime in its own zone on the server', () => {
  function ZonedProbe() {
    const { formatDateTime } = useFormatter()
    return <span>{formatDateTime(Temporal.ZonedDateTime.from('2026-03-05T09:00[Asia/Tokyo]'))}</span>
  }
  const html = renderToString(
    <LocaleProvider locale="en-US">
      <ZonedProbe />
    </LocaleProvider>,
  )
  expect(html).toContain('Mar 5, 2026, 9:00 AM')
})
```

Put it inside the existing `describe('useFormatter (server)', …)`, with the import `import { Temporal } from '@js-temporal/polyfill'`.

- [ ] **Step 2: Run the tests to make sure the `isoFor` cases fail**

Run: `npm test -- packages/react/src/hooks/useFormatter`
Expected: the `isoFor` test fails: the ZonedDateTime gives `''` today, and the date-only string gives `'1990-05-12T00:00:00.000Z'`. The other new cases may already pass after Task 2. That is fine, because they pin the hook's wiring.

- [ ] **Step 3: Implement.** In `useFormatter.ts`:
  - Add `toIsoString` to the imports from `'../format/shared.js'`. It is not in the barrel; import it the way `useFormatter.ts` imports the other format modules, by relative path.
  - Replace the `isoFor` body with `isoFor: (v) => toIsoString(v),`.
  - Replace the `Formatter.formatDate` JSDoc paragraph with:

```ts
  /**
   * A PlainDate, or a date-only ISO string such as '1990-05-12', is a calendar
   * date: the same day in every zone, with no UTC-then-local flip. A
   * ZonedDateTime renders in its own zone and ignores the bound zone.
   */
```

  - Add one paragraph to the `useFormatter` JSDoc, after the ADR-0012 paragraph:

```ts
 * Temporal values carry their own meaning and skip the two-pass rule: a
 * PlainDate, PlainDateTime or PlainTime renders its wall time, and a
 * ZonedDateTime its own zone, identically on the server and in the browser.
 * An Instant is an instant and follows the rule like a Date. The app brings
 * Temporal (native or polyfill); the library only recognises it.
```

  - Update the `isoFor` member JSDoc to read: `/** For <time dateTime={isoFor(value)}>: Temporal's ISO form for a Temporal value, the string itself for a date-only string, else the UTC ISO string; '' for an invalid input. */`

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `npm test -- packages/react/src/hooks packages/react/src/format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/hooks/useFormatter.ts packages/react/src/hooks/useFormatter.test.tsx packages/react/src/hooks/useFormatter.ssr.test.tsx
git commit -m "feat(hooks): useFormatter takes Temporal values; isoFor emits their ISO form"
```

---

### Task 4: Gate that keeps the polyfill out of the library

**Files:**
- Create: `packages/react/src/gates/temporal-isolation.gate.test.ts`
- Modify: `package.json` (`test:guards` script)

- [ ] **Step 1: Write the gate**

```ts
import { readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sourceFiles } from './sourceFiles.js'

const SRC = join(import.meta.dirname, '..')
const POLYFILL = '@js-temporal/polyfill'

// Same specifier forms as phone-isolation.gate.test.ts: from, side-effect and dynamic imports.
const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g
const importsPolyfill = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(SPECIFIER_RE)].some((m) => m[1]!.startsWith(POLYFILL))

describe('gate: the Temporal polyfill is test-only (spec decision 1: the app brings Temporal)', () => {
  it('scans the library sources (non-vacuity)', () => {
    const files = sourceFiles(SRC, { extensions: ['.ts', '.tsx'] }).map((f) => relative(SRC, f).split(sep).join('/'))
    expect(files).toContain('format/date.ts')
    expect(files).toContain('format/shared.ts')
  })

  it('tests do import it, so the scan would see one (non-vacuity)', () => {
    const tests = sourceFiles(SRC, { extensions: ['.ts', '.tsx'], includeTests: true }).filter(importsPolyfill)
    expect(tests.length).toBeGreaterThan(0)
  })

  // Perturbation: add `import { Temporal } from '@js-temporal/polyfill'` to format/date.ts.
  it('no non-test source file imports @js-temporal/polyfill', () => {
    const importers = sourceFiles(SRC, { extensions: ['.ts', '.tsx'] })
      .filter(importsPolyfill)
      .map((f) => relative(SRC, f).split(sep).join('/'))
    expect(importers).toEqual([])
  })
})
```

`sourceFiles` takes `{ extensions, excludeDirs?, includeTests? }` (`packages/react/src/gates/sourceFiles.ts:19,38`). `includeTests` defaults to false and also skips `.stories.` files.

- [ ] **Step 2: Add it to `test:guards`.** Append ` packages/react/src/gates/temporal-isolation.gate.test.ts` to the end of the `test:guards` value in the root `package.json`.

- [ ] **Step 3: Run it, then the perturbation**

Run: `npm run test:guards`
Expected: PASS, including the format-determinism gate on the new `shared.ts` and `date.ts`.
Then add the polyfill import to `format/date.ts`, rerun, and expect the last test to FAIL and name `format/date.ts`. Revert the import.

- [ ] **Step 4: Commit**

```bash
git add packages/react/src/gates/temporal-isolation.gate.test.ts package.json
git commit -m "test(gates): keep the Temporal polyfill out of library sources"
```

---

### Task 5: SSR fixture route `/dates` and its hydration and zone tests

**Files:**
- Create: `fixtures/ssr-app/app/routes/dates.tsx`
- Modify: `fixtures/ssr-app/app/routes.ts`, `fixtures/ssr-app/package.json`, `fixtures/ssr-app/package-lock.json`
- Create: `fixtures/ssr-app/e2e/dates.spec.ts`
- Modify: `fixtures/ssr-app/e2e/hydration.spec.ts`

- [ ] **Step 1: Add the polyfill to the fixture app**

Run: `npm --prefix fixtures/ssr-app install @js-temporal/polyfill@0.5.1`
Expected: it is added to `dependencies`, and the fixture lockfile updates. Then run `npm run check:lockfiles` and expect a pass.

- [ ] **Step 2: Create the route.** The Getting started guide quotes the `dates` region (Task 6), so keep fixture-only notes outside it.

```tsx
// The Getting started guide quotes the `dates` region of this file verbatim
// (storybook/docs/GettingStarted.mdx). Keep fixture-only notes OUTSIDE it.
// The ids are for e2e/dates.spec.ts.
// #region docs:dates
import { Temporal } from '@js-temporal/polyfill'
import { ApProvider } from '@ap/react'
import { useFormatter } from '@ap/react/hooks'

const hireDate = Temporal.PlainDate.from('1990-05-12')
const meeting = Temporal.ZonedDateTime.from('2026-03-05T09:00[Asia/Tokyo]')
const published = Temporal.Instant.from('2026-03-05T00:00:00Z')

function Dates() {
  const { formatDate, formatDateTime, isoFor } = useFormatter()
  return (
    <dl>
      <dt>Hired</dt>
      <dd>
        <time id="plain-date" dateTime={isoFor(hireDate)}>{formatDate(hireDate)}</time>
      </dd>
      <dt>Meeting (Tokyo time)</dt>
      <dd>
        <time id="zoned" dateTime={isoFor(meeting)}>{formatDateTime(meeting)}</time>
      </dd>
      <dt>Published (your time)</dt>
      <dd>
        <time id="instant" dateTime={isoFor(published)}>{formatDateTime(published)}</time>
      </dd>
    </dl>
  )
}

export default function DatesRoute() {
  return (
    <ApProvider locale="en-US">
      <main>
        <h1>Dates</h1>
        <Dates />
      </main>
    </ApProvider>
  )
}
// #endregion docs:dates
```

Check that `ApProvider` accepts `locale` without a `timeZone` (`packages/react/src/providers/ApProvider.tsx:39-56` spreads both only when defined). No `timeZone` is passed, so the Instant follows the two-pass rule.

- [ ] **Step 3: Route it in both modes.** In `routes.ts`, after the `start` route:

```ts
  // Temporal values through useFormatter. No loader or action, so routed in both modes.
  route('dates', 'routes/dates.tsx'),
```

- [ ] **Step 4: Write the e2e zone spec** in `e2e/dates.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

// The server renders in Node's zone; the browser runs in the zone set here.
// A PlainDate and a ZonedDateTime must read the same in both zones. The
// Instant is the positive control: it must follow the browser zone, which
// proves the zone setting took effect, so the two equalities cannot pass
// vacuously.
// Perturbation: in routes/dates.tsx pass `new Date('1990-05-12T00:00:00Z')` instead of
// hireDate; Los Angeles then reads May 11, 1990 and this spec fails.
const CASES = [
  { timezoneId: 'America/Los_Angeles', instant: 'Mar 4, 2026, 4:00 PM' },
  { timezoneId: 'Asia/Tokyo', instant: 'Mar 5, 2026, 9:00 AM' },
]

for (const { timezoneId, instant } of CASES) {
  test.describe(`browser zone ${timezoneId}`, () => {
    test.use({ timezoneId })

    test('a PlainDate and a ZonedDateTime render the same; an Instant follows the zone', async ({ page }) => {
      await page.goto('/dates')
      await page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true')
      await expect(page.locator('#plain-date')).toHaveText('May 12, 1990')
      await expect(page.locator('#plain-date')).toHaveAttribute('datetime', '1990-05-12')
      await expect(page.locator('#zoned')).toHaveText('Mar 5, 2026, 9:00 AM')
      await expect(page.locator('#zoned')).toHaveAttribute('datetime', '2026-03-05T09:00:00+09:00')
      await expect(page.locator('#instant')).toHaveText(instant)
    })
  })
}
```

The `toHaveText` matcher normalises whitespace, so a narrow no-break space in the time text still matches.

- [ ] **Step 5: Add a hydration test** to `hydration.spec.ts`, after the getting-started test:

```ts
test('dates route hydrates with no recoverable errors (Temporal values via useFormatter)', async ({ page }) => {
  // Perturbation: render `{typeof window === 'undefined' ? 'server' : 'client'}` inside <main>
  // in routes/dates.tsx; this must fail. (An Instant's UTC-then-local flip is not a mismatch:
  // useFormatter renders the server's text on the hydration pass, so that is not a perturbation.)
  const messages = collect(page)
  await page.goto('/dates')
  await expect(page.locator('#plain-date')).toBeVisible()
  await waitForHydration(page)
  await page.waitForTimeout(200)
  expect(await recoverableErrors(page), 'onRecoverableError fired').toEqual([])
  expect(messages, `unexpected console output:\n${messages.join('\n')}`).toEqual([])
})
```

- [ ] **Step 6: Build the library and run the fixture e2e**

Run: `npm run test:hydration`
Expected: every test passes, including the two `dates.spec.ts` zone cases and the new hydration case. If the fixture needs a fresh build, follow the `fixtures/ssr-app` README or the CI job's steps (`.github/workflows/*.yml`, job that runs `test:hydration`).

- [ ] **Step 7: Run both perturbations** (Step 4's and Step 5's). Confirm each fails, then revert each.

- [ ] **Step 8: Commit**

```bash
git add fixtures/ssr-app
git commit -m "test(fixture): /dates route proves Temporal values are zone-stable through SSR"
```

---

### Task 6: Docs — ADR-0012 amendment and the Getting started section

**Files:**
- Modify: `docs/adr/0012-cross-cutting-services.md` (append)
- Modify: `storybook/docs/GettingStarted.mdx`

- [ ] **Step 1: Append to ADR-0012**

```markdown
## Amendment — 2026-10-13 (Temporal)

The decision above stands. These points are added; the detail is in
`docs/superpowers/specs/2026-10-13-temporal-support-design.md`.

- **The formatters accept Temporal values and bundle nothing.** `PlainDate`, `PlainDateTime`, `PlainTime`, `ZonedDateTime` and `Instant` are `DateInput`s, and `formatDuration` takes a `Temporal.Duration`. The app brings Temporal, native or polyfill. The library recognises a value by its `Symbol.toStringTag` and never reads the Temporal global, so it runs on Node 22 and 24, where there is none. A gate keeps `@js-temporal/polyfill` out of library sources.
- **One formatting path.** Every value resolves to epoch milliseconds plus an optional zone and calendar, and goes through the same `Intl.DateTimeFormat` call as a `Date`. Delegating to `toLocaleString` would give output that depends on which Temporal implementation the app loaded.
- **Each value renders by its meaning.** A plain value renders its wall time, and a `ZonedDateTime` renders in its own zone and ignores `timeZone`, so neither takes part in the two-pass rule. An `Instant` is an instant and does. A plain value asked for a field it does not hold (a PlainDate's time, a PlainTime's date, either's zone name) is invalid input.
- **A date-only ISO string is a calendar date.** `'1990-05-12'` renders as 12 May in every zone. Before this amendment it was UTC midnight, the ECMAScript reading, which shows 11 May west of UTC.
```

- [ ] **Step 2: Add the guide section.** In `GettingStarted.mdx`, add the import below the `startTsx` import:

```mdx
import datesTsx from '../../fixtures/ssr-app/app/routes/dates.tsx?raw'
```

Then insert this section before `## SPA instead of SSR`:

```mdx
## Dates and Temporal

The date formatters, and `useFormatter` from `@ap/react/hooks`, accept
[Temporal](https://tc39.es/proposal-temporal/docs/) values alongside `Date`.
The library does not ship Temporal: use the browser's, or add
`@js-temporal/polyfill` to your app.

<Source language="tsx" code={extractRegion(datesTsx, 'dates')} />

Each value renders by what it means:

- A `PlainDate`, such as a hire date, is the same day for every reader, on
  the server and in the browser. So is a date-only string like `'1990-05-12'`.
- A `ZonedDateTime` renders in its own zone: a 9:00 meeting in Tokyo reads
  9:00 everywhere. To show it in the reader's zone, convert it first with
  `withTimeZone`.
- An `Instant` is a moment, like a `Date`. It renders in UTC on the server and
  in the reader's zone after hydration.

Wrap each one in `<time dateTime={isoFor(value)}>` so the value stays
machine-readable.
```

- [ ] **Step 3: Check the docs references and the Storybook build**

Run: `npx tsx scripts/docs-refs.ts`
Expected: exit 0. The new `dates` region and the external Temporal link resolve. If the script rejects external links, use the link form the other guides use for external URLs.
Run: `npm run test:stories -- --project storybook` only if the docs page has a story test. Otherwise run a local Storybook build with `npm --prefix storybook run build`, and expect it to complete.

- [ ] **Step 4: Commit**

```bash
git add docs/adr/0012-cross-cutting-services.md storybook/docs/GettingStarted.mdx
git commit -m "docs: Temporal values in ADR-0012 and the Getting started guide"
```

---

### Task 7: Verification sweep and PR

- [ ] **Step 1: Run spec §6's checks in order**

| # | Command | Expected |
|---|---|---|
| 1 | `npm run typecheck` | exit 0 |
| 2 | `npm test -- packages/react/src/format packages/react/src/hooks` | all pass |
| 3 | perturbations from Tasks 2, 4 and 5 | each was seen failing (recorded in the commit messages or the PR body) |
| 4 | `npm run test:guards` | pass |
| 5 | `npx tsx scripts/docs-refs.ts` | exit 0 |
| 6 | `npm run test:hydration` | pass |
| 7 | `npm test` (whole unit project) and `npm run size` | pass. Size: library code grew a little and no dependency was added. If gate 10's budget fails, report the numbers and don't raise the budget silently |

- [ ] **Step 2: Append a retrospective** to this plan: what shipped, anything found while building, and what is still open.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/temporal-formatters
gh pr create --title "feat(format): Temporal values as first-class date inputs" --body "<summary, the spec link, and the verification table with results>"
```

Expected: all CI jobs green. That green run, plus `dates.spec.ts` passing in both zones, is the spec's proof artifact.

## Retrospective

### What shipped
The formatters take Temporal values: `PlainDate`, `PlainDateTime`, `PlainTime`, `ZonedDateTime`, `Instant`, and `Temporal.Duration` for `formatDuration`. A plain value renders its wall time, a `ZonedDateTime` its own zone, and an `Instant` follows the two-pass rule like a `Date`. A date-only ISO string is now a calendar date. `isoFor` emits the ISO form of a Temporal value. The library recognises values by `Symbol.toStringTag` and never reads `globalThis.Temporal`. A gate keeps the polyfill out of library sources, and the fixture's `/dates` route proves the values are zone-stable through SSR. ADR-0012 and the Getting started guide are updated.

### Found while building
- **Task 1 pulled the `isoFor` wiring forward.** The resolver change broke `isoFor` for Temporal values at once, so the wiring landed in Task 1 rather than Task 3.
- **Task 2's raw non-ASCII test strings.** The first tests carried raw narrow no-break spaces and en dashes. They were rewritten as `\u` escapes, and the rule is now to grep test files with `grep -nP '[^\x00-\x7F]'`.
- **Final review, PlainTime range.** `formatDateRange` gave a `PlainTime` pair the default `{ dateStyle: 'medium' }`, which printed "Jan 1, 1970". The default for a time pair is now `{ timeStyle: 'short' }`, and a time pair given a date style is invalid.
- **Final review, `withTimeZone`.** The advice to convert with `withTimeZone` to show a `ZonedDateTime` in the reader's zone would cause a hydration mismatch, because the server does not know that zone. The guidance is now to format `zdt.toInstant()`, which follows the two-pass rule. `withTimeZone(zone)` is for a fixed zone the server knows too.
- **Spec §3.2.** The note about `'2026-02-30'` said `new Date('2026-02-30')` is invalid today. On V8 it silently rolls over to 2 March, so the new rejection is a visible improvement.
- **Gate 10 re-seed.** Temporal support pushed two entries over budget. `format` js went from a budget of 3300 to 4000 (measured 3622 B), and `hooks` js from 6900 to 7800 (measured 7028 B). Both follow the gate's seeding rule, `ceil(measured * 1.1 / 100) * 100`, and were hand-edited so no other entry moved.
- **Gate self-match.** The temporal gate's own perturbation comment matched its specifier regex, so the non-vacuity check could have passed on the gate file alone. The comment is reworded.
- Also taken in the final wave: the missing §3.3 test cells, a non-vacuity length check in the PlainDate two-pass test, and a mixed-range JSDoc sentence.

### Still open
- Duration sub-display fractions print "0 sec", for example 1 hr + 1 µs.
- `toIsoString` may emit more than three fractional digits.
- A tagged `PlainTime` fake that lacks fields resolves to 00:00 instead of being invalid.
- `.stories.` files are not scanned by the temporal gate.
- Node 22's acceptance of offset zone ids from a `ZonedDateTime` is unverified.
- `shared.test.ts` has a double blank line before `describe('the test runtime')`.
- `toIsoString` casts a `PlainTime` to `TemporalInstant` only to call `toString`.
- The long ternary in `formatDuration` and the comment explaining why `asksForMissing(a)` suffices could be tidied.
- The polyfill import order in `useFormatter.test.tsx`, and one long `isoFor` JSDoc line.
- Hook-level `isoFor` tests cover only the Zoned and date-only cases.
- The hydration test name mentions Temporal, but the Instant flip is not asserted, and the quoted region has long `<time>` lines.
- The guide mentions `withTimeZone`, but the quoted sample does not show it.
