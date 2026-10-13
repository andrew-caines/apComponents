# Temporal support in the formatters — design

**Date:** 2026-10-13
**Status:** Draft for review
**Scope:** `packages/react/src/format/*`, `packages/react/src/hooks/useFormatter.ts`, ADR-0012,
`storybook/docs/GettingStarted.mdx`, `fixtures/ssr-app`.

## 1. Intent

**Goal.** The Temporal API is a first-class input to the date formatters and to `useFormatter`.
A Temporal value is formatted by what it means. A `Temporal.PlainDate` is a calendar date, so
it never shifts by a day. A `Temporal.ZonedDateTime` is a wall time in its own zone. A
`Temporal.Instant` is an instant, the same as a `Date`.

**Decisions taken with the user (2026-10-13):**

1. **Accept Temporal inputs; bundle nothing.** The library recognises Temporal values. An app
   that uses them brings Temporal itself, either the native API or `@js-temporal/polyfill`.
   Temporal is not the library's date model, and `Date | number | string` keep working.
2. **Approach A: normalise, then reuse the existing `Intl.DateTimeFormat` path.** Every Temporal
   value is turned into epoch milliseconds plus an optional zone and calendar. The output is then
   the same whichever Temporal implementation the app uses. Delegating to `toLocaleString`
   (output depends on the implementation) and passing objects to `Intl` (native only) were both
   rejected.
3. **A `ZonedDateTime` renders in its own zone.** The `timeZone` option is ignored for it, and
   so is the bound zone of `useFormatter`. To show it in another zone, the caller converts it
   first with `zdt.withTimeZone(…)`.
4. **A date-only ISO string is a calendar date.** `'1990-05-12'` is treated like a `PlainDate`.
   This replaces today's ECMAScript reading, which is UTC midnight. That decision was taken
   earlier in the same session, as a follow-up item, and is folded in here because it is the
   same rule.
5. **Out of v1:** `PlainYearMonth` and `PlainMonthDay`, which take the invalid-input path, and
   relative formatting between calendar dates.

**Success criteria:**
- The same `PlainDate` renders as the same day in every process zone, on the server and in the
  browser.
- A `ZonedDateTime` renders its own wall time under any provider zone.
- Hydration stays free of mismatch errors on a route that renders Temporal values.
- Every existing date test passes, except the date-only test, which changes on purpose (§6).

## 2. Constraints

- **Runtime floor.** The floor is Node `>=22.22.0` (`package.json` engines). The dev machine
  runs Node 24.19, which has **no global `Temporal`**. Library code never reads
  `globalThis.Temporal`.
- **Typings.** TypeScript is 5.9.3, which has no Temporal lib, so the public types are
  structural (§3.1).
- **Determinism gate.** `format/` stays pure: no clock reads and no React.
- **Failure handling.** Invalid input returns `''` and warns once in development, through
  today's `guard` and `warnOnce` (`format/shared.ts`). A wrong Temporal kind, such as a
  `PlainTime` passed to `formatDate`, is invalid input.
- **No runtime dependency.** `@js-temporal/polyfill` is a **devDependency** only, for tests and
  for the SSR fixture.

## 3. Design

### 3.1 Types (`format/shared.ts`)

These are structural interfaces that declare only what the library reads, so a native object
and a polyfill object both fit:

```ts
interface TemporalBase<Tag extends string> {
  readonly [Symbol.toStringTag]: Tag
  toString(options?: object): string
}
export interface TemporalPlainDate extends TemporalBase<'Temporal.PlainDate'> {
  readonly calendarId: string
  withCalendar(calendar: 'iso8601'): { readonly year: number; readonly month: number; readonly day: number }
}
export interface TemporalPlainDateTime extends TemporalBase<'Temporal.PlainDateTime'> {
  readonly calendarId: string
  withCalendar(calendar: 'iso8601'): {
    readonly year: number; readonly month: number; readonly day: number
    readonly hour: number; readonly minute: number; readonly second: number; readonly millisecond: number
  }
}
export interface TemporalPlainTime extends TemporalBase<'Temporal.PlainTime'> {
  readonly hour: number; readonly minute: number; readonly second: number; readonly millisecond: number
}
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
  readonly years: number; readonly months: number; readonly weeks: number; readonly days: number
  readonly hours: number; readonly minutes: number; readonly seconds: number
  readonly milliseconds: number; readonly microseconds: number; readonly nanoseconds: number
}

export type TemporalDateLike =
  | TemporalPlainDate | TemporalPlainDateTime | TemporalPlainTime
  | TemporalZonedDateTime | TemporalInstant

export type DateInput = Date | number | string | TemporalDateLike
```

`TemporalDuration` is not a `DateInput`. It widens `formatDuration`'s input instead (§3.3). The
new type names are exported from `format/index.ts`.

### 3.2 Detection and conversion (`format/shared.ts`)

- **`temporalKind(value: unknown)`** returns `'PlainDate' | 'PlainDateTime' | 'PlainTime' |
  'ZonedDateTime' | 'Instant' | 'Duration' | 'other'` for an object whose
  `Object.prototype.toString` result starts with `[object Temporal.`. It returns `undefined`
  for everything else. `'other'` covers `PlainYearMonth` and `PlainMonthDay`, which are
  therefore invalid.
- **`toInstant(value)`** replaces `toTimestamp` as the date formatters' entry point. It returns
  `{ ms: number; zone?: string; plain?: 'date' | 'datetime' | 'time'; calendar?: string } |
  undefined`.

  | Input | `ms` | `zone` | `plain` | `calendar` |
  |---|---|---|---|---|
  | `PlainDate` | ISO fields at 00:00 UTC | `'UTC'` | `'date'` | `calendarId` unless `'iso8601'` |
  | `PlainDateTime` | ISO fields as UTC | `'UTC'` | `'datetime'` | `calendarId` unless `'iso8601'` |
  | `PlainTime` | 1970-01-01 at that time, UTC | `'UTC'` | `'time'` | — |
  | `ZonedDateTime` | `epochMilliseconds` | `timeZoneId` | — | `calendarId` unless `'iso8601'` |
  | `Instant` | `epochMilliseconds` | — | — | — |
  | date-only string `/^\d{4}-\d{2}-\d{2}$/` | that date at 00:00 UTC | `'UTC'` | `'date'` | — |
  | `Date`, number, any other string | as today | — | — | — |
  | other Temporal kinds, or a non-finite result | `undefined` | | | |

- **Building `ms` from ISO fields** uses `new Date(0)`, then `setUTCFullYear(y, m - 1, d)`, then
  `setUTCHours(...)`. It never uses `Date.UTC`, which maps the years 0–99 to 1900–1999.
- **A date-only string** is checked against the regex, and its fields are then validated by a
  round trip, so `'2026-02-30'` is invalid. Today `new Date('2026-02-30')` is also invalid, so
  this is not a regression.
- **`toTimestamp`** stays as a thin wrapper (`toInstant(v)?.ms`), for any caller that needs only
  the instant.

### 3.3 Formatter rules (`format/date.ts`)

A result's `zone`, when present, overrides `options.timeZone`. A result's `calendar` becomes the
default for the `calendar` option, and the caller's `calendar` still wins.

| Formatter | Accepts | Invalid |
|---|---|---|
| `formatDate` | PlainDate, PlainDateTime, ZonedDateTime, Instant, plus today's inputs | PlainTime, other Temporal kinds |
| `formatTime` | PlainTime, PlainDateTime, ZonedDateTime, Instant, plus today's inputs | PlainDate, a date-only string, other Temporal kinds |
| `formatDateTime` | PlainDateTime, ZonedDateTime, Instant, plus today's inputs | PlainDate, PlainTime, a date-only string, other Temporal kinds |
| `formatDateRange` | two values of the **same** `plain` class, or two instant-like values (Zoned, Instant, Date, number, timestamp string). A Zoned pair renders in the **start's** zone. | mixed classes, such as a PlainDate with an Instant |
| `formatRelative` | `value` and `now` as Instant, ZonedDateTime, or today's non-date-only inputs | any `plain` value, including a date-only string |
| `formatDuration` | `Duration` (today's object) or a `TemporalDuration` | a `TemporalDuration` with `sign === -1`; other Temporal kinds |

**Option rules:**
- `timeZoneName` with a `plain` value is invalid, because it would print a zone for a value that
  has none.
- For a `TemporalDuration`, `milliseconds + microseconds / 1e3 + nanoseconds / 1e6` is added to
  `seconds` as a fraction. The existing composition (`NumberFormat` + `ListFormat`) is unchanged.

**Calendar dates under `formatRelative`.** A date-only string was accepted before this change and
is invalid afterwards. This is intended, because relative time between calendar dates is out of
v1, and the JSDoc says so.

### 3.4 `useFormatter` and `isoFor` (`hooks/useFormatter.ts`)

- The bound signatures follow the wider `DateInput` through `Bound<…>`, so no hand edits are
  needed. The bound `timeZone` is ignored for Zoned and plain values, by §3.3.
- **SSR.** Plain and Zoned values, and date-only strings, never read the reader's zone, so the
  server, hydration and later renders give identical text. Instants keep ADR-0012's two-pass
  rule.
- **`isoFor`** moves to `format/shared.ts` as `toIsoString(value)` so it can be tested without
  React, and the hook delegates to it. It returns a valid `<time dateTime>` value, or `''` for
  invalid input:

  | Input | Output |
  |---|---|
  | PlainDate | `value.toString({ calendarName: 'never' })` → `'1990-05-12'` |
  | PlainDateTime | `value.toString({ calendarName: 'never' })` → `'2026-03-05T09:00:00'` |
  | PlainTime | `value.toString()` → `'09:00:00'` |
  | ZonedDateTime | `value.toString({ timeZoneName: 'never', calendarName: 'never' })` → `'2026-03-05T09:00:00+09:00'` |
  | Instant | `value.toString()` → `'2026-03-05T00:00:00Z'` |
  | date-only string | the string itself |
  | `Date`, number, other string | `toISOString()`, as today |

  `Duration` is not a `DateInput`, so `isoFor` does not take it (YAGNI).

## 4. Documentation

- **ADR-0012:** add a "Temporal" section that records decisions 1–4, plus the rule that the
  library never reads `globalThis.Temporal`.
- **`storybook/docs/GettingStarted.mdx`:** add a "Dates and Temporal" section. It says what each
  kind means, that the app brings Temporal, and how to show a `ZonedDateTime` elsewhere
  (`withTimeZone`). The sample is quoted by region from the fixture route (§5), following the
  `extractRegion` pattern.
- **JSDoc:** the four date-only paragraphs in `date.ts` and `useFormatter.ts` are rewritten to
  state the new rule.

## 5. Testing

- **Unit tests** (`format/date.test.ts`, `format/shared.test.ts`) use `@js-temporal/polyfill`
  values.
  - Every accepted and every invalid cell of §3.3.
  - PlainDate year 0045 renders year 45, not 1945.
  - A `hebrew`-calendar PlainDate defaults to Hebrew output, and an explicit `calendar: 'gregory'`
    wins.
  - A `ZonedDateTime` in `Asia/Tokyo` with `timeZone: 'America/New_York'` renders Tokyo time.
  - `isoFor`/`toIsoString` for every row of §3.4.
  - A Temporal Duration with milliseconds, and a negative one.
- **Zone independence.** `process.env.TZ` is forced to `America/Los_Angeles` and then to
  `Pacific/Kiritimati`, saved and restored, as F7 in 5g did. A `PlainDate` and a date-only
  string render the same day under both. Perturbation: take out the `zone: 'UTC'` override, and
  the Los Angeles case must fail.
- **Duck typing without a global.** A test asserts that `globalThis.Temporal` is `undefined`
  under the test runtime, so the polyfill import cannot pass by installing a global. A hand-built
  object with the right `Symbol.toStringTag` and members is formatted correctly.
- **Dependency guard.** A new gate, `temporal-isolation.gate.test.ts`, modelled on
  `phone-isolation.gate.test.ts` and added to `test:guards`, fails if any non-test file under
  `packages/react/src` imports `@js-temporal/polyfill`. Perturbation: add the import to `date.ts`.
- **`useFormatter`.** Under a provider zone of `America/New_York`, a ZonedDateTime keeps its own
  zone, and the hydration-pass case for a PlainDate gives the same text as the client pass.
- **SSR fixture.** A new `dates` route, routed in both modes and with no loader, renders a
  PlainDate, a ZonedDateTime and an Instant through `useFormatter`, each inside
  `<time dateTime>`. The polyfill is a devDependency of the fixture. `hydration.spec.ts` adds the
  route to its list, so the empty-`__apRecoverableErrors` assertion covers it. Perturbation:
  the `/dates` test sets its browser context's `timezoneId` to `America/Los_Angeles`.
  Render the PlainDate through `new Date(...)` instead, and the visible day must differ from the
  server's, so the spec fails.
- **Existing test that changes:** `date-only strings › shows the previous day west of UTC` now
  asserts `'May 12, 1990'`.

## 6. Verification plan

| # | Check | Command | Success signal |
|---|---|---|---|
| 1 | Types compile, including structural fit to polyfill objects | `npm run typecheck` | exit 0 |
| 2 | Format and hook unit tests | `npm test -- packages/react/src/format packages/react/src/hooks` | all pass; new cases listed in §5 present |
| 3 | Perturbations | each one applied and then reverted by hand | each fails while applied |
| 4 | Guards and determinism gate | `npm run test:guards` | pass |
| 5 | Docs references (regions, links) | `npx tsx scripts/docs-refs.ts` | exit 0 |
| 6 | SSR hydration, including `/dates` | `npm run test:hydration` | pass, empty recoverable-errors array |
| 7 | Full CI on the PR | GitHub Actions | all jobs green |

**Proof artifact:** the PR's green CI run, plus `/dates` in the fixture rendering the same
PlainDate text when the browser context's `timezoneId` is `America/Los_Angeles` and when it is
`Asia/Tokyo`.

## 7. Out of scope

- `PlainYearMonth` and `PlainMonthDay` formatting.
- Relative time between calendar dates.
- Temporal as the value type of future date-input components.
- Bundling or auto-loading a polyfill.
