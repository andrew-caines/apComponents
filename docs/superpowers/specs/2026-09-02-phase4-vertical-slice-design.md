# Phase 4 — Vertical slice: design

**Status:** Draft — 2026-09-02
**Implements:** [component-library design](2026-08-29-component-library-design.md) §5 Phase 4
**Depends on:** Phases 1–3 (merged to `main`)

## 1. What this phase is for

Phase 4 builds the provider stack, the icon set, and three components chosen because
together they touch every hard part of the architecture: **Button** (recipe variants,
`render` passthrough), **Field + Input** (compound context, ARIA wiring, uncontrolled
form semantics), and **Dialog** (portal, focus trap, enter/exit motion, SSR portal
behaviour).

The master design calls this "the checkpoint where the architecture is either right or
gets corrected — cheaply, across three components rather than fifteen." That is the
whole point, and it dictates a bias throughout this spec: where a decision could be
deferred or made now, make it now, because the cost of finding it wrong rises with every
component added afterwards.

**Done when:** gates 4–7 pass.

## 2. Scope decomposition

Phase 4 is roughly five times the size of Phase 3, which was one package and seven tasks.
Delivered as a single plan it would be unreviewable, and a reviewer could not meaningfully
reject one part while approving its neighbour.

**One spec — this document — and five sequential implementation plans.** Each ends with
working, testable software and its own gate:

| Plan | Delivers | Ends when |
|---|---|---|
| **4a** | Base UI adoption, provider stack (`ThemeProvider`, `LocaleProvider`, `IconProvider`, `ApProvider`), icon set, the hooks these need | Providers render under SSR with zero hydration warnings; message and icon registries fall back correctly |
| **4b** | `Button` | Recipe variants, `render` passthrough to a real `<a href>`, SSR assertion |
| **4c** | `Field` + `Input` | ARIA relationships wired without hand-passed ids; uncontrolled submit works pre-hydration |
| **4d** | `Dialog` | Portal absent from server HTML, focus trapped and returned, enter/exit motion driven by `@ap/motion` |
| **4e** | Storybook harness, gates 4–7 wiring, fixture extension, **`ThemeProvider`'s runtime override path (§4.2, deferred from 4a — see §9)** | Gates 4–7 green in CI over all four components, and a per-tenant theme rendered into the server HTML with no flash and no hydration mismatch |

Ordering is dependency-forced: everything needs 4a; Dialog is last because it is the component
that leans hardest on `@ap/motion`, and it should land on a provider stack already proven.
(As of 4c it is no longer the *only* consumer — `Spinner` was pulled forward for `Input`'s
loading state and got there first. See §9.)
Storybook is last because stories need components to tell stories about.

## 3. Base UI adoption

### 3.1 The package name in ADR-0004 is stale

ADR-0004 names the primitive layer `@base-ui-components/react`. That package is
**deprecated** — npm reports `Package was renamed to @base-ui/react` — and its last
publish was `1.0.0-rc.0` on 2026-07-15.

The stable **1.7.0 of 2026-08-04** that ADR-0004 cites is published as **`@base-ui/react`**.
The ADR's facts are correct; only its package name is wrong. Installing what it literally
says would pull a deprecated release candidate.

**Decision:** depend on `@base-ui/react`, pinned to exactly `1.7.0` per ADR-0004's
"pin an exact version and upgrade deliberately". Amend ADR-0004's package name in place,
with a note recording the rename so the next reader is not confused by the discrepancy.

### 3.2 The optional date peers, and the guard

`@base-ui/react@1.7.0` declares four peers. Two of them are `date-fns@^4.0.0` and
`@date-fns/tz@^1.2.0` — a dependency ADR-0012 explicitly rejected ("a date dependency in
every consuming product is a large, opinionated, and difficult-to-remove commitment") and
which ADR-0002 counts as per-product sync burden under submodule distribution.

They are declared `optional: true`. They are required only by Base UI's date components
(DatePicker and friends), none of which are in v1 scope.

**Decision:** adopt Base UI, never import its date parts, and enforce that mechanically
rather than by review. Importing one would silently make `date-fns` a required peer for
every consuming product — a decision two ADRs rejected, arriving through the back door of
an import statement nobody flagged.

**Gate:** the existing `@ap/react` import-guard family gains a check that no source
imports a Base UI date part. It fails naming the file, the import, and the reason.

### 3.3 What wrapping means here

Per ADR-0004 we wrap Base UI parts; we do not re-export them unchanged and do not
reimplement their behaviour. Concretely, for every component in this phase:

- our part renders the Base UI part, adds recipe classes and Tier 3 tokens, and forwards
  everything else through;
- Base UI's `data-*` state attributes are preserved, because they are the styling hook
  ([ADR-0004](../../adr/0004-base-ui-primitives.md) §2);
- `render` is passed through untouched — it is our routing mechanism ([ADR-0011](../../adr/0011-component-api-conventions.md) §3);
- every module carries `'use client'`.

## 4. The provider stack

### 4.1 What ships in this phase

ADR-0012 specifies four providers. **Three ship in Phase 4; `NotificationProvider` moves to
Phase 5.**

Three of its four surfaces cannot be built yet: `toast()` is built on Base UI Toast and
`banner()` on the same queue, and Toast is a Phase 5 component. Only `confirm()`/`alert()`
depend on Dialog, which lands here. Shipping a provider whose queue, pause-on-hover,
overflow and priority behaviour have no consumer would mean writing the hard part against
no real usage — precisely the mistake this phase exists to avoid.

`ApProvider` composes three providers now and gains the fourth in Phase 5. **Its public API
does not change**, so this is an internal addition rather than a breaking one, and no
consumer rewrites anything.

### 4.2 `ThemeProvider`

Per ADR-0009, theme delivery is build-time by default with an opt-in runtime path.
`ThemeProvider`'s job is scoping and nesting, not generation.

- **Default (no props):** renders nothing but a context value. The static `theme.css`
  already on the page supplies every token. Zero runtime cost, no wrapper element, no flash.
- **Runtime override:** given a generated theme, it emits the tokens as CSS custom
  properties on a scoping element. Nesting works for free — a nested provider re-scopes
  everything beneath it through the cascade, with no React re-render.
- **Colour scheme:** three-state `light` / `dark` / `system`. `system` resolves in pure CSS
  via `prefers-color-scheme`; an explicit choice sets `data-ap-scheme` on `<html>`, which
  wins in the cascade.

`useColorScheme()` reads and sets the preference and **never reads `localStorage` during
render** (ADR-0005). `<ThemeScript />` is the SPA anti-flash path: a tiny synchronous inline
script in `<head>`. It is blocking by necessity, and this is the one place that is correct.

The SSR-correct path — a cookie read server-side, attribute rendered into the initial HTML —
needs no script at all, and is what the fixture app demonstrates.

### 4.3 `LocaleProvider`

Supplies `locale`, `timeZone` and `currency`. **No auto-detection from `navigator`**: the
server has no `navigator`, so auto-detection is exactly what breaks under SSR.

**The message registry is the part that matters.** Components ship interface strings
beyond what consumers pass in — Dialog's close `aria-label`, Spinner's "Loading…". Left
hardcoded, screen-reader users in non-English locales get English ARIA.

- The full key set is exported as a typed constant, so a product can hand it to its i18n
  pipeline and get a compile error when a key is missing.
- Any omitted key falls back to English.
- Components read strings **only** through this registry.

**Enforcement:** a hardcoded user-facing string literal in a component is a gate failure,
not a review comment. Phase 4's components are the first with strings to get wrong, so the
gate lands here rather than being retrofitted across fifteen components later.

Formatters are out of scope for Phase 4 — they are pure `Intl` functions with no React
dependency and no component depends on them yet. They arrive with the components that
display formatted values, in Phase 5.

### 4.4 `IconProvider` and the icon set

A minimal internal SVG set as tree-shakeable React components. Phase 4 needs only what its
components need: **check, close, chevron-down, alert-circle, info** — five, not the eventual
fifteen. Adding an icon nothing renders is speculative work, and each one is a permanent
maintenance obligation.

- Icons are **decorative by default** (`aria-hidden`), and require a `label` when they
  carry meaning.
- Overridable per instance via prop, or globally via `IconProvider`, which maps our names
  onto a product's own icon library in one place.

### 4.5 `ApProvider`

Composes the three with sensible defaults, so the common case is one component.

A component used **outside** the stack must fail with a clear error rather than a confusing
one (ADR-0012 names this cost explicitly). The failure mode to avoid is a component reading
`undefined` from a missing context and rendering something subtly wrong. Each context
therefore has a default that is either correct standalone (theme: the static CSS is already
there) or throws by name (icon registry: a component asking for an icon with no provider is
a bug worth surfacing).

## 5. Hooks

Phase 4 builds only the hooks its own code needs, not the full ADR-0012 catalogue:

| Hook | Needed by |
|---|---|
| `useIsomorphicLayoutEffect` | any layout effect, per ADR-0005 |
| `useHydrated` | Dialog's portal, `ThemeScript` reconciliation |
| `useTheme`, `useColorScheme` | `ThemeProvider` |
| `useLocale`, `useMessages` | `LocaleProvider`, every component with a string |
| `useFieldContext` | `Field` → `Input` wiring |

The rest arrive with the components that need them. A hook with no caller has no design
pressure on it and no test that means anything.

## 6. The three components

### 6.1 `Button` — proves recipe variants and `render`

Variants `variant` × `size` × `tone` as typed recipe variants. The load-bearing assertion is
**`render` passthrough**: `<Button render={<Link to="/x" />}>` must yield a real `<a href>`
with working middle-click and right-click-copy-link, while keeping every recipe class,
`data-*` attribute and ARIA property. That is what makes routing integration work without
`@ap/react` depending on `react-router` at all.

### 6.2 `Field` + `Input` — proves compound context and uncontrolled forms

`Field.Root` provides context so `Label`, `Control`, `Description` and `Error` wire their own
`id`, `aria-describedby` and `aria-invalid` relationships. **Nobody passes an id by hand, and
the ARIA wiring cannot be forgotten.** Ids come from `useId` so they are stable across server
and client passes.

`Field` (the convenience component) must be implementable **purely through the public
compound API** — ADR-0011 §2 makes this the rule that stops a fast path and a real path
diverging. If it cannot be, the compound API is incomplete, and that is the bug to fix.

Inputs are **uncontrolled-first**: `name`, `defaultValue`, `required`, controllable via
`value` / `onValueChange` when needed. This is what makes progressive enhancement work — an
RR8 `<Form method="post">` submits and the action runs **before hydration completes**,
because the browser is submitting a real form.

`Field.Error` renders an icon and text, never colour alone (ADR-0011 §5, WCAG 1.4.1).

### 6.3 `Dialog` — proves portals, focus, motion and SSR

The hardest of the three, and the reason it is last.

- **Portal content must not render server-side** (ADR-0005). The server HTML contains the
  trigger and no popup.
- **Focus** is trapped while open and **returned** to the trigger on close.
- **Enter/exit motion** is the first real consumer of `@ap/motion`: the popup uses the
  `enter.fade-rise` and `exit.fade` composites, and the backdrop its own. Base UI detects
  animation state via `element.getAnimations()`, with `keepMounted` for unmounting trees.
- Under `prefers-reduced-motion`, the motion degrades at the token layer with no component
  code change — which is the claim Phase 3 made and this is the first chance to prove it
  end to end in a browser.
- The close control's `aria-label` comes from the message registry, not a literal.

## 7. Gates

Phase 4 must leave gates 4–7 green (ADR-0014).

| Gate | Command | Signal |
|---|---|---|
| 4 — Unit + interaction | `test:unit` | Vitest + Testing Library; interaction via Storybook `play` |
| 5 — Accessibility | `test:a11y` | axe over every story, zero violations |
| 6 — SSR smoke | `test:ssr` | Real RR8 pipeline over HTTP; markup present; **zero hydration warnings** |
| 7 — SPA smoke | `test:spa` | Same app with `ssr: false` boots and renders every component |

Gates 6 and 7 already exist from Phase 2 and are **extended**, not rebuilt: the fixture app
grows a page per component, including one behind a deliberately slow `<Suspense>` boundary.

**Honesty note, carried from ADR-0014:** gate 5 proves *zero machine-detectable violations*,
not *accessible*. Automated tooling catches roughly 30–40% of WCAG issue types. Keyboard
flows are covered by `play` tests, and each component gets a manual screen-reader pass
recorded in its directory before release — not merely performed.

### 7.1 The Storybook boundary against Phase 6

Gates 4 and 5 need Storybook to exist; Phase 6 owns Storybook's *build and deployment*.

**Decision:** Phase 4 brings up Storybook as **test infrastructure only** — stories, `play`
functions, and the axe runner, run headlessly in CI. Phase 6 adds the docs site, MDX guides,
the theme-generator page and Pages deployment. The split is between "stories as a test
harness" and "Storybook as a published artifact"; nothing built here is thrown away.

## 8. Verification plan

Ordered checks, each with its concrete success signal. Every one is a command whose output
is the evidence.

| # | Check | Command | Success signal |
|---|---|---|---|
| 1 | Base UI resolves at the pinned version, not the deprecated name | `npm ls @base-ui/react` | `@base-ui/react@1.7.0`, and `@base-ui-components/react` absent |
| 2 | No Base UI date part is imported | `test:guards` | Gate passes; fails naming file + import when one is added |
| 3 | Providers are SSR-safe | `test:guards` | No browser global at module scope or during render |
| 4 | No hardcoded user-facing string in a component | `test:guards` | Gate passes; fails naming the literal when one is added |
| 5 | Message registry falls back to English per key | `test:unit` | Omitted key yields the English default; typed key set is exhaustive |
| 6 | Every component unit-tests green | `test:unit` | Vitest + Testing Library |
| 7 | `render` yields a real anchor | `test:unit` | `<a href>` present with recipe classes and `data-*` intact |
| 8 | Field ARIA wiring is derived, not passed | `test:unit` | `aria-describedby` / `aria-invalid` resolve to real ids with nothing hand-passed |
| 9 | Uncontrolled submit works before hydration | `test:ssr` | RR8 action receives the value from a pre-hydration form post |
| 10 | Dialog portal is absent from server HTML | `test:ssr` | Trigger present, popup absent in the streamed response |
| 11 | Zero hydration warnings across every component | `test:ssr` | Captured console clean through hydration |
| 12 | SPA build boots and renders every component | `test:spa` | Same app with `ssr: false` |
| 13 | Zero axe violations across every story | `test:a11y` | axe over all stories |
| 14 | Reduced motion degrades Dialog with no component change | `test:a11y` / play | Under emulated `prefers-reduced-motion`, the popup animation collapses |

**Proof artifact:** a green CI run on this branch showing gates 1–8 passing — the Phase 2 and
3 gates still green alongside the four new ones — with the fixture app rendering all four
components under both SSR and SPA.

## 9. Deliberately not in Phase 4

| Deferred | Why |
|---|---|
| **`ThemeProvider`'s runtime override path (§4.2)** | Deferred to **4e**, added 2026-09-02 after plan 4a's review found it undelivered with no deferral recorded. No Phase 4 component consumes it, and ADR-0009 says the runtime path "is the one that can go wrong, so it gets the SSR integration test" — the honest place to prove it is 4e's fixture app, where a `<style>` rendered server-side for a request-known tenant can be asserted end to end. Shipping it in 4a would have been unproven code. **4a therefore delivers scoping-by-attribute only**: nested providers currently both write the global `<html>` attribute rather than re-scoping, so a dark panel inside a light page is not yet supported. |
| `NotificationProvider` | Three of four surfaces need Toast (Phase 5); see §4.1 |
| Formatters (`@ap/react/format`) | No Phase 4 component displays a formatted value |
| The other ten hooks | No caller yet; a hook with no caller has no design pressure |
| Ten of the fifteen icons | Nothing renders them |
| Storybook docs site, MDX, Pages deploy | Phase 6; §7.1 draws the line |
| Textarea, Select, Checkbox, Radio, Switch, Toast, Tooltip, Popover, Tabs, Accordion | Phase 5 |
| ~~Spinner~~ — **pulled forward into 4c**, 2026-09-03 | `Input`'s `loading` state needs an indeterminate indicator, and the alternatives were worse: a CSS-only spin inside `Input.css.ts` would have declared keyframes outside `@ap/motion`, breaking ADR-0010's guarantee that reduced motion is enforced at the token layer, and it would have been rewritten the moment the real component arrived. Shipped narrow — `label`, `size`, `className`, `currentColor`, no colour token — so Phase 5 extends it rather than replacing it. It is the first consumer of `@ap/motion` in `@ap/react`, which is what surfaced the packaging gap now closed by the `@ap/react/motion.css` re-export. |
| Base UI date components | §3.2 — adopting one imposes `date-fns` on every consuming product |
| `examples/Dialogs.html` | Deferred 2026-09-03 during 4d. The examples pipeline renders static SSR with no JavaScript, Base UI requires a `Dialog.Portal`, and a portal renders nothing under `renderToString` — so a static page cannot show an open dialog without hand-written imitation markup that would drift from the component. Converting the pipeline to ship a client bundle is the right fix and is its own piece of work. Every claim the page would have shown is asserted against a real browser in `fixtures/ssr-app/e2e/dialog.spec.ts`. |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Base UI 1.7.0's API differs from the 1.0-era shape the ADRs describe | 4a installs and smoke-tests it before any component is written; a mismatch surfaces at the cheapest possible moment |
| Dialog's motion integration needs `@ap/motion` to expose something it does not | 4d is last; if the CSS composites prove insufficient, the fix is in one package with four gates over it |
| Portal + SSR + focus return interact badly | Gate 6 asserts portal absence server-side; `play` tests assert focus return; both run in CI |
| Storybook's own weight slows CI | Phase 4 runs stories headlessly as tests only; the docs build stays in Phase 6 |
