# 0012 — Cross-cutting services: formatters, locale, hooks, notifications, icons

**Status:** Accepted — 2026-08-29

## Context

Four capabilities need to be available to every component and every consuming product: value formatting, shared hooks, notifications, and icons. Each is individually small; together they are what makes the library usable rather than merely present. They are recorded in one ADR because they share a single organising constraint — SSR-safety ([ADR-0005](0005-rendering-targets.md)) — and one shared provider stack.

## Decision

### Formatters — pure functions on `Intl`

`@ap/react/format` exports pure functions with **no React dependency**, so they work in loaders, actions, tests and Node scripts as readily as in components.

Built on `Intl.*`: zero dependencies, SSR-safe, present in Node 22.

| Group | Functions |
|---|---|
| Date/time | `formatDate`, `formatTime`, `formatDateTime`, `formatRelative` (`Intl.RelativeTimeFormat`), `formatDateRange`, `formatDuration` |
| Number | `formatNumber`, `formatCurrency`, `formatPercent`, `formatPercentChange`, `formatCompact` (1.2M), `formatOrdinal`, `formatBytes` |
| Phone | `formatPhone` — national / international / E.164 |
| Address | `formatAddress` — country-aware line ordering, single-line and multi-line |
| Text | `formatName` (display / initials), `formatList` (`Intl.ListFormat`), `pluralize` (`Intl.PluralRules`), `truncate` |
| Sorting | `collator(locale)` — `Intl.Collator`-backed comparator |
| PII masking | `maskEmail`, `maskPhone`, `maskCardNumber`, `maskTaxId` |

Two of these deserve their reasoning stated:

- **`collator`** exists because `Array.prototype.sort()` on strings is simply wrong for non-ASCII data — it sorts by code point, so accented characters land after `z`. Any product with international employee names has this bug today.
- **PII masking is centralised** so redaction is consistent and auditable across products, rather than reinvented per screen. For HXM products handling employee data, "where is PII redacted and how" should have one answer.

`libphonenumber-js` is the only non-`Intl` dependency accepted. Hand-rolled phone formatting is always wrong.

### Locale and timezone

`LocaleProvider` supplies `locale`, `timeZone` and `currency`. Every formatter accepts an optional override argument, so formatters stay pure and unit-testable outside React while components get sensible defaults.

There is no auto-detection from `navigator`. The server has no `navigator`, so auto-detection is exactly what breaks under SSR.

**Built-in UI strings are localizable.** Components ship interface strings beyond what consumers pass in — Dialog's close `aria-label`, Spinner's "Loading…", Select's "No results", toast dismiss labels. Left hardcoded, screen-reader users in non-English locales get English ARIA. `LocaleProvider` therefore accepts a typed `messages` object with English defaults:

```tsx
<LocaleProvider locale="de-DE" messages={{ close: 'Schließen', loading: 'Lädt…' }}>
```

The full key set is exported as a typed constant so products can hand it to their i18n pipeline; any omitted key falls back to English. Components read strings only through this registry — a hardcoded user-facing string literal in a component is a lint error.

**The timezone problem, stated plainly:** the server's timezone is not the user's. Formatting a date during SSR renders it in *server* time; the client then renders it in *browser* time. That is a hydration mismatch, and worse, the user briefly sees a wrong time.

Resolution — **client-only date rendering with a matched first pass**:

1. Server renders a timezone-independent value (ISO / UTC).
2. The **first client render produces the same value**, so hydration matches exactly and no warning is emitted.
3. An effect then swaps in the user-local value.

Output is always wrapped in `<time dateTime={iso}>`, so the machine-readable value is present in server HTML for SEO and no-JS.

If a product supplies `timeZone` to `LocaleProvider` — from a user profile or a cookie, known at request time — the server renders the correct value directly and there is no swap at all. The two-pass path is the safe default, not the only path.

### Hooks

`@ap/react/hooks`, grouped by concern:

| Group | Hooks |
|---|---|
| SSR | `useIsomorphicLayoutEffect`, `useHydrated`, `useMediaQuery(query, ssrDefault)` |
| State | `useControllableState`, `useDisclosure`, `usePrevious`, `useDebouncedValue`, `useToggle` |
| DOM | `useClickOutside`, `useResizeObserver`, `useIntersectionObserver`, `useEventListener`, `useCopyToClipboard` |
| Theme | `useTheme`, `useColorScheme`, `useReducedMotion` |
| A11y | `useAnnounce`, `useFocusReturn`, `useFieldContext` |
| Storage | `useLocalStorage`, `useSessionStorage` |

Storage hooks return the default value on the server and reconcile after hydration. They never read storage during render.

### Notifications

One `NotificationProvider` owning one queue and one set of live regions. Four surfaces:

| API | Use |
|---|---|
| `toast()` | transient, built on Base UI Toast |
| `banner()` | persistent, page-level |
| `confirm()` / `alert()` | promise-based dialogs — `if (await confirm({...}))` |
| `announce()` | screen-reader-only live region, no visual output |

Shared concerns solved once rather than per call site: queueing with a max-visible limit and overflow handling, dedupe by key, priority ordering, pause-on-hover and pause-on-focus, and focus return on dismiss.

Roles are assigned by severity, not by convenience: `role="status"` with `aria-live="polite"` for info and success; `role="alert"` with `aria-live="assertive"` **only** for errors. Assertive interrupts whatever a screen-reader user is doing, so it must stay rare. **Errors never auto-dismiss** — a message a user did not have time to read is not a message.

The provider is SSR-safe and renders no portal content on the server. Notification state is client-only by definition.

### Icons

A minimal internal SVG set — roughly 15 icons the components genuinely need (check, close, chevrons, alert-triangle, info, error-circle, search, calendar, spinner) — as tree-shakeable React components. No dependency, nothing to version-skew.

Every icon is overridable at two levels: per instance via prop, or globally via `IconProvider`, which maps our icon names onto a product's own icon library in one place. A product standardised on Lucide maps once and never thinks about it again.

Icons are decorative by default (`aria-hidden`), and require a `label` when they carry meaning.

### Provider stack

```tsx
<ThemeProvider>          {/* CSS custom property scope        */}
  <LocaleProvider>       {/* locale, timezone, currency       */}
    <IconProvider>       {/* icon registry, optional          */}
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </IconProvider>
  </LocaleProvider>
</ThemeProvider>
```

`<ApProvider>` composes all four with sensible defaults, so the common case is one component.

## Consequences

- Formatting is consistent across products, and locale correctness is a library property rather than a per-screen decision.
- Formatters being pure functions means they are usable in RR8 loaders and actions, where hooks are not available.
- Dates shift visibly one frame after hydration unless a product supplies a timezone. This is a deliberate, documented trade — correctness over stillness — and the escape hatch is one prop.
- One notification queue means toast behaviour, stacking and dismissal are consistent, and a11y roles are correct by default rather than by each caller's judgement.
- **Cost:** the provider stack is required. `ApProvider` keeps that to one line, but a component used outside it must fail with a clear error rather than a confusing one.
- **Cost:** the internal icon set is ours to maintain and will be requested to grow. `IconProvider` is the pressure valve.

## Alternatives considered

- **`date-fns` or Luxon for dates.** Better ergonomics than raw `Intl`. Rejected for a shared library — a date dependency in every consuming product is a large, opinionated, and difficult-to-remove commitment. `Intl` is in the platform.
- **Formatters as hooks only.** Impossible to use the wrong locale by accident. Rejected: it makes formatters unusable from loaders, utilities and tests.
- **Auto-detected locale.** Best zero-config SPA experience, and the thing that breaks under SSR.
- **Peer-depending on Lucide or Phosphor.** A larger, better icon set for free. Rejected: with git submodules, every peer dependency is one more thing each product keeps in sync by hand. `IconProvider` gets the benefit without the coupling.
- **Separate providers for toast, dialog and announcements.** Rejected — shared queueing, focus and priority behaviour is the reason a single provider exists.

## Amendment — 2026-10-08 (Phase 5g)

The decision above stands. Phase 5g changed these points; the detail is in spec §5.5 and §5.6.

- **`useFieldContext` is dropped.** Our `Field` has no context of its own, and Base UI exports its field context only under `internals`. A custom control joins a field through `Field.Control render={…}`, so a hook over an unexported API would have no caller.
- **`useFormatter()` is added to `./hooks`.** It is the one place `LocaleProvider` meets the formatters, so the two-pass date rule (UTC on the server and the first client pass, the browser zone after hydration) is implemented there once. It leaves out `formatPhone`, so `./hooks` never reaches `libphonenumber-js`.
- **Two deviations from "no hand-rolled formatting", as spec §5.2 describes.** `formatDuration` composes `Intl.NumberFormat` and `Intl.ListFormat` and never feature-detects `Intl.DurationFormat`, because CI's Node 22 lacks it and detection would give different text on the server and in the browser. `formatOrdinal` carries a suffix table, because plural rules give a category and never a suffix.
- **Bad input returns `''` and warns in development.** An invalid date, locale or time zone makes `Intl` throw `RangeError`; a formatter that throws takes a route down for one bad table cell, and a silent `''` hides the bug, so it warns once per function.
- **`maskTaxId` rules are cited, and a country is added only with a source.** US (law, 26 CFR 301.6109-4), Canada (official guidance by analogy), India (regulation plus guidance) and Singapore (guidance) carry citations, listed in spec §5.5.2. Other countries use the last-four fallback until someone finds a source for a rule.
- **`libphonenumber-js` is an optional peer behind `./format/phone`.** Its metadata is large, and most products never format a phone number, so only a product that imports that subpath pays for it. A gate walks the import graphs of `./format` and `./hooks` to prove neither reaches it.

## Amendment — 2026-10-13 (Temporal)

The decision above stands. These points are added; the detail is in
`docs/superpowers/specs/2026-10-13-temporal-support-design.md`.

- **The formatters accept Temporal values and bundle nothing.** `PlainDate`, `PlainDateTime`, `PlainTime`, `ZonedDateTime` and `Instant` are `DateInput`s, and `formatDuration` takes a `Temporal.Duration`. The app brings Temporal, native or polyfill. The library recognises a value by its `Symbol.toStringTag` and never reads the Temporal global, so it runs on Node 22 and 24, where there is none. A gate keeps `@js-temporal/polyfill` out of library sources.
- **One formatting path.** Every value resolves to epoch milliseconds plus an optional zone and calendar, and goes through the same `Intl.DateTimeFormat` call as a `Date`. Delegating to `toLocaleString` would give output that depends on which Temporal implementation the app loaded.
- **Each value renders by its meaning.** A plain value renders its wall time, and a `ZonedDateTime` renders in its own zone and ignores `timeZone`, so neither takes part in the two-pass rule. An `Instant` is an instant and does. A plain value asked for a field it does not hold (a PlainDate's time, a PlainTime's date, either's zone name) is invalid input.
- **A date-only ISO string is a calendar date.** `'1990-05-12'` renders as 12 May in every zone. Before this amendment it was UTC midnight, the ECMAScript reading, which shows 11 May west of UTC.
