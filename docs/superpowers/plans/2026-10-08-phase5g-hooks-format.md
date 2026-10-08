# Phase 5g — Hooks and formatters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@ap/react/format`, `@ap/react/format/phone` and `@ap/react/hooks`: the ADR-0012 catalogue of pure `Intl` formatters, PII masks, a phone formatter isolated behind its own subpath, and the SSR-safe hooks, including `useFormatter()`, which binds the formatters to `LocaleProvider` and implements the two-pass date rule.

**Architecture:** Formatters are plain `.ts` modules under `src/format/`. They carry no `'use client'`, import nothing from React and are deterministic. Hooks live under `src/hooks/` and follow ADR-0005: a declared server value, then reconciliation through `useSyncExternalStore` or an effect. They build on `@base-ui/utils` primitives rather than hand-rolling them. Gates enforce every boundary: determinism, phone isolation, the SSR exemptions and the package shape.

**Tech Stack:** TypeScript, React 19, `Intl.*`, `@base-ui/utils` 0.3.2, `libphonenumber-js` 1.13.13 (`/min`), Vitest (unit project, jsdom and node environments).

**Spec:** `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md`. Read §4.1.6, §5.1–§5.4, and **§5.5, which is this plan's scope**. Read the "What actually happened" sections of the 5e and 5f plans in `docs/superpowers/plans/` before any task.

**How this plan is written, deliberately:** as in 5c–5f, **each rule is stated, and the precedent file that already follows it is cited.** Code appears where it is the contract (signatures, the tricky algorithms, and gate shapes). Every test case is given as an exact input and expected output, so the expected strings are not open to re-derivation. A deviation from a cited precedent is a review finding unless the step says otherwise.

**Per §4.1.6, most of these hooks and formatters have no caller in the repo.** Their tests are their only consumer, so coverage here is not evidence of use.

## Global Constraints

- **Node 22.22.0** in CI (ICU 77.1). `engines.node` is `>=22.22.0`. Development machines may run Node 24 (ICU 78.3). **Every formatter and hook test must pass on both.** Each task's run step includes `npx --yes node@22.22.0 node_modules/vitest/vitest.mjs run --project unit <paths>`, which was verified working on 2026-10-08.
- **`src/format/**` files carry no `'use client'` and import nothing from `react`.** They are pure functions, usable in loaders and Node scripts. Every `src/hooks/*.ts` file **starts with `'use client'`** (`hooks/useHydrated.ts` is the precedent).
- **Relative imports carry `.js`**, even from `.ts`/`.tsx`.
- **The SSR-safety gate scans raw text, comments included** (`gates/ssr-safety.gate.test.ts:21-35`). No runtime source may contain `window.`, `document.`, `Date.now()`, `Math.random()`, `localStorage`, `sessionStorage`, `matchMedia` or `useLayoutEffect`, **in comments too**: hyphenate or rephrase in prose. The only new exemptions are the two Task 6 and Task 8 create, for `matchMedia` and the storage names. DOM hooks reach the document through `ownerDocument(node)` from `@base-ui/utils/owner`, which falls back to the global document when passed `null` (`node_modules/@base-ui/utils/owner.mjs:2-4`), or through a caller-supplied target.
- **Development-only warnings** use a bare `process.env.NODE_ENV !== 'production'` check, never guarded by `typeof process` (`components/Select/Select.tsx:265-274` is the precedent, and its comment says why).
- **`exactOptionalPropertyTypes` is on.** Spread optionals conditionally, and never pass `prop: undefined`. Public option types declare optionals as `?: T | undefined`, which also clears 5f's open follow-up for consumers.
- **There is no jest-dom in unit tests.** Use plain values and `el.getAttribute(…)`. Files that render to the DOM start with `// @vitest-environment jsdom` (`hooks/useHydrated.test.tsx:1`). A server test has **no** environment docblock and asserts `typeof window === 'undefined'` (`hooks/useHydrated.ssr.test.tsx`).
- **Expected strings containing invisible characters are written with escapes**, never pasted: U+00A0 as `\u00a0`, U+202F as `\u202f`, U+2009 as `\u2009`, U+200F as `\u200f`. An expected string with a pasted no-break space is a review finding.
- **Only two dependencies may be added:** `@base-ui/utils` `0.3.2` (exact, matching `node_modules/@base-ui/react/package.json:33`) as a dependency, and `libphonenumber-js` `1.13.13` as an optional peer (`^1.13.13`) plus a root dev dependency. 1.13.13 was published 2026-09-10; 1.13.14 and 1.13.15 are newer than this repo's two-week floor. **Never run a snapshot-update flag. Never run prettier.** House style is single quotes and no semicolons.
- **Every assertion names the change that must make it fail.** Apply each perturbation once, watch it fail, and revert. 5f's lesson applies: **before prescribing a perturbation, check that the code under test is the only thing between the input and the failure.**
- **Check every new file is valid UTF-8** before committing (`iconv -f utf-8 -t utf-8 <file> > /dev/null`). 5f shipped a stray `0x97` byte from a shell write.

## Facts established before writing this plan

Verified on 2026-10-08.

| # | Fact | Consequence |
|---|---|---|
| 1 | Every `Intl` output pinned in this plan's test tables (except `formatPhone`'s, which depend on `libphonenumber-js` metadata) was run on **Node 22.22.0 (ICU 77.1) and Node 24.19.0 (ICU 78.3)** and is byte-identical on both. | The tables are safe to assert exactly. |
| 2 | **One divergence was found:** `de-DE` `unitDisplay: 'narrow'` hours are `"2 Std."` on ICU 77.1 and `"2h"` on ICU 78.3. | No test asserts a `narrow` duration or unit in `de-DE`. `formatDuration`'s default style is `'short'`. |
| 3 | `Intl.DurationFormat` is `undefined` on Node 22.22.0 and a function on Node 24.19.0. | This is why spec §5.2 composes and never feature-detects. A test asserts the composed path is used even where the native API exists (Task 1). |
| 4 | An invalid locale (`'xx_YY'`), an invalid time zone (`'Mars/Base'`) and an invalid `Date` all make `Intl` throw `RangeError`. | "Bad input never throws" (spec §5.5.2) means every formatter catches. Review Focus 5. |
| 5 | `new Intl.NumberFormat('en-US', { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 1 }).format(999.95)` is `"1,000 kB"`. | `formatBytes` must step up a unit **after** rounding. Review Focus 3. |
| 6 | The `en-US` short form of the `byte` unit is singular (`"512 byte"`); the long form is plural-correct (`"512 bytes"`, `"1 byte"`). | `formatBytes` formats the `byte` unit with `unitDisplay: 'long'` and every larger unit with `'short'`. |
| 7 | `@base-ui/utils` 0.3.2 exports `./useControlled`, `./useStableCallback`, `./usePreviousValue`, `./useTimeout`, `./useValueAsRef` and `./owner` as subpaths (`node_modules/@base-ui/utils/package.json` exports). `useControlled({ controlled, default, name, state? })` returns `[value, setValueIfUncontrolled]` and **never calls a change handler** (`useControlled.mjs:4-42`). `usePreviousValue(value)` returns the previous **distinct** value, `null` before the first change (`usePreviousValue.mjs:9-20`). `useTimeout()` returns a `Timeout` with `start(delay, fn)` and `clear()`, cleaned up on unmount (`useTimeout.d.ts`). `useStableCallback` throws if called during render (`useStableCallback.d.ts`). | `useControllableState` calls `onChange` itself. `usePrevious` returns `T \| null` and documents the "distinct" semantics. |
| 8 | `ownerDocument(null)` returns the global document (`@base-ui/utils/owner.mjs:2-4`). | `useFocusReturn` and `useClickOutside` never name the global, so they need no SSR exemption. |
| 9 | `NotificationContext` is private to `notifications/NotificationProvider.tsx:22`, which also imports the Toast parts and their CSS. | `useAnnounce` must not import `NotificationProvider.tsx`, or `./hooks` would pull Toast's CSS into every consumer bundle (gate 10, 5h). Task 7 moves the context into `notifications/context.ts`. |
| 10 | `useHydrated` flips in a passive effect (`hooks/useHydrated.ts:14-18`), so it is `false` on the first render of **every** mount, including client-only mounts after hydration. | `useFormatter` must not use it, or every client-side navigation flashes UTC. It uses `useSyncExternalStore(noop, () => true, () => false)` instead, which is `false` only while hydrating. Review Focus 4. |
| 11 | `new Date('2026-03-05')` (date-only ISO) is UTC midnight; `new Date('2026-03-05T14:30:00Z')` parses exactly. | Formatters accept `Date \| number \| string`, and parse strings with `new Date(string)`. |
| 12 | `new Intl.Locale('en').maximize().region` is `'US'`; `'he'` → `'IL'`; `'ja'` → `'JP'`. | `formatAddress` derives the reader's region from the maximised locale. |

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/react/package.json` | `./hooks`, `./format`, `./format/phone` exports; `@base-ui/utils` dependency; `libphonenumber-js` optional peer |
| `package.json` (root) | `libphonenumber-js` dev dependency; two new gates in `test:guards` |
| `packages/react/src/format/shared.ts` (+ `shared.test.ts`) | `toTimestamp`, `isFiniteNumber`, `guard` (catch + dev warn-once), the common option types |
| `packages/react/src/format/date.ts` (+ `date.test.ts`) | `formatDate`, `formatTime`, `formatDateTime`, `formatDateRange`, `formatRelative`, `formatDuration` |
| `packages/react/src/format/number.ts` (+ `number.test.ts`) | `formatNumber`, `formatCurrency`, `formatPercent`, `formatPercentChange`, `formatCompact`, `formatOrdinal`, `formatBytes` |
| `packages/react/src/format/text.ts` (+ `text.test.ts`) | `formatName`, `formatList`, `pluralize`, `truncate`, `collator` |
| `packages/react/src/format/address.ts` (+ `address.test.ts`) | `formatAddress` and its twelve-country template table |
| `packages/react/src/format/mask.ts` (+ `mask.test.ts`) | `maskEmail`, `maskPhone`, `maskCardNumber`, `maskTaxId` and the cited table |
| `packages/react/src/format/phone.ts` (+ `phone.test.ts`) | `formatPhone`, the only importer of `libphonenumber-js` |
| `packages/react/src/format/index.ts` | Barrel (never re-exports `phone.ts`) |
| `packages/react/src/hooks/useMediaQuery.ts`, `useReducedMotion.ts` (+ tests, + `.ssr.test.tsx`) | Media queries |
| `packages/react/src/hooks/useControllableState.ts`, `useDisclosure.ts`, `useToggle.ts`, `usePrevious.ts`, `useDebouncedValue.ts` (+ tests) | State |
| `packages/react/src/hooks/useClickOutside.ts`, `useResizeObserver.ts`, `useIntersectionObserver.ts`, `useEventListener.ts`, `useCopyToClipboard.ts` (+ tests) | DOM |
| `packages/react/src/hooks/useAnnounce.ts`, `useFocusReturn.ts` (+ tests) | A11y |
| `packages/react/src/notifications/context.ts` | `NotificationContext`, moved out of `NotificationProvider.tsx` |
| `packages/react/src/hooks/useStorage.ts` (+ `useStorage.test.tsx`, `useStorage.ssr.test.tsx`) | `useLocalStorage`, `useSessionStorage` |
| `packages/react/src/hooks/useFormatter.ts` (+ `useFormatter.test.tsx`, `useFormatter.ssr.test.tsx`) | Formatters bound to `LocaleProvider`; the two-pass date rule |
| `packages/react/src/hooks/index.ts` | Barrel; also re-exports `useTheme`, `useColorScheme` |
| `packages/react/src/gates/format-determinism.gate.test.ts` | New gate: no clock, no React under `src/format` |
| `packages/react/src/gates/phone-isolation.gate.test.ts` | New gate: `libphonenumber-js` unreachable from `format/index.ts` and `hooks/index.ts` |
| `packages/react/src/gates/package-shape.gate.test.ts` | New gate: subpaths resolve; dependency declarations |
| `packages/react/src/gates/use-client.gate.test.ts` | `src/format` directory exemption |
| `packages/react/src/gates/ssr-safety.gate.test.ts` | `useMediaQuery.ts` and `useStorage.ts` exemptions with AST assertions |
| `fixtures/consumer/src/main.tsx` | Imports from `@ap/react/hooks` and `@ap/react/format` (gate 8 typechecks and builds them) |
| `docs/adr/0012-cross-cutting-services.md`, spec §5.6, `docs/CONTRIBUTING.md` | Amendment, verified facts, subpath guidance |

---

## Review Focus

These five inputs are implied by the spec, not exercised by any obvious test, and most likely to bite a real user. Each has its test in the task that owns the code.

1. **A date that arrives from JSON as a string** in a loader: `formatDate('2026-03-05T14:30:00Z', …)`, and a malformed one, `'not a date'`. Expect the first to format exactly like the `Date`, and the second to return `''` with one development warning, never `"Invalid Date"` and never a throw. Pinned in Task 1.
2. **`maskTaxId` on a value too short to mask** (`'1234'`, `'12'`, `''`). The keep-last-four rule would show the whole value. Expect every character masked when the value has no more alphanumerics than the rule keeps. Pinned in Task 4.
3. **`formatBytes` at a unit boundary**: `999_950` bytes. Naive scaling gives `"1,000 kB"` (fact 5). Expect `"1 MB"`. Pinned in Task 2.
4. **`useFormatter` mounted after hydration** (a client-side route change), versus during hydration. A `useHydrated`-based implementation flashes UTC on every navigation (fact 10). Expect local time on the first render of a client-only mount, and UTC only for the hydration pass. Pinned in Task 9.
5. **A bad locale or time zone from user data** (`locale: 'en_US'`, `timeZone: 'Mars/Base'`). `Intl` throws `RangeError` (fact 4). Expect `''` and a development warning from every formatter, not a crashed route. Pinned in Task 1 (`guard`), Task 2 and Task 3.

---

### Task 1: Package plumbing, shared helpers, date formatters, determinism gate

**Files:**
- Modify: `packages/react/package.json`, `packages/react/src/gates/use-client.gate.test.ts`, root `package.json` (`test:guards`)
- Create: `packages/react/src/format/shared.ts`, `shared.test.ts`, `date.ts`, `date.test.ts`, `index.ts`
- Create: `packages/react/src/gates/format-determinism.gate.test.ts`, `packages/react/src/gates/package-shape.gate.test.ts`

**Interfaces:**
- Produces, in `format/shared.ts`:
  ```ts
  export type DateInput = Date | number | string
  export interface LocaleOptions { locale: string }
  export interface ZonedOptions extends LocaleOptions { timeZone: string }
  /** Milliseconds since the epoch, or undefined when the input is not a valid instant. */
  export function toTimestamp(value: DateInput | null | undefined): number | undefined
  export function isFiniteNumber(value: unknown): value is number
  /**
   * Runs `fn`; returns '' if it throws or if `bad` is true. In development,
   * warns once per formatter name with the offending value.
   */
  export function guard(name: string, value: unknown, bad: boolean, fn: () => string): string
  ```
- Produces, in `format/date.ts`:
  ```ts
  export type DateFormatOptions = ZonedOptions & Omit<Intl.DateTimeFormatOptions, 'timeZone'>
  export function formatDate(value: DateInput | null | undefined, options: DateFormatOptions): string        // default dateStyle 'medium'
  export function formatTime(value: DateInput | null | undefined, options: DateFormatOptions): string        // default timeStyle 'short'
  export function formatDateTime(value: DateInput | null | undefined, options: DateFormatOptions): string    // defaults dateStyle 'medium', timeStyle 'short'
  export function formatDateRange(start: DateInput | null | undefined, end: DateInput | null | undefined, options: DateFormatOptions): string // default dateStyle 'medium'
  export interface RelativeOptions extends LocaleOptions { now: DateInput; numeric?: 'auto' | 'always' | undefined; style?: Intl.RelativeTimeFormatStyle | undefined }
  export function formatRelative(value: DateInput | null | undefined, options: RelativeOptions): string
  export interface Duration { years?: number | undefined; months?: number | undefined; weeks?: number | undefined; days?: number | undefined; hours?: number | undefined; minutes?: number | undefined; seconds?: number | undefined }
  export interface DurationOptions extends LocaleOptions { style?: 'long' | 'short' | 'narrow' | undefined }   // default 'short'
  export function formatDuration(duration: Duration | null | undefined, options: DurationOptions): string
  ```
  Style defaults apply **only when the caller passes none of** `dateStyle`, `timeStyle`, `weekday`, `era`, `year`, `month`, `day`, `dayPeriod`, `hour`, `minute`, `second` or `fractionalSecondDigits`. `Intl` throws if a style is mixed with a component option, and that is how a caller asks for `{ month: 'long' }` alone.

- [ ] **Step 1: Package plumbing.** In `packages/react/package.json` add to `exports`: `"./hooks": "./src/hooks/index.ts"` and `"./format": "./src/format/index.ts"`. (`./format/phone` arrives in Task 5.) Add `"@base-ui/utils": "0.3.2"` to `dependencies`. Run `npm install` at the root; `git diff package-lock.json` must show only the workspace's dependency entry and no version change to `@base-ui/utils`. Revert any `libc` lockfile noise.

- [ ] **Step 2: Write `package-shape.gate.test.ts`.** It reads `packages/react/package.json` and asserts:
  - `exports['./hooks']` and `exports['./format']` exist, and each target file exists on disk;
  - `dependencies['@base-ui/utils']` equals the `@base-ui/utils` version in `node_modules/@base-ui/react/package.json` (read it, do not hardcode it), so a Base UI bump that changes its pin fails here;
  - `exports['.']` is still `./src/index.ts`.
  Perturbations: delete the `./format` export (fails); set `@base-ui/utils` to `^0.3.2` (fails).

- [ ] **Step 3: Write `shared.test.ts`** (node environment):

  | Call | Expected |
  |---|---|
  | `toTimestamp(new Date(Date.UTC(2026, 2, 5, 14, 30)))` | `Date.UTC(2026, 2, 5, 14, 30)` |
  | `toTimestamp('2026-03-05T14:30:00Z')` | `Date.UTC(2026, 2, 5, 14, 30)` |
  | `toTimestamp(0)` | `0` (the epoch is a valid instant, not "falsy, so bad") |
  | `toTimestamp('not a date')`, `toTimestamp(NaN)`, `toTimestamp(null)`, `toTimestamp(undefined)`, `toTimestamp(new Date('x'))` | `undefined` |
  | `guard('f', 1, false, () => 'ok')` | `'ok'` |
  | `guard('f', 1, true, () => 'ok')` | `''`, and `fn` is not called |
  | `guard('f', 1, false, () => { throw new RangeError() })` | `''` |
  | warn-once | with `vi.spyOn(console, 'warn')`, two bad calls for name `'g'` warn once; a bad call for name `'h'` warns again. The message contains the name and `String(value)` |

  `guard` keeps its warned-names `Set` at module scope. Export a `resetFormatWarningsForTests()` used only by tests, and call it in `beforeEach`.
  Perturbations: `toTimestamp` uses `if (!value)` (the epoch row fails); remove the catch (the throw row fails).

- [ ] **Step 4: Write `date.test.ts`.** Let `T = Date.UTC(2026, 2, 5, 14, 30)`.

  | Call | Expected |
  |---|---|
  | `formatDate(T, { locale: 'en-US', timeZone: 'UTC' })` | `'Mar 5, 2026'` |
  | `formatDate(T, { locale: 'en-GB', timeZone: 'UTC' })` | `'5 Mar 2026'` |
  | `formatDate(T, { locale: 'de-DE', timeZone: 'UTC' })` | `'05.03.2026'` |
  | `formatDate(T, { locale: 'ja-JP', timeZone: 'UTC' })` | `'2026/03/05'` |
  | `formatDate(T, { locale: 'he-IL', timeZone: 'UTC' })` | `'5 במרץ 2026'` |
  | `formatDate(Date.UTC(2026, 2, 5, 23, 30), { locale: 'en-US', timeZone: 'Asia/Tokyo' })` | `'Mar 6, 2026'` (the zone is honoured) |
  | `formatDate('2026-03-05T14:30:00Z', { locale: 'en-US', timeZone: 'UTC' })` | `'Mar 5, 2026'` (**Review Focus 1**) |
  | `formatDate('not a date', …)`, `formatDate(null, …)` | `''` (**Review Focus 1**) |
  | `formatDate(T, { locale: 'en-US', timeZone: 'UTC', month: 'long' })` | `'March'` (no style default when a component option is given; mixing them makes `Intl` throw `TypeError`) |
  | `formatDate(0, { locale: 'en-US', timeZone: 'UTC' })` | `'Jan 1, 1970'` (the epoch is valid) |
  | `formatDate(T, { locale: 'en_US', timeZone: 'UTC' })` | `''` (**Review Focus 5**) |
  | `formatDate(T, { locale: 'en-US', timeZone: 'Mars/Base' })` | `''` (**Review Focus 5**) |
  | `formatTime(T, { locale: 'en-US', timeZone: 'America/New_York' })` | `'9:30 AM'` |
  | `formatTime(T, { locale: 'de-DE', timeZone: 'Europe/Berlin' })` | `'15:30'` |
  | `formatDateTime(T, { locale: 'en-US', timeZone: 'UTC' })` | `'Mar 5, 2026, 2:30 PM'` |
  | `formatDateTime(T, { locale: 'he-IL', timeZone: 'Asia/Jerusalem' })` | `'5 במרץ 2026, 16:30'` |
  | `formatDateRange(T, T + 3 * 864e5, { locale: 'en-US', timeZone: 'UTC' })` | `'Mar 5\u2009–\u20098, 2026'` |
  | `formatDateRange(T, T + 3 * 864e5, { locale: 'de-DE', timeZone: 'UTC' })` | `'05.–08.03.2026'` |
  | `formatDateRange(T, T, { locale: 'en-US', timeZone: 'UTC' })` | `'Mar 5, 2026'` |
  | `formatDateRange(T, 'nope', …)` | `''` |

  **`formatRelative`** picks the unit from `diff = value - now` in milliseconds, by `Math.abs(diff)`:
  under 60 s → `second`; under 60 min → `minute`; under 24 h → `hour`; under 7 days → `day`; under 30 days → `week`; under 365 days → `month` (`Math.round(days / 30.4375)`); else `year` (`Math.round(days / 365.25)`). The amount is `Math.round(diff / unitMs)`. `numeric` defaults to `'auto'`.

  | `value` relative to `now = T` | locale | Expected |
  |---|---|---|
  | `T` | en-US | `'now'` |
  | `T - 30_000` | en-US | `'30 seconds ago'` |
  | `T - 60_000` | en-US | `'1 minute ago'` (boundary: 60 s is minutes) |
  | `T - 59 * 60_000` | en-US | `'59 minutes ago'` |
  | `T - 3 * 3_600_000` | en-US | `'3 hours ago'` |
  | `T - 864e5` | en-US | `'yesterday'` |
  | `T - 6 * 864e5` | en-US | `'6 days ago'` |
  | `T - 7 * 864e5` | en-US | `'last week'` (boundary) |
  | `T + 14 * 864e5` | de-DE | `'in 2 Wochen'` |
  | `T + 91 * 864e5` | en-US | `'in 3 months'` |
  | `T - 2 * 365.25 * 864e5` | en-US | `'2 years ago'` |
  | `T - 5 * 60_000` | fr-FR | `'il y a 5 minutes'` |
  | `T - 3 * 3_600_000` | he-IL | `'לפני 3 שעות'` |
  | `'nope'`, or `now: 'nope'` | en-US | `''` |

  **`formatDuration`** formats each present, non-zero field, from the largest unit down, with `Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: style })`, and joins them with `Intl.ListFormat(locale, { type: 'unit', style })`. An all-zero or empty duration formats as zero seconds. A negative or non-finite field returns `''`.

  | Call | Expected |
  |---|---|
  | `formatDuration({ hours: 2, minutes: 30 }, { locale: 'en-US', style: 'long' })` | `'2 hours, 30 minutes'` |
  | `formatDuration({ hours: 2, minutes: 30 }, { locale: 'en-US' })` | `'2 hr, 30 min'` (default `short`) |
  | `formatDuration({ hours: 2, minutes: 30 }, { locale: 'de-DE', style: 'long' })` | `'2 Stunden, 30 Minuten'` |
  | `formatDuration({ hours: 2, minutes: 30 }, { locale: 'de-DE' })` | `'2 Std., 30 Min.'` |
  | `formatDuration({ hours: 2, minutes: 30 }, { locale: 'he-IL', style: 'long' })` | `'שעתיים, 30 דקות'` |
  | `formatDuration({ days: 1, hours: 1, minutes: 0, seconds: 5 }, { locale: 'en-US' })` | `'1 day, 1 hr, 5 sec'` (zero fields omitted) |
  | `formatDuration({}, { locale: 'en-US' })` | `'0 sec'` |
  | `formatDuration({ hours: -1 }, …)`, `formatDuration({ minutes: NaN }, …)`, `formatDuration(null, …)` | `''` |
  | Fact 3 | stub `Intl.DurationFormat` with `vi.stubGlobal` (or define it on `Intl` and restore it) as a class whose `format` returns `'NATIVE'`; `formatDuration({ hours: 2 }, { locale: 'en-US' })` is still `'2 hr'` |

- [ ] **Step 5: Run the tests and watch them fail** (`npx vitest run --project unit packages/react/src/format`). Expected: the modules do not exist.

- [ ] **Step 6: Implement `shared.ts`, `date.ts` and `index.ts`.** No `'use client'`. Every exported formatter body is a single `guard(name, input, bad, () => …)` call, where `bad` comes from `toTimestamp`/`isFiniteNumber`. The barrel exports every public function and type from `date.ts` and the `DateInput`, `LocaleOptions` and `ZonedOptions` types; it does not export `guard`, `toTimestamp` or the test reset.

- [ ] **Step 7: Write `format-determinism.gate.test.ts`.** It walks `src/format` with `sourceFiles(…, { extensions: ['.ts'] })` (tests excluded), asserts it found at least one file, and fails any file containing `Date.now(`, `new Date()` (zero-argument, `/new\s+Date\s*\(\s*\)/`), `performance.now(`, `Math.random(`, an import from `'react'` or `'react-dom'` (any subpath), or a `'use client'` directive. Comment it the way `ssr-safety.gate.test.ts` is commented: why each rule exists. Add the file to root `test:guards`. Perturbations: add `const n = new Date()` to `date.ts` (fails); add `import 'react'` (fails).

- [ ] **Step 8: Exempt `src/format` in `use-client.gate.test.ts`.** Add a `FORMAT_DIR = join(SRC, 'format')` exclusion beside `THEME_SCRIPT_PATH`, with a comment: pure functions with no React import, used in loaders and Node, where `'use client'` would turn them into client references; the determinism gate asserts the "no React" half. Assert `FORMAT_DIR` exists and the walk found at least one file under it, in the style of the existing stale-config tests. Perturbation: misspell the directory (the existence assertion fails).

- [ ] **Step 9: Run** `npx vitest run --project unit packages/react/src/format`, `npm run test:guards`, `npm run typecheck`, then the same format tests under Node 22: `npx --yes node@22.22.0 node_modules/vitest/vitest.mjs run --project unit packages/react/src/format`. All pass. Apply and revert each perturbation named above.

- [ ] **Step 10: Commit.**
  ```bash
  git add packages/react/package.json package.json package-lock.json packages/react/src/format packages/react/src/gates
  git commit -m "feat(format): date formatters, format and hooks subpaths, determinism gate"
  ```

---

### Task 2: Number formatters

**Files:**
- Create: `packages/react/src/format/number.ts`, `number.test.ts`
- Modify: `packages/react/src/format/index.ts`

**Interfaces:**
- Consumes: `guard`, `isFiniteNumber`, `LocaleOptions` from `format/shared.ts`.
- Produces:
  ```ts
  export type NumberFormatOptions = LocaleOptions & Intl.NumberFormatOptions
  export function formatNumber(value: number | null | undefined, options: NumberFormatOptions): string
  export function formatCurrency(value: number | null | undefined, options: NumberFormatOptions & { currency: string }): string
  export function formatPercent(value: number | null | undefined, options: NumberFormatOptions): string   // value is a ratio: 0.125 → 13%
  export function formatPercentChange(previous: number | null | undefined, current: number | null | undefined, options: NumberFormatOptions): string
  export function formatCompact(value: number | null | undefined, options: NumberFormatOptions): string
  export function formatOrdinal(value: number | null | undefined, options: LocaleOptions): string
  export function formatBytes(value: number | null | undefined, options: LocaleOptions & { maximumFractionDigits?: number | undefined }): string
  ```

- [ ] **Step 1: Write `number.test.ts`.**

  | Call | Expected |
  |---|---|
  | `formatNumber(1234567.891, { locale: 'de-DE' })` | `'1.234.567,891'` |
  | `formatNumber(1234567.891, { locale: 'fr-FR' })` | `'1\u202f234\u202f567,891'` |
  | `formatNumber(1234567.891, { locale: 'en-IN' })` | `'12,34,567.891'` |
  | `formatNumber(1234567.891, { locale: 'he-IL' })` | `'1,234,567.891'` |
  | `formatNumber(NaN, …)`, `formatNumber(Infinity, …)`, `formatNumber(null, …)` | `''` |
  | `formatNumber(1, { locale: 'en_US' })` | `''` (**Review Focus 5**) |
  | `formatCurrency(1234.5, { locale: 'en-US', currency: 'USD' })` | `'$1,234.50'` |
  | `formatCurrency(1234.5, { locale: 'de-DE', currency: 'EUR' })` | `'1.234,50\u00a0€'` |
  | `formatCurrency(1234.5, { locale: 'ja-JP', currency: 'JPY' })` | `'￥1,235'` |
  | `formatCurrency(1234.5, { locale: 'he-IL', currency: 'ILS' })` | `'\u200f1,234.50\u00a0\u200f₪'` |
  | `formatCurrency(1, { locale: 'en-US', currency: 'XX' })` | `''` (invalid currency code throws inside `Intl`) |
  | `formatPercent(0.125, { locale: 'en-US' })` | `'13%'` |
  | `formatPercent(0.125, { locale: 'en-US', maximumFractionDigits: 1 })` | `'12.5%'` |
  | `formatPercent(0.125, { locale: 'de-DE' })` | `'13\u00a0%'` |
  | `formatPercentChange(80, 90, { locale: 'en-US' })` | `'+12.5%'` |
  | `formatPercentChange(100, 97, { locale: 'en-US' })` | `'-3%'` (ICU's hyphen-minus, not U+2212) |
  | `formatPercentChange(100, 97, { locale: 'de-DE' })` | `'-3\u00a0%'` |
  | `formatPercentChange(50, 50, { locale: 'en-US' })` | `'0%'` |
  | `formatPercentChange(-50, -25, { locale: 'en-US' })` | `'+50%'` (divides by the base's magnitude) |
  | `formatPercentChange(0, 10, …)` | `''` (zero base) |
  | `formatCompact(1234567, { locale: 'en-US' })` | `'1.2M'` |
  | `formatCompact(1234567, { locale: 'de-DE' })` | `'1,2\u00a0Mio.'` |
  | `formatCompact(1234567, { locale: 'ja-JP' })` | `'123万'` |

  `formatPercentChange` computes `(current - previous) / Math.abs(previous)` and formats it with `style: 'percent'`, `signDisplay: 'exceptZero'` and `maximumFractionDigits: 1` as defaults the caller can override.

  **`formatOrdinal`** uses `Intl.PluralRules(locale, { type: 'ordinal' })` for English, and a suffix table keyed by the locale's **language** (`new Intl.Locale(locale).language`), per spec §5.2:
  ```ts
  const EN = { one: 'st', two: 'nd', few: 'rd', other: 'th' }
  const FR = { one: 'er', other: 'e' }            // French ordinal rules yield only one/other
  const TRAILING_DOT = new Set(['de', 'da', 'nb', 'nn', 'no', 'fi', 'cs', 'sk', 'sl', 'hr', 'hu', 'et', 'lv', 'is', 'pl', 'tr'])
  ```
  Each number is formatted with `formatNumber` for the locale before the suffix is added. A language not in the table returns the bare formatted number.

  | Call | Expected |
  |---|---|
  | en-US: 1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112 | `1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 23rd 101st 111th 112th` |
  | `formatOrdinal(1, { locale: 'fr-FR' })`, `(2, fr-FR)` | `'1er'`, `'2e'` |
  | `formatOrdinal(3, { locale: 'de-DE' })` | `'3.'` |
  | `formatOrdinal(5, { locale: 'ja-JP' })` | `'5'` (no table entry, so no English suffix) |
  | `formatOrdinal(1.5, …)`, `formatOrdinal(-1, …)` | `''` (ordinals are non-negative integers) |

  **`formatBytes`** is SI: steps of 1000 through `byte`, `kilobyte`, `megabyte`, `gigabyte`, `terabyte`, `petabyte`. The `byte` unit uses `unitDisplay: 'long'` and the others `'short'` (fact 6). `maximumFractionDigits` defaults to 1. **Choose the unit, round to `maximumFractionDigits`, and if the rounded value is at least 1000 and a larger unit exists, step up** (fact 5). A negative value is scaled by its magnitude and keeps its sign.

  | Call (en-US unless stated) | Expected |
  |---|---|
  | `0` | `'0 bytes'` |
  | `1` | `'1 byte'` |
  | `512` | `'512 bytes'` |
  | `1500` | `'1.5 kB'` |
  | `1_500_000` | `'1.5 MB'` |
  | `999_950` | `'1 MB'` (**Review Focus 3**) |
  | `2e15` | `'2 PB'` |
  | `5e18` | `'5,000 PB'` (no unit past petabyte) |
  | `512`, de-DE | `'512 Byte'` |
  | `1500`, de-DE | `'1,5 kB'` |
  | `1500`, fr-FR | `'1,5\u202fko'` |
  | `-1500` | `'-1.5 kB'` |
  | `NaN` | `''` |

  Perturbations: drop the step-up (Review Focus 3 row fails); use `'short'` for bytes (the `512` row fails); map an unknown language to `EN` (the ja-JP row fails).

- [ ] **Step 2: Run, watch them fail, implement, export from the barrel.**
- [ ] **Step 3: Run** the format tests on the default Node and under `npx --yes node@22.22.0 …`, plus `npm run typecheck` and `npm run test:guards`. Apply and revert the perturbations.
- [ ] **Step 4: Commit:** `feat(format): number, currency, percent, ordinal and byte formatters`.

---

### Task 3: Text, sorting and address formatters

**Files:**
- Create: `packages/react/src/format/text.ts`, `text.test.ts`, `address.ts`, `address.test.ts`
- Modify: `packages/react/src/format/index.ts`

**Interfaces:**
- Consumes: `guard`, `LocaleOptions`, `formatNumber` (for `pluralize`'s `{count}`).
- Produces:
  ```ts
  export interface PersonName { given?: string | undefined; family?: string | undefined; displayName?: string | undefined; order?: 'given-first' | 'family-first' | undefined }
  export function formatName(name: PersonName | null | undefined, options: LocaleOptions & { form?: 'display' | 'initials' | undefined }): string
  export function formatList(items: readonly string[] | null | undefined, options: LocaleOptions & Intl.ListFormatOptions): string
  export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }
  export function pluralize(count: number | null | undefined, forms: PluralForms, options: LocaleOptions & { type?: Intl.PluralRuleType | undefined }): string
  export function truncate(text: string | null | undefined, options: LocaleOptions & { length: number; ellipsis?: string | undefined }): string
  export function collator(locale: string, options?: Intl.CollatorOptions): (a: string, b: string) => number
  export interface PostalAddress { name?: string | undefined; organization?: string | undefined; lines?: readonly string[] | undefined; locality?: string | undefined; region?: string | undefined; postalCode?: string | undefined; country: string }
  export function formatAddress(address: PostalAddress | null | undefined, options: LocaleOptions & { form?: 'multiline' | 'single' | undefined }): string
  ```

- [ ] **Step 1: Write `text.test.ts`.**

  **`formatName`** (spec §5.3: the order comes from the record, never the locale; `displayName` wins; particles are a documented limitation). `order` defaults to `'given-first'`. Parts are trimmed, and empty parts are dropped. The two parts join with a space, **except** when both consist only of Han, Hiragana, Katakana or Hangul characters (`/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+$/u`), which join with no space. Initials take the first **grapheme** of each part via `Intl.Segmenter`, in display order, uppercased with `toLocaleUpperCase(locale)`. With only `displayName`, initials come from its first and last whitespace-separated words.

  | Call | Expected |
  |---|---|
  | `{ given: 'Ada', family: 'Lovelace' }`, en-US | `'Ada Lovelace'` |
  | `{ given: 'Ada', family: 'Lovelace', order: 'family-first' }`, en-US | `'Lovelace Ada'` |
  | `{ given: '太郎', family: '山田', order: 'family-first' }`, **en-US** | `'山田太郎'` (order and joining come from the record, not the reader) |
  | `{ given: 'Ada', family: 'Lovelace' }`, **ja-JP** | `'Ada Lovelace'` (a Japanese reader does not reorder a Western name) |
  | `{ given: 'Ada', family: 'Lovelace', displayName: 'Countess of Lovelace' }` | `'Countess of Lovelace'` |
  | `{ given: '  Ada ', family: '' }` | `'Ada'` |
  | `{ given: 'Ada', family: 'Lovelace' }`, `form: 'initials'` | `'AL'` |
  | `{ given: 'ölaf', family: 'berg' }`, de-DE, initials | `'ÖB'` |
  | `{ given: 'istanbul', family: 'x' }`, tr-TR, initials | `'İX'` (locale-aware uppercase) |
  | `{ displayName: 'Grace Brewster Hopper' }`, initials | `'GH'` |
  | `{}` or `null` | `''` |

  | Call | Expected |
  |---|---|
  | `formatList(['a', 'b', 'c'], { locale: 'en-US' })` | `'a, b, and c'` |
  | `formatList(['a', 'b', 'c'], { locale: 'en-GB' })` | `'a, b and c'` |
  | `formatList(['a', 'b', 'c'], { locale: 'de-DE', type: 'disjunction' })` | `'a, b oder c'` |
  | `formatList(['a', 'b', 'c'], { locale: 'ja-JP' })` | `'a、b、c'` |
  | `formatList(['א', 'ב', 'ג'], { locale: 'he-IL' })` | `'א, ב וג'` |
  | `formatList([], …)` | `''` |

  **`pluralize`** selects `forms[rule] ?? forms.other` and replaces every `{count}` with `formatNumber(count, { locale })`.

  | Call | Expected |
  |---|---|
  | `pluralize(1, { one: '{count} file', other: '{count} files' }, { locale: 'en-US' })` | `'1 file'` |
  | `pluralize(1234, { one: '{count} file', other: '{count} files' }, { locale: 'en-US' })` | `'1,234 files'` |
  | `pluralize(3, { one: '{count} файл', few: '{count} файла', many: '{count} файлов', other: '{count} файла' }, { locale: 'ru-RU' })` | `'3 файла'` |
  | `pluralize(5, <same>, { locale: 'ru-RU' })` | `'5 файлов'` |
  | `pluralize(2, { other: 'items' }, …)` | `'items'` (missing category falls back to `other`) |
  | `pluralize(NaN, …)` | `''` |

  **`truncate`** counts graphemes with `Intl.Segmenter(locale, { granularity: 'grapheme' })`. If the text has at most `length` graphemes, it is returned unchanged. Otherwise it returns the first `length - 1` graphemes, trailing whitespace trimmed, plus `ellipsis` (default `'…'`).

  | Call | Expected |
  |---|---|
  | `truncate('Hello world', { locale: 'en', length: 20 })` | `'Hello world'` |
  | `truncate('Hello world', { locale: 'en', length: 7 })` | `'Hello…'` (the trailing space is trimmed) |
  | `truncate('👩\u200d👩\u200d👧éxyz', { locale: 'en', length: 3 })` | `'👩\u200d👩\u200d👧é…'` (the family emoji and the combining accent each count as one) |
  | `truncate('abc', { locale: 'en', length: 0 })` | `''` |

  **`collator`** returns `new Intl.Collator(locale, options).compare`.

  | Call | Expected |
  |---|---|
  | `['Zoë', 'Émile', 'alice', 'Bob', 'zed', 'Ölaf'].sort(collator('de-DE'))` | `['alice', 'Bob', 'Émile', 'Ölaf', 'zed', 'Zoë']` |
  | `['Zoë', 'Ölaf', 'alice'].sort(collator('sv-SE'))` | `['alice', 'Zoë', 'Ölaf']` (Ö sorts after Z in Swedish) |

- [ ] **Step 2: Write `address.test.ts`.** `formatAddress` renders a template per country. Each template line is built by joining its non-empty parts, and a line that comes out empty is dropped. `multiline` joins lines with `'\n'`; `single` joins them with `', '`. `country` is an ISO 3166-1 alpha-2 code, compared case-insensitively.

  The template table (exact; `L` is `address.lines`, spread one per line):

  | Countries | Lines, in order |
  |---|---|
  | US, CA | name; organization; …L; `{locality}, {region} {postalCode}` |
  | GB | name; organization; …L; locality; region; postalCode |
  | IE | name; organization; …L; locality; region; postalCode |
  | AU | name; organization; …L; `{locality} {region} {postalCode}` |
  | NZ | name; organization; …L; `{locality} {postalCode}` |
  | DE, FR, NL | name; organization; …L; `{postalCode} {locality}` |
  | IN | name; organization; …L; `{locality} {postalCode}`; region |
  | SG | name; organization; …L; `{locality} {postalCode}` |
  | JP | `〒{postalCode}`; `{region}{locality}`; …L; organization; name (Japanese order, largest to smallest; documented as assuming Japanese-script data) |
  | anything else | name; organization; …L; `{locality} {region} {postalCode}` |

  In `{locality}, {region} {postalCode}`, the comma is emitted only when both locality and something after it are present. In `〒{postalCode}`, the mark is emitted only when there is a postal code. Then comes the country line: `new Intl.DisplayNames(locale, { type: 'region' }).of(country)`, **omitted when `new Intl.Locale(locale).maximize().region` equals the country** (fact 12).

  | Call | Expected |
  |---|---|
  | US address `{ name: 'Ada Lovelace', lines: ['1 Main St', 'Apt 2'], locality: 'Springfield', region: 'IL', postalCode: '62701', country: 'US' }`, en-US | `'Ada Lovelace\n1 Main St\nApt 2\nSpringfield, IL 62701'` (no country line) |
  | same, en-GB | `…\nSpringfield, IL 62701\nUnited States` |
  | same, de-DE | `…\nSpringfield, IL 62701\nVereinigte Staaten` |
  | same, en-US, `form: 'single'` | `'Ada Lovelace, 1 Main St, Apt 2, Springfield, IL 62701'` |
  | DE `{ lines: ['Hauptstr. 5'], locality: 'Berlin', postalCode: '10115', country: 'de' }`, de-DE | `'Hauptstr. 5\n10115 Berlin'` (lowercase code accepted) |
  | GB `{ lines: ['10 Downing St'], locality: 'London', postalCode: 'SW1A 2AA', country: 'GB' }`, en-US | `'10 Downing St\nLondon\nSW1A 2AA\nUnited Kingdom'` |
  | JP `{ name: '山田太郎', lines: ['1-2-3'], locality: '千代田区', region: '東京都', postalCode: '100-0001', country: 'JP' }`, ja-JP | `'〒100-0001\n東京都千代田区\n1-2-3\n山田太郎'` |
  | US, no region: `{ locality: 'Springfield', postalCode: '62701', country: 'US' }`, en-US | `'Springfield 62701'` (no dangling comma) |
  | `{ locality: 'Paris', country: 'FR' }`, en-US | `'Paris\nFrance'` |
  | unknown `{ locality: 'Atlantis', postalCode: '1', country: 'ZZ' }`, en-US | `'Atlantis 1
Unknown Region'` (generic template; `'Unknown Region'` is ICU's label for `ZZ`, verified on both Node versions) |
  | `null`, or `{ country: '' }` | `''` |

  Perturbations: derive the reader region from `new Intl.Locale(locale).region` (unmaximised, so `'en'` has none) and check that the en-US row still passes, because `'en-US'` has an explicit region; then **add a row** for `locale: 'en'` with a US address expecting no country line, and confirm the perturbation fails it. Emit the comma unconditionally (the no-region row fails).

- [ ] **Step 3: Run, watch them fail, implement, export from the barrel.**
- [ ] **Step 4: Run** the format tests on both Node versions, plus `typecheck` and `test:guards`. Apply and revert the perturbations.
- [ ] **Step 5: Commit:** `feat(format): name, list, plural, truncate, collator and address formatters`.

---

### Task 4: PII masking

**Files:**
- Create: `packages/react/src/format/mask.ts`, `mask.test.ts`
- Modify: `packages/react/src/format/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export function maskEmail(value: string | null | undefined): string
  export function maskPhone(value: string | null | undefined): string
  export function maskCardNumber(value: string | null | undefined): string
  export function maskTaxId(value: string | null | undefined, country: string): string
  ```
  No locale: masking is plain string work (spec §5.5.2). The mask character is always `*`.

**The rule shared by all four** (`maskKeepingLast(value, keep, isMaskable)`): walk the string, and replace every maskable character except the last `keep` maskable ones with `*`. Every other character (separators, spaces, `+`, parentheses) passes through unchanged, so the output is the same length as the input and stays aligned with it. **If the value has no more than `keep` maskable characters, mask all of them** (Review Focus 2). For `maskPhone` and `maskCardNumber`, the maskable characters are ASCII digits and `keep` is 4. For `maskTaxId` they are ASCII letters and digits.

**`maskTaxId`'s table**, copied into `mask.ts` as a comment above the constant **with the full citations from spec §5.5.2**: source name, section, URL and strength (law, regulation, guidance, guidance by analogy).
```ts
// Countries whose output differs from the generic rule. Spec §5.5.2 lists the
// cited rules for US, IN and SG, which equal the generic last-four rule.
const KEEP_BY_COUNTRY: Readonly<Record<string, number>> = { CA: 3 }
const DEFAULT_KEEP = 4
```
The comment lists US, IN and SG with their citations as "cited, equal to the generic rule". It lists CA with its citation and the strength "official guidance by analogy". It lists every uncited country from spec §5.5.2 by name, and ends with the rule: **a country is added only with a source.**

- [ ] **Step 1: Write `mask.test.ts`.**

  | Call | Expected |
  |---|---|
  | `maskEmail('john.doe@example.com')` | `'j*******@example.com'` |
  | `maskEmail('a@example.com')` | `'*@example.com'` (a one-character local part is masked whole) |
  | `maskEmail('no-at-sign')`, `maskEmail('')`, `maskEmail(null)` | `''` |
  | `maskEmail('x@y@example.com')` | `'x**@example.com'` (the **last** `@` splits, so the local part is `x@y`) |
  | `maskPhone('+1 (555) 123-4567')` | `'+* (***) ***-4567'` |
  | `maskPhone('020 7946 0958')` | `'*** **** 0958'` |
  | `maskCardNumber('4111 1111 1111 1111')` | `'**** **** **** 1111'` |
  | `maskCardNumber('4111111111111111')` | `'************1111'` |
  | `maskTaxId('123-45-6789', 'US')` | `'***-**-6789'` |
  | `maskTaxId('12-3456789', 'US')` (EIN) | `'**-***6789'` |
  | `maskTaxId('123-456-789', 'CA')` | `'***-***-789'` |
  | `maskTaxId('123-456-789', 'ca')` | `'***-***-789'` (case-insensitive) |
  | `maskTaxId('1234 5678 9012', 'IN')` | `'**** **** 9012'` |
  | `maskTaxId('S1234567A', 'SG')` | `'*****567A'` |
  | `maskTaxId('AB123456C', 'GB')` | `'*****456C'` (uncited, so the generic rule) |
  | `maskTaxId('1234', 'US')`, `maskTaxId('12', 'DE')`, `maskTaxId('789', 'CA')` | `'****'`, `'**'`, `'***'` (**Review Focus 2**) |
  | `maskTaxId('', 'US')`, `maskTaxId(null, 'US')` | `''` |
  | determinism | every function returns identical output for identical input across 3 calls |


  Perturbations: return the input unchanged when `count <= keep` (Review Focus 2 fails); key CA on `'CA'` only, without uppercasing (the `'ca'` row fails); split on the first `@` (the double-`@` row fails).

- [ ] **Step 2: Run, watch them fail, implement, export from the barrel.**
- [ ] **Step 3: Run** on both Node versions, plus `typecheck` and `test:guards`. Apply and revert the perturbations.
- [ ] **Step 4: Commit:** `feat(format): PII masks with a cited per-country tax-ID table`.

---

### Task 5: `./format/phone` and the phone isolation gate

**Files:**
- Create: `packages/react/src/format/phone.ts`, `phone.test.ts`, `packages/react/src/gates/phone-isolation.gate.test.ts`
- Modify: `packages/react/package.json`, root `package.json` (`devDependencies`, `test:guards`), `package-lock.json`, `packages/react/src/gates/package-shape.gate.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PhoneFormat = 'national' | 'international' | 'E.164'
  export function formatPhone(value: string | null | undefined, options?: { format?: PhoneFormat | undefined; defaultCountry?: string | undefined }): string  // default format 'international'
  ```

- [ ] **Step 1: Dependencies.** In `packages/react/package.json`, add `"libphonenumber-js": "^1.13.13"` to `peerDependencies`, add `"peerDependenciesMeta": { "libphonenumber-js": { "optional": true } }`, and add `"./format/phone": "./src/format/phone.ts"` to `exports`. At the root, `npm install -D libphonenumber-js@1.13.13`. Check the lockfile diff and revert `libc` noise.

- [ ] **Step 2: Write `phone.test.ts`.** Import from `libphonenumber-js/min` only. After installing, confirm that `parsePhoneNumberFromString(text, defaultCountry?)` returns `PhoneNumber | undefined` and that `.format('NATIONAL' | 'INTERNATIONAL' | 'E.164')` exists, by reading `node_modules/libphonenumber-js/min/index.d.ts`. If the API differs, stop and report.

  | Call | Expected |
  |---|---|
  | `formatPhone('+442079460958')` | `'+44 20 7946 0958'` |
  | `formatPhone('+442079460958', { format: 'national' })` | `'020 7946 0958'` |
  | `formatPhone('(213) 373-4253', { defaultCountry: 'US', format: 'E.164' })` | `'+12133734253'` |
  | `formatPhone('2133734253', { defaultCountry: 'US', format: 'national' })` | `'(213) 373-4253'` |
  | `formatPhone('  not a phone  ')` | `'not a phone'` (unparseable: the trimmed input) |
  | `formatPhone('2133734253')` (no `+`, no default country) | `'2133734253'` |
  | `formatPhone('', …)`, `formatPhone(null)` | `''` |
  | `formatPhone('+12133734253', { defaultCountry: 'XX' })` | `'+1 213 373 4253'` (an unknown default country must not throw when the number carries its own) |

  If any expected string differs because of `libphonenumber-js` metadata, record the observed output in the report and in the test as `observed`. Do not change the rule.

- [ ] **Step 3: Implement `phone.ts`.** No `'use client'`. Wrap the parse in a try/catch: on failure, or when the parse returns `undefined`, return the trimmed input. **`format/index.ts` does not export it.**

- [ ] **Step 4: Write `phone-isolation.gate.test.ts`.** Build the import graph from source text: for each file, collect `from '…'`, `import '…'` and `import('…')` specifiers. Resolve a relative specifier ending in `.js` to the `.ts` or `.tsx` beside it (`./x.js` → `x.ts` or `x.tsx`; `./dir/index.js` the same way). Bare specifiers are leaves. Then assert:
  - from `src/format/index.ts`, the reachable set contains no specifier starting with `libphonenumber-js`;
  - from `src/hooks/index.ts`, the same;
  - across every non-test source under `src`, the only file that imports `libphonenumber-js` is `src/format/phone.ts`;
  - the walk from `format/index.ts` reached at least `date.ts`, `number.ts`, `text.ts`, `address.ts` and `mask.ts`, so a resolver bug cannot pass vacuously. **Write this assertion first and run it alone:** it must pass before the isolation assertions mean anything. If `hooks/index.ts` does not exist yet, the hooks assertion is `it.todo` until Task 6 creates it. **Task 6 converts it.**

  Add the gate to `test:guards`. Perturbations: `export * from './phone.js'` in `format/index.ts` (fails); import `libphonenumber-js` in `date.ts` (fails both the reachability and the only-importer assertion).

- [ ] **Step 5: Extend `package-shape.gate.test.ts`:** `./format/phone` exists and resolves; `peerDependencies['libphonenumber-js']` exists; `peerDependenciesMeta['libphonenumber-js'].optional === true`; `libphonenumber-js` is **not** in `dependencies`. Perturbation: move it to `dependencies` (fails).

- [ ] **Step 6: Run** the format tests on both Node versions, plus `test:guards` and `typecheck`. Commit: `feat(format): phone subpath on libphonenumber-js/min, isolation gate`.

---

### Task 6: SSR and state hooks, the `matchMedia` exemption

**Files:**
- Create: `packages/react/src/hooks/useMediaQuery.ts`, `useMediaQuery.test.tsx`, `useMediaQuery.ssr.test.tsx`, `useReducedMotion.ts`, `useReducedMotion.test.tsx`, `useControllableState.ts`, `useControllableState.test.tsx`, `useDisclosure.ts`, `useDisclosure.test.tsx`, `useToggle.ts`, `useToggle.test.tsx`, `usePrevious.ts`, `usePrevious.test.tsx`, `useDebouncedValue.ts`, `useDebouncedValue.test.tsx`
- Modify: `packages/react/src/hooks/index.ts`, `packages/react/src/gates/ssr-safety.gate.test.ts`, `packages/react/src/gates/phone-isolation.gate.test.ts` (convert the `it.todo`)

**Interfaces:**
- Produces:
  ```ts
  export function useMediaQuery(query: string, ssrDefault: boolean): boolean
  export function useReducedMotion(): boolean
  export interface UseControllableStateOptions<T> { value?: T | undefined; defaultValue: T; onChange?: ((value: T) => void) | undefined; name?: string | undefined }
  export function useControllableState<T>(options: UseControllableStateOptions<T>): [T, (next: T | ((prev: T) => T)) => void]
  export interface UseDisclosureOptions { open?: boolean | undefined; defaultOpen?: boolean | undefined; onOpenChange?: ((open: boolean) => void) | undefined }
  export interface Disclosure { open: boolean; setOpen: (open: boolean) => void; onOpen: () => void; onClose: () => void; onToggle: () => void }
  export function useDisclosure(options?: UseDisclosureOptions): Disclosure
  export function useToggle(initial?: boolean): [boolean, () => void, (value: boolean) => void]
  export function usePrevious<T>(value: T): T | null      // previous DISTINCT value (fact 7)
  export function useDebouncedValue<T>(value: T, delayMs: number): T
  ```

- [ ] **Step 1: `useMediaQuery` tests.** jsdom has no `matchMedia`, so install a controllable fake on the global object in `beforeEach` and remove it in `afterEach`. It needs `matches`, `addEventListener('change')`, `removeEventListener` and a test-side `set(matches)` that fires `change`.
  - The first client render under `createRoot` returns the **live** value (a client-only mount has no server pass to match).
  - It updates on `change`, and unsubscribes on unmount (the listener count returns to 0).
  - Changing `query` re-subscribes to the new query.
  - **Hydration:** `renderToString` a probe with `ssrDefault: false` while the fake reports `true`, then `hydrateRoot`. The first hydration render records `false`, the final value is `true`, and `console.error` (spied) records no hydration mismatch. Perturbation: return `getSnapshot` from `getServerSnapshot` (mismatch error, or a first value of `true`).
  - `useMediaQuery.ssr.test.tsx` (node): `renderToString` yields `ssrDefault` for both `true` and `false`, and asserts `typeof window === 'undefined'`.
  - `useReducedMotion` asserts it queries exactly `'(prefers-reduced-motion: reduce)'` and defaults to `false` on the server.

- [ ] **Step 2: Implement `useMediaQuery.ts`.** The shape the Step 4 gate asserts on:
  ```ts
  'use client'
  import { useCallback, useSyncExternalStore } from 'react'

  function subscribeMediaQuery(query: string, onChange: () => void): () => void {
    const list = window.matchMedia(query)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }

  function readMediaQuery(query: string): boolean {
    return window.matchMedia(query).matches
  }

  export function useMediaQuery(query: string, ssrDefault: boolean): boolean {
    const subscribe = useCallback((onChange: () => void) => subscribeMediaQuery(query, onChange), [query])
    const getSnapshot = useCallback(() => readMediaQuery(query), [query])
    return useSyncExternalStore(subscribe, getSnapshot, () => ssrDefault)
  }
  ```
  The JSDoc states ADR-0005's rule and why `ssrDefault` is required.

- [ ] **Step 3: State hook tests and implementations.**
  - `useControllableState` is built on `useControlled` (passing `name ?? 'useControllableState'`) plus `useStableCallback` for `onChange` and `useValueAsRef` for the latest value. `setValue` resolves an updater against the **latest** value, does nothing when `Object.is(next, current)`, and otherwise sets the uncontrolled state and calls `onChange(next)`. `setValue` is referentially stable across renders.

    Tests:
    - In uncontrolled mode, the value updates and `onChange` fires once.
    - In controlled mode, the value does not change until the parent passes it, and `onChange` fires.
    - Setting the same value does not fire `onChange`.
    - Two updater calls in one handler, uncontrolled, compose (`prev + 1` twice gives `+2`).
    - `setValue` is the same function across a re-render.

    Perturbation: drop the `Object.is` check (the same-value test fails).
  - `useDisclosure` maps onto `useControllableState<boolean>` (`defaultValue: defaultOpen ?? false`). Test `onOpen`, `onClose`, `onToggle` and `setOpen`, and that `onOpenChange` fires once per change.
  - `useToggle`: `toggle` flips the value; `set(true)` is idempotent; both functions are stable.
  - `usePrevious` wraps `usePreviousValue`. Tests:
    - It is `null` on the first render.
    - After a change from `1` to `2`, it is `1`.
    - **After an unrelated re-render with `2` unchanged, it is still `1`.** This is the "distinct" semantics, and the JSDoc says so.
  - `useDebouncedValue` stores the debounced value in state, and re-arms a `useTimeout` timer in an effect keyed on `[value, delayMs]`. Tests, with `vi.useFakeTimers()`:
    - It equals the initial value at once.
    - A change is not visible at `delayMs - 1` and is visible at `delayMs`.
    - A second change inside the window restarts it.
    - An unmount before the delay sets no state: no React "update on an unmounted component" error, and `console.error` stays clean.

- [ ] **Step 4: The `matchMedia` exemption in `ssr-safety.gate.test.ts`.** Add `USE_MEDIA_QUERY_PATH = join(SRC, 'hooks', 'useMediaQuery.ts')`, filtered out of the `matchMedia` and `window.` rules only. That is the same mechanism as the ThemeProvider exemption at lines 80-95, and the comment explains why. Then add a `describe` in the ThemeProvider AST style (`ts.createSourceFile`, lines 160+):
  - the file exists;
  - every `matchMedia` and `window` identifier lies inside a function declaration named `subscribeMediaQuery` or `readMediaQuery`;
  - the `useMediaQuery` function body names neither identifier;
  - the query fails loudly if `useMediaQuery` is not found, as the existing ThemeProvider check does.

  Perturbation: inline `window.matchMedia(query).matches` into the hook body (the AST assertion fails while the text rule stays exempt). That is exactly the bypass the AST check exists for.

- [ ] **Step 5: Barrel.** `hooks/index.ts` exports every hook from this task and the existing two, plus `useTheme` and `useColorScheme` from `../providers/ThemeProvider.js`, and every public option type. Convert Task 5's `it.todo` in `phone-isolation.gate.test.ts` to a real assertion. Add a test that walking `hooks/index.ts` reaches `useMediaQuery.ts`, so it cannot pass vacuously.

- [ ] **Step 6: Run** `npx vitest run --project unit packages/react/src/hooks`, the same under Node 22, plus `test:guards` and `typecheck`. Apply and revert each perturbation. Commit: `feat(hooks): media query, reduced motion and state hooks on @base-ui/utils`.

---

### Task 7: DOM and accessibility hooks

**Files:**
- Create: `packages/react/src/hooks/useClickOutside.ts`, `useResizeObserver.ts`, `useIntersectionObserver.ts`, `useEventListener.ts`, `useCopyToClipboard.ts`, `useAnnounce.ts`, `useFocusReturn.ts`, each with a `.test.tsx`
- Create: `packages/react/src/notifications/context.ts`
- Modify: `packages/react/src/notifications/NotificationProvider.tsx` (import the context instead of declaring it), `packages/react/src/hooks/index.ts`

**Interfaces:**
- Consumes: `announce` from `notifications/api.ts`; `NotificationContext` from `notifications/context.ts`; `ownerDocument` from `@base-ui/utils/owner`; `useStableCallback`, `useTimeout`.
- Produces:
  ```ts
  export function useClickOutside(ref: RefObject<Element | null>, handler: (event: PointerEvent) => void, options?: { enabled?: boolean | undefined }): void
  export function useResizeObserver(ref: RefObject<Element | null>): { width: number; height: number } | undefined
  export function useIntersectionObserver(ref: RefObject<Element | null>, options?: { root?: Element | null | undefined; rootMargin?: string | undefined; threshold?: number | readonly number[] | undefined }): IntersectionObserverEntry | undefined
  export function useEventListener<K extends string>(target: EventTarget | RefObject<EventTarget | null> | null | undefined, type: K, handler: (event: Event) => void, options?: AddEventListenerOptions): void
  export function useCopyToClipboard(options?: { resetMs?: number | undefined }): [copied: boolean, copy: (text: string) => Promise<boolean>]
  export function useAnnounce(): typeof announce
  export function useFocusReturn(active: boolean): void
  ```

- [ ] **Step 1: Move `NotificationContext`.** Create `notifications/context.ts` (`'use client'`, `export const NotificationContext = createContext(false)`, with the existing JSDoc). `NotificationProvider.tsx` imports it, with no other change. Run the notification tests: they all pass, unchanged.

- [ ] **Step 2: Tests and implementations.** All listeners attach in effects and detach on cleanup. Handlers go through `useStableCallback`, so a new handler does not re-subscribe.
  - **`useClickOutside`** listens for `pointerdown` on `ownerDocument(ref.current)` and calls the handler when `!event.composedPath().includes(ref.current)`. Tests, using `fireEvent.pointerDown`:
    - Inside does not fire; outside fires.
    - `enabled: false` does not fire.
    - Unmount removes the listener.
    - A changed handler is used without re-subscribing (spy on `addEventListener`: called once across a re-render with a new handler).
    - **Shadow DOM:** an element inside an open shadow root attached under `ref` counts as inside.

    Perturbation: `ref.current.contains(event.target)` (the shadow test fails, because the event retargets to the host).
  - **`useResizeObserver`** and **`useIntersectionObserver`**: jsdom lacks both, so the tests install a fake class that records instances and exposes `trigger(entries)`, and remove it after. Tests:
    - The value is `undefined` before any callback; after `trigger`, it is `{ width, height }` from `contentRect` (resize) or the entry itself (intersection).
    - The observer is disconnected on unmount.
    - With the global class absent, the hook returns `undefined` and does not throw.
    - Intersection re-observes when `threshold` changes from `0.5` to `[0, 1]`, and **not** when it re-renders with an equal array literal. Key the effect on `String(threshold)`, `rootMargin` and `root`.
  - **`useEventListener`**: the target may be an `EventTarget`, a ref, `null` or `undefined`, and the latter two attach nothing. It re-subscribes when the target, type, `capture`, `passive` or `once` change, but not for a new handler. Test with a `div` target and a ref target.
  - **`useCopyToClipboard`**: `copy(text)` calls `navigator.clipboard.writeText`, sets `copied` to `true`, resolves `true`, and resets `copied` to `false` after `resetMs` (fake timers, default 2000). When `navigator.clipboard` is missing, or `writeText` rejects, it resolves `false` and leaves `copied` `false`. Stub `navigator.clipboard` with `vi.stubGlobal` or `Object.defineProperty`, and restore it. Perturbation: let the rejection propagate (the denied test fails with an unhandled rejection).
  - **`useAnnounce`** reads `NotificationContext` and throws `'useAnnounce must be used inside <NotificationProvider> (or <ApProvider>).'` when it is `false`, matching `useLocale`'s message shape (`providers/LocaleProvider.tsx:50-55`). It returns `announce`, which is module-level and therefore stable. Tests:
    - It throws outside a provider.
    - Inside `NotificationProvider`, calling it writes the polite region. Mirror the existing announce test in `NotificationProvider.test.tsx`.
    - The return value is `===` the exported `announce`.
  - **`useFocusReturn(active)`** records `ownerDocument(null).activeElement` in a `useIsomorphicLayoutEffect` when `active` turns true, and restores focus when `active` turns false or on unmount, if the element is still connected and is an `HTMLElement`. The JSDoc states the contract, honestly: *call it in the component that owns the open state, and move focus into the content in an effect or later, not with `autoFocus`.* `autoFocus` runs at commit, before any layout effect can record the previous element. Tests:
    1. Focus a button, flip `active` true while a child moves focus to an input **in its own `useEffect`**, then flip false. Focus is back on the button. **Perturbation: record in `useEffect` instead of the layout effect.** Child passive effects run before the parent's, so the recorded element becomes the input and the test fails. Run the perturbation and confirm it fails before relying on it, per 5f's lesson.
    2. Unmounting while active also restores focus.
    3. A recorded element removed from the DOM is not focused, and nothing throws.

- [ ] **Step 3: Barrel exports.** Run the hooks and notification tests on both Node versions, plus `test:guards`, `typecheck`, and the phone isolation gate (the hooks graph now reaches `notifications/api.ts`; it must still not reach `libphonenumber-js`). Add one assertion to the isolation gate: the walk from `hooks/index.ts` does **not** reach `notifications/NotificationProvider.tsx` (fact 9). Perturbation: import the context from `NotificationProvider.js` in `useAnnounce.ts` (fails).

- [ ] **Step 4: Commit:** `feat(hooks): DOM, clipboard, announce and focus-return hooks`.

---

### Task 8: Storage hooks and the storage exemption

**Files:**
- Create: `packages/react/src/hooks/useStorage.ts`, `useStorage.test.tsx`, `useStorage.ssr.test.tsx`
- Modify: `packages/react/src/hooks/index.ts`, `packages/react/src/gates/ssr-safety.gate.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type StorageSetter<T> = (next: T | ((prev: T) => T)) => void
  export function useLocalStorage<T>(key: string, defaultValue: T): [T, StorageSetter<T>, () => void]
  export function useSessionStorage<T>(key: string, defaultValue: T): [T, StorageSetter<T>, () => void]
  ```

**Design (spec §5.5.3), as it must be implemented:**
- Module-level helpers own every storage access, and they are the **only** places the storage names appear: `getArea(kind)` returns the `Storage`, or `null` if accessing it throws (blocked storage throws on property access in some browsers); `readRaw(kind, key)`; `writeRaw(kind, key, raw)`; `removeRaw(kind, key)`; `subscribeStorage(kind, key, onChange)`.
- A module-level in-memory map, keyed `` `${kind}:${key}` ``, holds values whose write failed. `readRaw` checks it first.
- A module-level same-tab emitter (`Map<string, Set<() => void>>`) notifies every hook on the same `kind:key` after a write or a remove. `subscribeStorage` also listens for the `storage` event, filtered to the same area and (`event.key === key` or `event.key === null`, which `clear()` produces). The target is `ownerWindow(null)` from `@base-ui/utils/owner`, so the global window object is never named.
- The hook: `useSyncExternalStore(subscribe, () => readRaw(kind, key), () => null)`. The snapshot is the **raw string**, which is stable by value, and parsing happens in a `useMemo` over it. `null` means the default value, returned by reference. A parse failure returns the default and warns once per key in development.
- `setValue` resolves an updater against the current parsed value, serialises with `JSON.stringify`, writes (falling back to memory on any throw), and notifies. `remove` deletes from storage and from memory, and notifies. Both are stable per `key`.

- [ ] **Step 1: Write `useStorage.test.tsx`** (jsdom provides `localStorage` and `sessionStorage`; clear both in `beforeEach`):
  - It returns the default when the key is empty.
  - It reads an existing JSON value on the first client-only render.
  - `setValue(3)` writes `'3'` to storage and re-renders.
  - The updater form composes.
  - `remove()` restores the default and deletes the key.
  - **Two components on the same key in one tab both update** after one calls `setValue`. Perturbation: drop the emitter notify (fails), because `storage` events do not fire in the writing tab.
  - **A `storage` event** dispatched on the window object for the key re-renders with the new value; one for another key does not.
  - **Blocked storage:** spy on `Storage.prototype.setItem` to throw `QuotaExceededError`. `setValue(5)` does not throw, the hook shows `5`, and a second component on the key also shows `5` (memory plus emitter).
  - **Corrupt JSON:** storage holds `'{'`. The hook returns the default and warns once (two renders, one warning).
  - `useSessionStorage` writes to session storage, not local, and the two areas do not cross-talk on the same key.
  - **Hydration:** storage holds `'"stored"'`. `renderToString` (server snapshot) then `hydrateRoot`. The first hydration render is the default, the final value is `'stored'`, and there is no hydration error.

- [ ] **Step 2: Write `useStorage.ssr.test.tsx`** (node): `renderToString` returns the default, asserts `typeof window === 'undefined'`, and does not throw.

- [ ] **Step 3: Implement.** Then add the exemption in `ssr-safety.gate.test.ts`: `USE_STORAGE_PATH` is filtered out of the storage rule and the `window.` rule only. Its AST `describe` asserts:
  - every `localStorage` and `sessionStorage` identifier lies inside the function declaration `getArea`;
  - no identifier named `window` appears anywhere in the file;
  - neither `useLocalStorage` nor `useSessionStorage` names a storage identifier.

  Perturbation: `localStorage.getItem(key)` in the hook body (fails).

- [ ] **Step 4: Barrel, run both Node versions, `test:guards`, `typecheck`.** Commit: `feat(hooks): local and session storage hooks, SSR-safe, cross-tab and same-tab`.

---

### Task 9: `useFormatter` and the two-pass date rule

**Files:**
- Create: `packages/react/src/hooks/useFormatter.ts`, `useFormatter.test.tsx`, `useFormatter.ssr.test.tsx`
- Modify: `packages/react/src/hooks/index.ts`

**Interfaces:**
- Consumes: `useLocale()` from `providers/LocaleProvider.tsx` (`{ locale, timeZone?, currency }`); every locale-taking function from `format/index.ts`.
- Produces:
  ```ts
  type Bound<F> = F extends (value: infer V, options: infer O) => string ? (value: V, options?: Partial<O>) => string : never
  export interface Formatter {
    locale: string
    /** The zone dates render in right now: the provider's, else UTC until hydrated, then the browser's. */
    timeZone: string
    formatDate: Bound<typeof formatDate>; formatTime: Bound<typeof formatTime>; formatDateTime: Bound<typeof formatDateTime>
    formatDateRange: (start: DateInput, end: DateInput, options?: Partial<DateFormatOptions>) => string
    formatRelative: (value: DateInput, options: Omit<RelativeOptions, 'locale'> & { locale?: string }) => string
    formatDuration: Bound<typeof formatDuration>
    formatNumber: Bound<typeof formatNumber>; formatCurrency: (value: number, options?: Partial<NumberFormatOptions> & { currency?: string }) => string
    formatPercent: Bound<typeof formatPercent>; formatPercentChange: (previous: number, current: number, options?: Partial<NumberFormatOptions>) => string
    formatCompact: Bound<typeof formatCompact>; formatOrdinal: Bound<typeof formatOrdinal>; formatBytes: Bound<typeof formatBytes>
    formatName: Bound<typeof formatName>; formatList: Bound<typeof formatList>; formatAddress: Bound<typeof formatAddress>
    pluralize: (count: number, forms: PluralForms, options?: { type?: Intl.PluralRuleType }) => string
    truncate: (text: string, options: { length: number; ellipsis?: string }) => string
    collator: (options?: Intl.CollatorOptions) => (a: string, b: string) => number
    /** For `<time dateTime={isoFor(value)}>`; '' for an invalid input. */
    isoFor: (value: DateInput) => string
  }
  export function useFormatter(): Formatter
  ```
  If `Bound<…>` fights `exactOptionalPropertyTypes`, write the signatures out by hand. The types above are the contract; the helper type is a convenience. Masks and `formatPhone` are not bound: masks take no locale, and phone would pull `libphonenumber-js` into `./hooks`.

- [ ] **Step 1: Write the tests.**
  - `useFormatter.test.tsx` (jsdom), inside `<LocaleProvider locale="de-DE" currency="EUR" timeZone="Asia/Tokyo">`:
    - `formatCurrency(1234.5)` is `'1.234,50\u00a0€'`.
    - `formatDate(Date.UTC(2026, 2, 5, 23, 30))` is `'06.03.2026'` (the provider zone is honoured).
    - A per-call override wins: `formatDate(T, { timeZone: 'UTC' })` is `'05.03.2026'`.
    - `timeZone` is `'Asia/Tokyo'`.
    - The returned object is referentially stable across a re-render with the same provider values.
  - **Review Focus 4.** Use a provider with **no** `timeZone`, and stub `Intl.DateTimeFormat.prototype.resolvedOptions` to report `timeZone: 'Asia/Tokyo'`, so the browser zone differs from UTC deterministically. Restore the stub after. Let `V = Date.UTC(2026, 2, 5, 23, 30)`; UTC renders `'Mar 5, 2026'` and Tokyo renders `'Mar 6, 2026'` in en-US.
    - **Hydration:** `renderToString` a probe rendering `formatDate(V)` and recording every render's text, then `hydrateRoot` the result into a container holding that HTML. The first hydration render records `'Mar 5, 2026'`, the final DOM shows `'Mar 6, 2026'`, and a spied `console.error` records no hydration mismatch.
    - **Client-only mount** (`createRoot`, as after a client-side navigation): **the first render already records `'Mar 6, 2026'`.** Perturbation: implement with `useHydrated()` (this test fails, because the first render records `'Mar 5, 2026'`).
    - **No-swap path:** with `timeZone="Asia/Tokyo"` on the provider, hydration records `'Mar 6, 2026'` on every render, and the server HTML already contains it.
  - `isoFor('2026-03-05T14:30:00Z')` is `'2026-03-05T14:30:00.000Z'`; `isoFor('nope')` is `''`.
  - `useFormatter.ssr.test.tsx` (node): with no provider `timeZone`, `renderToString` produces `'Mar 5, 2026'` for `V`, and asserts `typeof window === 'undefined'`.
  - Outside a `LocaleProvider`, it throws `useLocale`'s existing error.

- [ ] **Step 2: Implement.**
  ```ts
  const noopSubscribe = () => () => {}
  // false while hydrating (React uses the server snapshot), true for every
  // client render after, including client-only mounts.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const timeZone = provided ?? (hydrated ? new Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC')
  ```
  The bound functions are built in one `useMemo` keyed on `[locale, currency, timeZone]`. Each spreads the bound defaults first and the caller's options second, conditionally, as required by `exactOptionalPropertyTypes`. The JSDoc cites ADR-0012's two-pass rule and tells consumers to wrap output in `<time dateTime={isoFor(v)}>`.

- [ ] **Step 3: Run** on both Node versions, plus `test:guards` (the SSR gate scans the new file; nothing in it is banned) and `typecheck`. Apply and revert the `useHydrated` perturbation. Commit: `feat(hooks): useFormatter binds formatters to LocaleProvider with the two-pass date rule`.

---

### Task 10: Consumer proof and documentation

**Files:**
- Modify: `fixtures/consumer/src/main.tsx`, `docs/adr/0012-cross-cutting-services.md`, `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md` (new §5.6), `docs/CONTRIBUTING.md`

- [ ] **Step 1: Consumer fixture.** In `fixtures/consumer/src/main.tsx`, import `formatDate` from `@ap/react/format` and `useMediaQuery` from `@ap/react/hooks`, and use both so they are not tree-shaken to nothing: render `formatDate(0, { locale: 'en-US', timeZone: 'UTC' })` inside the existing `Surface`, and call `useMediaQuery` in a small component. Follow the file's comment style, and say what this proves: the subpaths resolve and typecheck for a consumer. Do **not** import `@ap/react/format/phone`. Add a comment explaining why it is absent: the fixture never installs `libphonenumber-js`, and the isolation gate is what proves `./format` does not need it. Run `npm --prefix fixtures/consumer install`, `npm --prefix fixtures/consumer run typecheck` and `npm run test:consumer`. Revert any `libc` lockfile noise.

- [ ] **Step 2: ADR-0012 amendment.** Add an "Amended 2026-10-08 (Phase 5g)" section. Do not rewrite the original decision. It records:
  - `useFieldContext` dropped (the reason from spec §5.5.1);
  - `useFormatter` added, with the two-pass rule implemented there;
  - the two spec §5.2 deviations (`formatDuration` composes; `formatOrdinal`'s suffix table);
  - the bad-input policy (`''` plus a development warning);
  - the `maskTaxId` citations and the "a country is added only with a source" rule;
  - `libphonenumber-js` as an optional peer behind `./format/phone`.

- [ ] **Step 3: Spec §5.6 "Verified during the plan".** Following §4.6.2's shape, copy in facts 1–12 above, each with its citation, plus anything the tasks found. Correct §5.5.2's `formatPercentChange` example from `−3%` to `-3%`: ICU emits a hyphen-minus (fact table, Task 2).

- [ ] **Step 4: CONTRIBUTING.** Add a short section, "Hooks and formatters":
  - which subpath each kind of code goes in;
  - formatters are pure and carry no `'use client'`;
  - expected strings use escapes for invisible characters;
  - tests must pass on Node 22.22.0 (the `npx --yes node@22.22.0 …` command);
  - never import `libphonenumber-js` outside `format/phone.ts`.

- [ ] **Step 5: Commit:** `docs: 5g ADR-0012 amendment, verified facts, contributing guidance; consumer imports subpaths`.

---

### Task 11: The CI sweep and the pull request

**Files:** none expected.

- [ ] **Step 1: Run every CI step locally, in `ci.yml`'s order.** This list is `ci.yml` as of `b222772`. If `ci.yml` has changed since, re-derive the list from it.
  ```bash
  # unit
  npm run typecheck && npm test && npm run test:gates && npm run check:lockfiles && npm run report:contrast
  # generated-artifacts-are-fresh
  npm run gen:theme-contract && npm run gen:theme-css && npm run gen:motion-css && npm run gen:fonts && npm run gen:font-metrics
  git diff --exit-code && test -z "$(git status --porcelain --untracked-files=all)"
  # consumer
  npm --prefix fixtures/consumer install && npm --prefix fixtures/consumer run typecheck && npm run test:consumer
  # ssr
  npm --prefix fixtures/ssr-app install && npm --prefix fixtures/ssr-app run typecheck
  npm run test:ssr && npm run test:spa && npm run test:hydration
  # storybook
  npm --prefix storybook run typecheck && npm run test:stories && npm --prefix storybook run build
  # showcase
  npm run showcase:install && npm --prefix showcase run typecheck && npm run showcase:test
  ```
  Also run the full unit project under Node 22.22.0 once: `npx --yes node@22.22.0 node_modules/vitest/vitest.mjs run --project unit`. Record the real numbers, and revert lockfile `libc` noise from the `install` steps. **Rows this phase is expected to hit:** `test:guards` gains the determinism, phone-isolation and package-shape gates, and the use-client and SSR gates gain new rows. `check:lockfiles` sees the two new dependencies. The consumer gate sees the new imports. The contrast gate should see **no** change, because 5g adds no colours.
- [ ] **Step 2: Stop and ask before pushing.** Once approved, push `feat/phase5g-hooks-format` and open a PR to `main` titled `Phase 5g: hooks and formatters`, with a body in the 5f PR's shape.
- [ ] **Step 3: Watch all six jobs to green.**
- [ ] **Step 4: Append "What actually happened"** to this plan, in the 5b–5f format, and commit it on the branch before merging.

---

## Verification plan

| # | Claim | Command | Must fail when… |
|---|---|---|---|
| 1 | Formatters output the pinned strings on Node 22.22.0 and Node 24 | `npm test`; `npx --yes node@22.22.0 … --project unit packages/react/src/format` | an expectation depends on ICU 78 |
| 2 | Bad input (value, locale, time zone) returns `''` and never throws | `npm test` (Tasks 1–4) | `guard`'s catch is removed |
| 3 | `formatBytes` steps up after rounding | `npm test` (Task 2) | the step-up is removed |
| 4 | Short tax IDs are fully masked; CA keeps 3 | `npm test` (Task 4) | `count <= keep` shows the value |
| 5 | Formatters are deterministic and React-free | `npm run test:guards` (determinism gate) | `new Date()` or a React import is added |
| 6 | `libphonenumber-js` is unreachable from `./format` and `./hooks` | `npm run test:guards` (isolation gate) | `format/index.ts` re-exports phone |
| 7 | Subpaths and dependency declarations are right | `npm run test:guards` (package-shape gate), `test:consumer` | an export is removed, or the peer is made required |
| 8 | Media-query and storage hooks hydrate without mismatch | `npm test` (Tasks 6, 8) | the server snapshot is the live value |
| 9 | Banned names stay out of hook bodies | `npm run test:guards` (SSR gate AST checks) | `matchMedia` or storage is read in a hook body |
| 10 | Same-tab and cross-tab storage sync; blocked storage degrades | `npm test` (Task 8) | the emitter or the memory fallback is removed |
| 11 | `useFocusReturn` records before child effects move focus | `npm test` (Task 7) | it records in a passive effect |
| 12 | `./hooks` does not pull Toast CSS | `npm run test:guards` (isolation gate, Task 7 row) | `useAnnounce` imports `NotificationProvider.tsx` |
| 13 | `useFormatter` swaps UTC → local only on hydration, never on a client-only mount | `npm test` (Task 9) | it uses `useHydrated` |
| 14 | Every CI job is green | Task 11's sweep, then the PR | — |

**Final proof artifact:** a green CI run of all six jobs on the Phase 5g pull request, plus Task 11's local sweep output, including the Node 22.22.0 unit run.
