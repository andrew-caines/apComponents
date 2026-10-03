# Phase 5 — Remaining v1 components: design

**Status:** Draft — 2026-09-04
**Implements:** [component-library design](2026-08-29-component-library-design.md) §5 Phase 5
**Depends on:** Phases 1–4 (merged to `main` at `bc85f89`; Phase 4's gates green in CI)

## 1. What this phase is for

Phase 4 proved the architecture across four components. Phase 5 finishes v1: the ten
remaining components from ADR-0011's scope list, the `NotificationProvider` that three of
them make possible, the full ADR-0012 catalogue of hooks and formatters, and the last two
verification gates.

The bias is the opposite of Phase 4's. There, every decision was made early because the
cost of finding it wrong rose with each component added. Here the architecture is settled,
and the risk is different: **ten components built in a row is where conventions quietly
fork.** Two contributors, or one contributor on two different days, will solve the same
problem twice in two ways unless the shared decisions are written down first. §4.1 exists
for that reason, and every component section defers to it rather than restating it.

**Done when:** all ten gates run in CI — 1–8 green, 9 and 10 reporting.

## 2. Scope decomposition

**One spec — this document — and eight sequential implementation plans.** Same shape as
Phase 4: each plan ends with working, testable software and its own gate, and a reviewer
can reject one plan while approving its neighbour.

| Plan | Delivers | Ends when |
|---|---|---|
| **5a** | Storybook workspace, Vitest 4 upgrade, stories + MDX docs pages backfilled for Phase 4's six components, gates 4–5 moved off the showcase, showcase reduced to SSR smoke, the Pages base path (§3.5), ADR-0011 §7 and ADR-0014 amended | `test:unit` and `test:a11y` run through Storybook in CI over all six existing components; a deliberate axe violation fails the run |
| **5b** | `Textarea`, `Checkbox`, `Switch`, `RadioGroup` + `Radio` | Each renders inside `Field` with ARIA derived, not hand-passed; each submits uncontrolled pre-hydration |
| **5c** | `Select` | Selected label present in server HTML; popup absent; hidden input carries the value; keyboard listbox semantics pass |
| **5d** | `Tooltip`, `Popover` | Portals absent server-side; tooltip describes its trigger; popover traps focus when it has a close button and returns it on dismiss |
| **5e** | `Tabs`, `Accordion` | Panel motion driven by `@ap/motion` through the aliased panel-height variable; manual tab activation; no indicator flash pre-hydration |
| **5f** | `Toast`, then `NotificationProvider` over it and `Dialog` | `toast()` enqueues from outside React; errors never auto-dismiss; `confirm()` resolves from a real Dialog; `announce()` writes to a live region rendered on both passes |
| **5g** | `@ap/react/hooks`, `@ap/react/format`, `@ap/react/format/phone` | Full ADR-0012 catalogue, each with tests at fixed locales; the phone subpath is provably absent from the main format entry |
| **5h** | Gates 9 and 10; fixture and showcase pages for every new component; the all-ten sweep | Gate 10 reports per-entry budgets including a single-named-import check; gate 9 reports story screenshots against Linux baselines; gates 1–8 green |

Ordering within 5b–5f is by how much new ground each breaks. The form controls reuse
`Field`, which already exists. `Select` adds the first positioned popup. `Tooltip` and
`Popover` generalise positioning. `Tabs` and `Accordion` add height motion and composite
focus. `Toast` leans on all of it, which is why `NotificationProvider` sits behind it in
the same plan rather than earlier.

**5g is movable.** It is placed after the components because no component needs it — Base
UI already owns outside-press dismissal and focus return (§4.1.6). If a component turns
out to need a hook from the catalogue, that hook moves forward into that component's plan
and 5g delivers the rest.

## 3. The Storybook harness

### 3.1 Why Storybook now, having deliberately skipped it in Phase 4

Phase 4e chose the showcase app over Storybook for gates 4 and 5 and recorded the
deviation in its §9. That decision was correct for four components: it bought gate 5's
guarantee for the cost of one spec file rather than a second toolchain.

It does not scale to fifteen. ADR-0011 §7 requires a `.stories.tsx` per component, and the
things Storybook gives that the showcase cannot are exactly the things ten more components
need: per-story isolation in failure reports, `play` functions as the home for interaction
coverage, controls that document a component's prop surface without hand-written prose,
and a docs artifact Phase 6 can deploy rather than build from scratch.

**The showcase is not deleted.** It keeps the one job Storybook cannot do: proving a
component renders under real SSR in a real browser. It shrinks to a smoke page per
component with no prose, and its axe spec retires when Storybook's takes over.

### 3.2 Location and versions

Storybook lives in a **`storybook/` directory that is a real npm workspace**, added to
root `workspaces`.

This differs from `showcase/` and `fixtures/*`, which are deliberate islands with their
own `package.json` and lockfile, installed via `npm --prefix`. Those exist to simulate a
consumer, and pay for it with `resolve.dedupe` and `ssr.noExternal` workarounds. Storybook
simulates nothing; it is our own test harness. `@storybook/addon-vitest` must resolve
`storybook`, `vitest`, `vite`, `react` and `@ap/react` from one module graph, and an island
would reintroduce the two-copies problem that cost this project a CI failure on 2026-09-04
(see CONTRIBUTING, "The same nesting put two copies of `@types/react` into every downstream
typecheck"). ADR-0013's "private docs workspace, never in a published package" is satisfied
either way.

| Package | Version | Why pinned |
|---|---|---|
| `storybook`, `@storybook/react-vite`, `@storybook/addon-docs`, `@storybook/addon-a11y`, `@storybook/addon-vitest` | `10.6.0` exact | Addons peer-pin the core version; a floating range breaks the set on any install |
| `vitest`, `@vitest/browser`, `@vitest/browser-playwright` | `4.1.11` exact | `addon-vitest@10.6.0` peers `vitest ^3 \|\| ^4`. Vitest **5.0.0 is already published** — a `^4` range is safe today but an exact pin is what stops a future `npm install` from silently stepping outside the peer range |
| `playwright` | reuse `^1.62.1` | Already used by both fixture suites |

### 3.3 The Vitest 4 upgrade is a prerequisite, and its own risk

The repo runs Vitest 3.2.7, which does not accept Vite 8 and therefore installs its own
nested Vite 7. Unit tests already run on a different Vite major than builds do.

Vitest 4 accepts Vite 8, which collapses that split and is required by the browser-mode
provider `addon-vitest` needs. **The upgrade is task one of 5a and it gates everything
after it.** Its success signal is the existing suite: `npm test` and `npm run test:gates`
green on Vitest 4 with no test file edited. If they are not, the fallback is Vitest 3 plus
`@vitest/browser@3.2.7` and the string provider form, accepting two Vite majors — recorded
in the plan's "what actually happened", not silently.

### 3.4 What runs where

- **Stories are colocated** with components as `packages/react/src/components/<Name>/<Name>.stories.tsx`. The gate walker (`gates/sourceFiles.ts`) already skips `.stories.` files, so no gate allowlist widens. They are excluded from `packages/react`'s composite build via `tsconfig` `exclude` and typechecked from `storybook/tsconfig.json` instead, so Storybook's types never enter the published package's build.
- **Browser globals in a story live inside `play` only**, never in `render`. A story's render path is still subject to the SSR contract in spirit even though the gate cannot see it.
- **MDX docs pages** live under `storybook/docs/` and cover the five non-component subjects the showcase currently holds as prose: foundations, colour, typography, theming, icons. They are not test files, and the a11y check is gated on story view mode, so both the Vitest and axe runs skip them.
- **`preview.ts` imports `@ap/react/fonts.css`, `theme.css` and `motion.css`** and wraps every story in `ApProvider`. Motion is not optional: without it every `animation: var(--ap-motion-*)` resolves to nothing and every motion assertion is vacuous.

### 3.5 The Pages base path is set now, not in Phase 6

Phase 6 owns Storybook's deployment. One piece of it belongs here, because it costs
nothing now and is invisible until it breaks: **the Vite `base` path.**

**Decision, 2026-09-04: the published Storybook will be a public site.** The repository is
private and owned by a personal account. GitHub Pages from a private repository requires a
paid plan, and the site it publishes is readable by anyone with the URL regardless —
restricting it to people with repository access requires an organisation on GitHub
Enterprise Cloud, which a personal account cannot have. Publishing publicly is accepted
rather than worked around. Two consequences Phase 6 inherits: if the account is on the free
plan the repository itself must become public for Pages to work at all, and any prose
published into the docs site is published to the open internet.

A Pages project site is served from a subpath (`/apComponents/`), not from the domain root.
Storybook's Vite builder does not fully handle a subpath on its own — some asset URLs
rewrite and others do not — so the site loads with broken assets unless `base` is set in
the `viteFinal` hook.

**It is set from an environment variable, defaulting to root**, rather than hardcoded to
the repository name. Gate 9 serves `storybook-static` from a local static server at the
domain root, so a hardcoded subpath would break every screenshot in the visual-regression
run while the deployed site worked, or the reverse. The Pages build sets the variable; every
other build does not.

### 3.6 Gates 4 and 5 become one mechanism

Interaction (`play`) and accessibility (axe) both run inside the Vitest addon in headless
Chromium. `@storybook/test-runner` is not adopted: it drags Jest into a Vitest repo, and
Storybook's own docs point at the Vitest integration instead.

Axe is configured at project level to **fail**, not warn, on any violation, using the same
tag set the showcase spec used (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) so the
guarantee does not quietly narrow in the move. Per-story relaxation requires a written
reason in the story file.

**The wiring is proven once, the way 4e proved its axe run:** a story with a deliberate
unlabelled control, un-tagged temporarily, must fail the run and name that story. A
mechanism that reports zero violations because it checked nothing reports exactly what a
clean run reports.

**Honesty note, carried forward from ADR-0014 and Phase 4 §7:** gate 5 proves zero
machine-detectable violations, not accessibility. Keyboard flows are covered by `play`.
Each component still gets a manual screen-reader pass recorded in its directory before
release.

### 3.7 Documentation changes this forces

| Document | Change |
|---|---|
| ADR-0011 §7 | "A `.stories.tsx` (gallery entry, controls, axe run)" becomes a story **and** a showcase SSR smoke page, with the two jobs named |
| ADR-0014 gates 4–5 | Signal column updated from "axe over every Storybook story" to name the Vitest-addon run; the Phase 4e showcase deviation is closed rather than left standing |
| CONTRIBUTING | "Adding a component" grows the story and smoke-page steps; the showcase section's scope narrows |

ADRs are immutable once accepted (`docs/adr/README.md`), so both changes are additive
clarifications to existing decisions, not reversals. If review disagrees, the fallback is a
new ADR superseding 0013's Storybook boundary — flagged here so the plan does not have to
decide it alone.

## 4. The ten components

### 4.1 Shared decisions

These bind every component in 5b–5f. A component section below states only what is unique
to it.

**4.1.1 `nativeButton` is derived, never asked for.** Base UI forces `role="button"` and
`tabIndex={0}` onto any button-like part when `nativeButton` is false, which is wrong for a
`render` element that is already a real link. Phase 4's `Button` solved this by deriving
the flag from the render element; CONTRIBUTING records the trap in full. Every button-like
part in this phase reuses that derivation: `Select.Trigger`, `Popover.Trigger`,
`Popover.Close`, `Tabs.Tab`, `Accordion.Trigger`, `Toast.Close`. The defaults differ per
part in Base UI (some `true`, some `false`), which is exactly why we stop reading them.

**4.1.2 `Checkbox`, `Switch` and `Radio` do not expose `render` in v1.** Base UI renders a
`<span role="checkbox">` plus a sibling hidden native input; the hidden input is what
carries `name`/`value` into an uncontrolled form post, and what `Field.Label`'s `htmlFor`
points at. Exposing `render` invites a consumer to replace the structure that makes both
work. The cost is the "native button with an external label" pattern, which no product has
asked for. Deferred, not rejected.

**4.1.3 Field integration is Base UI's, never re-wired.** Ids, `aria-labelledby`,
`aria-describedby`, `aria-invalid` and the `data-*` state attributes come from Base UI's
labelable context, as they do for `Input` today. Phase 4c's gate — ARIA relationships
resolve to real ids with nothing hand-passed — extends to every new control unchanged.

**4.1.4 Semantic state is never colour alone (ADR-0011 §5).** Where a part can express
error or selection, it carries an icon or text, and the part owns its own `render` so a
consumer cannot remove it. `FieldError` is the precedent.

**4.1.5 Motion comes from `@ap/motion`, and this phase adds no motions to it.** Every
animation is `animation: var(--ap-motion-<name>)` against an existing entry in `MOTIONS`.
Components never declare `@keyframes` and never query `prefers-reduced-motion`; reduced
motion is enforced at the token layer. Two mechanical consequences:

- **Accordion aliases the panel-height variable.** `collapse`/`expand` in `@ap/motion`
  reference `var(--panel-height)`; Base UI sets `--accordion-panel-height`. The component's
  CSS declares `--panel-height: var(--accordion-panel-height)`. Aliasing in the component
  keeps `@ap/motion` generic — a Collapsible in v2 sets the same alias from its own
  variable, and the motion package never learns Base UI's naming.
- **The Tabs indicator is a transition, not an animation.** Base UI exposes its position as
  CSS variables with no starting/ending style, so the indicator transitions on those
  variables using a duration token.

**4.1.6 We do not reimplement what Base UI already does.** Verified in its sources:
outside-press dismissal, focus return (`finalFocus`), and toast live regions are Base UI's.
No component in this phase calls `useClickOutside`, `useFocusReturn` or `useAnnounce`.
Those hooks ship in 5g for consumers, and their tests are their only callers — stated
plainly rather than implied.

**4.1.7 Positioner defaults are token-driven.** A shared default side offset from the space
scale, `side: 'top'` for Tooltip, `side: 'bottom'` for Popover and Select. Base UI's
per-component defaults are not inherited by accident.

**4.1.8 Every user-facing string is a message key.** The `no-hardcoded-strings` gate scans
every `.tsx` under `packages/react/src` and cannot be widened. New keys this phase needs
include at minimum the toast region label, the confirm/cancel labels, and Select's empty
state. Each is added to `DEFAULT_MESSAGES` with an English default.

**4.1.9 No portal is `keepMounted`.** The SSR gate asserts portal content is absent from
server HTML. This holds for Select, Tooltip, Popover and Toast exactly as it does for
Dialog.

**4.1.10 Form controls share one control-state token contract.** *Added 2026-09-26, before
plan 5c.* Plan 5b enumerated token roles per component, and the lists disagreed: Checkbox
got hover and invalid roles, Switch got neither, so Switch alone has no `[data-invalid]`
rule. From 5c on, a control's token file defines these roles by these names, with these
Tier 2 fallbacks, and a plan names only the roles *beyond* them:

| Role | Fallback | Rule it serves |
|---|---|---|
| `border` | `vars.color.borderNormal` | Resting outline of the control's box (or track) |
| `borderHover` | `vars.color.borderInteractive` | `&:hover:not([data-disabled])` — hover is always guarded |
| `borderInvalid` | `vars.color.dangerBorder` | `&[data-invalid]`. `dangerBorder`, never `dangerBg`: it is the role gated for 3:1 non-text contrast (ADR-0008) |
| `focusRing` | `vars.color.focusRing` | `&:focus-visible`, at the system's ring width and offset, never literals |
| `radius` | per control | The control's corner radius |

Disabled is not a token: every control expresses it as `&[data-disabled]` with
`opacity: 0.6` and `cursor: default` on the element that carries the pointer, matching
`Input.css.ts`. A control with a surface adds `bg` (`vars.color.bgSurface`) and, if it
shows text, `text` (`vars.color.textPrimary`). A glyph on a solid action fill is
`actionOnSolid`, not `actionText`.

A control that renders its own label row uses the shared row values Checkbox, Switch and
RadioGroup settled on in 5b's fix wave — `space['2']` gap, `text.sm` size and line height,
`textPrimary` — so a form mixing them lines up.

`Switch` is brought onto this contract in plan 5c: its track gains `border`, `borderHover`
and `borderInvalid`, and the `[data-invalid]` rule it lacks. The same plan adds the other
5b follow-up: `RadioGroup`'s `invalid` JSDoc says it is a colour cue that must be paired
with visible copy.

### 4.2 Plan 5b — `Textarea`, `Checkbox`, `Switch`, `RadioGroup` + `Radio`

**`Textarea` has no Base UI counterpart.** Confirmed: the package has no textarea export.
It is built as `Field.Control` with a native `<textarea>` render element. Base UI's control
handles it correctly at runtime — its Enter-to-commit path is gated on the tag being an
input, so Enter inserts a newline as it should. The type surface is the problem: the
control's props are typed for `'input'`, so `rows`, `cols` and `wrap` are invisible.
`Textarea` redeclares the textarea props it supports and pushes them onto the render
element.

Scope: `rows` and a `resize` prop (`none` | `vertical`). **No auto-grow in v1** — it needs
measurement on every keystroke, which is a layout-effect question this phase has no reason
to answer.

**`RadioGroup` owns the group's label.** Base UI's radio group registers no control id, so
`Field.Label`'s `htmlFor` has nothing to point at; its group labelling comes from a
fieldset legend, with a `Field.Item` per option. `RadioGroup` therefore wraps Base UI's
`Fieldset` and exposes a `label` prop, rather than asking consumers to assemble four parts
correctly. This is ADR-0011 §2: a convenience component built *on* the compound parts.

`Checkbox` adds `indeterminate`. `Switch` adds nothing beyond its thumb; its motion is a
transition on the checked state, since Base UI's thumb has no starting/ending style.

### 4.3 Plan 5c — `Select`

Two decisions carry this component:

- **`items` is a prop, not children.** Base UI's value part resolves a label from an items
  collection purely, with no effect, which means the selected label is in the server HTML.
  Without `items` it renders the raw value, and a server-rendered form would show `us`
  where it should show "United States". Children-based composition remains available
  through the parts for grouped and custom-rendered cases; the convenience component takes
  `items`.
- **Trigger-item alignment is off.** Base UI defaults to overlapping the trigger with the
  selected item, which ignores `side` and `align` entirely and behaves differently on
  touch. A predictable listbox below the trigger is worth more than the native-select
  mimicry, and the behaviour is then identical across input modalities.

`Field.Label` gets `nativeLabel={false}` when its control is a Select, because a real
`<label for>` pointing at a button leaks click and hover behaviour into the trigger. The
`Field` convenience component sets this; a consumer assembling parts by hand is
responsible for it, and the story shows both.

The hidden input is rendered inline rather than portalled, so uncontrolled submit works
pre-hydration exactly as `Input`'s does — gate 6 asserts it with a real form post.

#### 4.3.1 Scope and API — settled 2026-09-26, before the plan

**The convenience component supports single and multiple selection, grouped items, and
object values.** All three are Base UI capabilities; the decision is to expose them on
`Select` itself rather than only through the parts.

- **`items`** is a flat list `{ value, label, disabled? }[]` or a grouped list
  `{ label, items }[]`. Groups render as `Select.Group` with a `Select.GroupLabel`, and a
  `Select.Separator` between consecutive groups.
- **`multiple`** is a type parameter, as in Base UI: `value`/`defaultValue` become arrays.
  Base UI renders one inline hidden input per selected value, so a pre-hydration post
  carries all of them.
- **Object values require `itemToStringValue`.** When `Value` is not `string`, the prop is
  required by the type. Without it Base UI's fallback serialises the object into the
  post, which is never what a server action expects.
- **`isItemEqualToValue` defaults to comparing `itemToStringValue` output**, not
  `Object.is`. A `defaultValue` rebuilt from server data is a different object carrying the
  same data; under Base UI's default it matches no item and the trigger renders
  empty. A consumer's own `isItemEqualToValue` still wins.
- **Multiple values display as a locale list.** Base UI joins labels with a hardcoded
  `", "`. `Select` instead joins them with `Intl.ListFormat` at `LocaleProvider`'s locale,
  on one line with an ellipsis on overflow. The locale is explicit, so server and client
  produce identical text.
- **`placeholder`** is consumer-supplied content, not a message key. An empty `items`
  list shows the existing `noResults` key; no new key is needed.
- **`size`** is `sm | md | lg`, as on `Input`.

**Compound parts:** `Select.Root`, `Trigger`, `Value`, `Icon`, `Popup`, `List`, `Item`,
`Group`, `GroupLabel`, `Separator`. **`Select.Popup` bundles Base UI's Portal, Positioner
and Popup** with §4.1.7's defaults applied (`side: 'bottom'`, the shared offset,
`alignItemWithTrigger={false}`), so a hand assembly cannot forget them. The convenience
component uses only these public parts, and a test asserts the two produce the same DOM,
as `Field.test.tsx` does.

**Selection is never colour alone (§4.1.4).** Each selected item shows a check glyph
through `Select.ItemIndicator`, rendered by our `Item` part, which owns it so a consumer
cannot remove it.

#### 4.3.2 How `Field` knows its control is a Select

`nativeLabel={false}` alone is not enough: Base UI's `Field.Label` still renders a
`<label>` unless it is also given a non-label element, and warns in development about the
mismatch. So the label must become `<div>` *and* non-native, together.

**`Select` carries a static marker; `Field` checks its direct child for it** and, when
present, renders its label with a `<div>` render element and `nativeLabel={false}`. The
consumer API stays identical to `Input`'s — `<Field label="Country"><Select … /></Field>`.
A Select wrapped in a consumer's own component is not detected; in development, `Select`
looks up the element its trigger is labelled by and warns if it is a `<label>`, naming the
fix. The marker is internal, not exported.

#### 4.3.3 Three things verified during the plan

- **`nativeButton` derivation.** §4.1.1 says `Select.Trigger` reuses `Button`'s
  derivation, but `deriveNativeButton` is private to `Button.tsx`. The plan moves it to a
  shared internal module first; `Button`'s existing tests guard the move.
- **The trigger's accessible name in server HTML — confirmed absent.** Base UI registers
  the label id from an effect (`useRegisteredLabelId`), so the trigger's `aria-labelledby`
  is missing from server markup and appears only after hydration — the same shape as
  RadioGroup's legend (5b, R16). Confirmed by a direct `renderToString` probe against Base
  UI 1.7.0: passing an `id` to `Field.Label` and the same value as `aria-labelledby` to
  `Select.Trigger` is the only way either attribute reaches server HTML; left to Base UI's
  own registration, both are absent until hydration. The fix taken is R16's: `Field`
  generates the id itself with `useId()` (not left for Base UI to register) and passes it
  to both the label and the control — see "The non-native-label protocol" in
  `docs/CONTRIBUTING.md`. The rationale is stated narrowly, as R16's correction requires —
  a named control in streamed and pre-hydration markup for assistive technology, not
  operability with JavaScript off.
- **Object values render as JSON when the default is rebuilt.** Base UI's own label
  resolution (`resolveSelectedLabel`, `internals/resolveValueLabel.js`) matches an object
  value against `items` only by an explicit `label` key on the value itself or by identity
  match on a `.value` property — never by deep equality — so a `defaultValue` reconstructed
  fresh on every render (the common case for server-supplied data) falls through to
  serialising the object, even with `items` and `itemToStringValue` both supplied. The
  convenience component does not rely on this path at all: it always passes `Select.Value`
  a children function that looks up the label itself from the same `items`, so Base UI's
  resolution never runs for anything built through `<Select items={…} />`. Only a
  hand-assembled `<Select.Value />` with no children function is exposed to it.

### 4.4 Plan 5d — `Tooltip`, `Popover`

**Base UI's Tooltip emits no ARIA at all.** Verified: no `role="tooltip"`, no
`aria-describedby`, by design — it treats a tooltip as a visual affordance and tells you to
label the trigger. That leaves a real gap for a component library whose gate 5 is axe and
whose users are keyboard and screen-reader users.

**Decision: our popup carries `role="tooltip"` and the trigger gets `aria-describedby`
while open.** Nothing conflicts, because Base UI sets neither. This is the APG pattern, and
it is the reason a `Tooltip` in this library is not the same thing as Base UI's. A tooltip
is still not a place for interactive content or for the only copy of an accessible name —
the type surface pushes that toward `Popover`.

One `Tooltip.Provider` goes in `ApProvider`, giving app-wide delay grouping so moving
between adjacent triggers does not re-wait. It is context only, so it costs nothing on the
server.

`Popover` is the interactive counterpart: `role="dialog"`, labelled by its own title and
description parts, focus trapped only when it contains a close part. Base UI's hover-open
option makes it the sanctioned "infotip" when content must be richer than a tooltip.

### 4.5 Plan 5e — `Tabs`, `Accordion`

`Tabs` uses **manual activation** (arrow keys move focus, Enter or Space activates), which
is Base UI's default and the right one for panels whose content is expensive. Panels
unmount when inactive unless a consumer opts into keeping them mounted.

**The pre-hydration indicator script is off.** Base UI can inject an inline `<script>` so
the indicator is positioned in the server response. It is a CSP question — the nonce story
is unresolved and this phase has no reason to resolve it — so the indicator appears at
hydration, and its first appearance is a transition from no width rather than a jump.
Recorded as a deferral with the CSP work named, not as an oversight.

`Accordion` panels are unmounted when closed by default. The heading level is changeable
only through the header part's `render`, which the story documents, because a component
that hardcodes `<h3>` inside a page whose sections are `<h2>` produces a broken outline.

Both consume `collapse`/`expand` through the alias in §4.1.5.

### 4.6 Plan 5f — `Toast` and `NotificationProvider`

`Toast` is built first, then the provider over it. ADR-0012's provider owns one queue and
one set of live regions behind four surfaces.

| Surface | Built on | Decision |
|---|---|---|
| `toast()` | Base UI Toast | A **module-level toast manager** created by Base UI's factory. It is a pure event emitter with no DOM access, safe at module scope, and it is what makes `toast()` callable from a route action or an event handler rather than only from inside a component |
| `banner()` | The same queue, a persistent page-level region the provider renders | Not a portal; it participates in page layout |
| `confirm()` / `alert()` | `Dialog` | Promise-based: `if (await confirm({...}))`. The only surface Phase 4 could already have supported |
| `announce()` | Live regions the provider renders | Empty on the server and on first client render, text set in an effect, so it is announced rather than being present at hydration |

**Severity maps to Base UI's priority, not to its `type`.** Verified: Base UI assigns
`role="dialog"` or `role="alertdialog"` by priority and renders an extra visually-hidden
assertive region for high priority; `type` only sets a data attribute for styling. So
ADR-0012's "assertive only for errors" is implemented as: **error → high priority and
`timeout: 0`** (errors never auto-dismiss, per ADR-0012), everything else default priority
with a five-second timeout. Visible limit of three, with overflow queued.

**Calls before the provider mounts are dropped.** The manager has no subscriber until the
provider renders, so a `toast()` during SSR or before hydration goes nowhere. This is
correct — a toast is client-only state by definition — and it is documented in the API
rather than worked around, because the workaround (buffering) would deliver a stale toast
after navigation.

`ApProvider` gains the fourth provider with **no public API change**, as its own doc
comment promised.

## 5. Hooks and formatters (plan 5g)

### 5.1 New export subpaths

`packages/react/package.json` currently exports `.` and three CSS files. This phase adds
`./hooks`, `./format` and `./format/phone`.

**Why phone is its own subpath.** `libphonenumber-js` is the one non-`Intl` dependency
ADR-0012 accepts. Because `@ap/react` ships source, a static import of it anywhere inside
`./format` fails Vite's import analysis for any consumer who has not installed it — even
if the import would be tree-shaken away. Isolating it means a consumer who never formats a
phone number never needs the dependency. It is declared as an **optional peer**, and a new
guard gate asserts `format/index.ts` never imports it. `libphonenumber-js/min` is the
chosen build: `max` buys only stricter validity regexes, and its own README recommends
possibility over validity because stale metadata makes validity wrong.

`@base-ui/utils` becomes an explicit dependency. It is already installed as Base UI's own
pinned dependency, but importing it without declaring it is a phantom dependency. It
supplies the controlled-state and stable-callback primitives that several hooks would
otherwise hand-roll.

### 5.2 Two honest deviations from "no hand-rolled formatting"

**`formatDuration` composes; it does not feature-detect.** `Intl.DurationFormat` landed in
Node 23; CI pins Node 22.22.0. Feature detection would take the composed path on the
server and the native path in the browser, producing different text on either side of
hydration — a mismatch in a formatter, which is the last place anyone would look for one.
So it always composes from number and list formatters, which is what the native API does
internally. Revisit when the Node floor reaches 23.

**`formatOrdinal` carries a suffix table.** Plural rules yield a category, never a suffix.
The table covers English, French, and the languages that use a trailing dot; an unknown
language returns the bare number rather than an English suffix on German text.

Both are deviations from ADR-0012's spirit and are recorded in the ADR as such.

### 5.3 The rest of the catalogue

- **`formatBytes` is SI only** (1000-based, localised units from `Intl`). Binary units have
  no localised form in `Intl`, so offering them would mean shipping unlocalised strings
  from a localisation module.
- **`formatAddress`** is a country-keyed template table (12 countries: US, CA, GB, IE, AU,
  NZ, DE, FR, NL, IN, SG, JP) with a generic fallback, and `Intl.DisplayNames` for the
  country line. Every library considered was rejected on dependency weight or on fetching
  data at runtime; the table is about forty lines.
- **`formatName` takes name order from the record, never from the locale.** A person's name
  order is a fact about them, not about who is reading. `displayName` wins over everything
  when present. Particle handling (`van der`, `de la`) is explicitly out of scope and
  documented as a limitation rather than half-implemented.
- **Masking is deterministic and separator-preserving**, so a masked column still aligns
  with an unmasked one. `maskTaxId` has a per-country table; **each country's convention
  must be cited in the plan**, because "how much of a national identifier may be shown" is
  a compliance question, not a formatting preference. Uncited countries fall back to the
  generic last-four rule.
- **Formatters take locale and timezone explicitly** and never read `Date.now()` — the SSR
  gate already bans it. They import nothing from React, which requires a named exemption in
  the `use-client` gate's list, itself asserted to exist.

### 5.4 Hooks

Every hook follows the ADR-0005 rule: the server returns the declared default, and
reconciliation happens in an effect or through `useSyncExternalStore`, never by reading the
DOM during render.

- **`useMediaQuery` is hand-rolled on `useSyncExternalStore`**, not wrapped from Base UI's
  equivalent, which is exported under an `unstable-` name. It needs a narrow, justified
  exemption in the SSR gate, which bans `matchMedia` by text — the same pattern
  `useIsomorphicLayoutEffect` already uses.
- **`useReducedMotion`** is that hook against the reduced-motion query. It exists for
  JS-driven motion only; CSS motion is already handled at the token layer.
- **Storage hooks** return the default on the server, subscribe to both the storage event
  and a same-tab emitter, and never read storage during render. `ThemeProvider` currently
  does this by hand; migrating it onto the hook is **not** in this phase, because that
  changes proven code for tidiness.
- The remaining hooks are thin and built on Base UI's utilities or React built-ins rather
  than reimplemented.

Per §4.1.6, most of these have no in-repo caller. Their tests are their only consumer, and
that is stated in the plan so nobody mistakes coverage for usage.

## 6. Gates

Phase 5 must leave all ten of ADR-0014's gates running.

**`test:unit` becomes a composite of two Vitest projects** — the existing
node/jsdom component tests, and the Storybook browser project that runs stories, their
`play` functions and axe. One script name, because ADR-0014 names `test:unit` as gate 4's
command and a renamed gate is a changed ADR. Where the verification table below says
`test:unit`, it means whichever project owns that assertion.

**A new gate file must be registered in `test:guards`.** That script names its six gate
files explicitly, so a seventh gate that is not added there runs under `npm test` but never
under CI's gate job — green for the wrong reason. The phone-isolation gate in §5.1 is the
one this phase adds.

| Gate | Command | Change in this phase |
|---|---|---|
| 1–3 | `test:tokens`, `test:contrast`, `test:gamut` | Unchanged |
| 4 | `test:unit` | Gains the Storybook browser project for stories and `play`; component unit tests stay as they are |
| 5 | `test:a11y` | Moves from the showcase spec to axe inside the Storybook run, same WCAG tags |
| 6 | `test:ssr` | Fixture grows a page per new component, and the streamed route grows the ones worth streaming |
| 7 | `test:spa` | Same app, unchanged mechanism |
| 8 | `test:consumer` | Mechanism unchanged; the fixture gains an import from `./format` so the new subpaths are proven to resolve for a `file:` consumer |
| **9** | `test:visual` | **New.** Advisory |
| **10** | `size` | **New.** Advisory |

### 6.1 Gate 10 — bundle budget

**A script running Vite library builds, not `size-limit`.** The reason is specific: no
`size-limit` plugin understands vanilla-extract. Its esbuild plugin would not error — it
would bundle the `.css.ts` module bodies and the vanilla-extract runtime as JavaScript and
report an inflated number for code no consumer ever ships. A number that is wrong in a
predictable direction is worse than no number, because it will be trusted.

The script builds each entry through the pipeline consumers actually use — Vite plus the
`@ap/vite` plugin, React external — and measures brotli-compressed JS and CSS
**separately**, because CSS is where regressions will actually show: vanilla-extract emits
for every `.css.ts` reached, so a component that imports a shared recipe file pulls all of
its variants.

Checks: the whole index, `./hooks`, `./format`, and **one single-named-import check per
component** (`export { Button } from '@ap/react'`), which is the tree-shaking proof. If
`import:Button` is not far smaller than `index`, side effects are dragging the library in.

Budgets live in a JSON file as a ceiling. Advisory via step-level `continue-on-error` plus
a job summary, matching ADR-0014's "warns on regression". Flipping it to blocking later is
a one-line change.

### 6.2 Gate 9 — visual regression

Playwright screenshots over a static Storybook build, stories enumerated from the build's
own index file rather than a hand-maintained list, in light and dark.

**Baselines are Linux-only**, generated by a manual `workflow_dispatch` job that commits
them. Windows and Linux rasterise type differently, so a baseline produced on a dev machine
guarantees a red CI. The spec deliberately does not use a platform suffix in snapshot
paths: one set of baselines, one platform that may produce them, and a skip on any other.
A Docker path for local generation is documented as a convenience, not a requirement.

Runs on pull requests only. On `main` the committed baselines are current by definition and
no reviewer is looking at the diff. Advisory the same way as gate 10, with actual, expected
and diff images uploaded as artifacts.

Vitest 4's own screenshot support is the obvious future home for this, now that 5a puts the
repo on Vitest 4. It is not adopted here because gate 9 arrives in 5h, after Storybook and
Playwright are already wired, and switching mechanisms mid-phase buys nothing. Named as a
Phase 6 candidate.

## 7. Verification plan

Ordered. Each is a command whose output is the evidence.

| # | Check | Command | Success signal |
|---|---|---|---|
| 1 | Vitest 4 breaks nothing | `npm test && npm run test:gates` | Green with no test file edited |
| 2 | Stories run headlessly | `test:unit` (Storybook project) | Every story renders; `play` functions execute in Chromium |
| 3 | Axe fails on a real violation | `test:a11y` | A deliberately unlabelled control fails and names its story; removing it goes green |
| 4 | Every control's ARIA is derived | `test:unit` | `aria-describedby` / `aria-invalid` resolve to real ids with nothing hand-passed, for each of Textarea, Checkbox, Switch, Radio, Select |
| 5 | Uncontrolled submit works pre-hydration | `test:ssr` | A JS-blocked form post carries values from each new control, including Select's hidden input |
| 6 | Select's label is server-rendered | `test:ssr` | The selected item's text, not its value, in the streamed response |
| 7 | No portal in server HTML | `test:ssr` | Trigger present, popup absent, for Select, Tooltip, Popover, Toast |
| 8 | Tooltip describes its trigger | `test:unit` | `role="tooltip"` and `aria-describedby` present while open, absent when closed |
| 9 | Popover returns focus | `play` | Focus returns to the trigger on dismiss; trapped while open with a close part present |
| 10 | Panel motion is token-driven | `test:unit` / `test:visual` | Accordion's panel animates via the aliased variable; perturbing the alias breaks it |
| 11 | Reduced motion degrades every animated component | `play` under emulation | Animations collapse with no component change |
| 12 | Errors never auto-dismiss | `test:unit` | An error toast is still present after its would-be timeout; a default toast is gone |
| 13 | `toast()` works from outside React | `test:unit` | A module-scope call after mount renders a toast |
| 14 | Formatters are deterministic | `test:unit` | Fixed locales and explicit timezones; no `Date.now()` in the module |
| 15 | The phone dependency is isolated | `test:guards` | `format/index.ts` does not import it; adding the import fails the gate |
| 16 | Zero hydration warnings across every component | `test:ssr` | Captured console clean through hydration |
| 17 | SPA build renders every component | `test:spa` | Same app with `ssr: false` |
| 18 | Tree-shaking holds | `size` | A single named import is a fraction of the full index, per component |
| 19 | Screenshots match Linux baselines | `test:visual` | Advisory; diffs uploaded |

**Proof artifact:** a green CI run on the Phase 5 PR with gates 1–8 passing and gates 9 and
10 reporting, plus `reports/contrast.md` from that run.

## 8. Deliberately not in Phase 5

| Deferred | Why |
|---|---|
| Auto-growing `Textarea` | Needs per-keystroke measurement; no product has asked |
| `render` on `Checkbox` / `Switch` / `Radio` | §4.1.2 — it invites replacing the structure that makes forms and labelling work |
| Tabs' pre-hydration indicator script | Inline `<script>` is a CSP question; the nonce story is its own work |
| `ThemeProvider` migrating onto `useLocalStorage` | Changes proven code for tidiness |
| Particle handling in `formatName` | Culture-specific and genuinely hard; documented as a limitation instead of half-built |
| Binary byte units | No localised form exists in `Intl` |
| Native `Intl.DurationFormat` | §5.2 — not in Node 22; adopting it would split server and client text |
| Vitest's own screenshot support for gate 9 | §6.2 — Playwright is already wired; named as a Phase 6 candidate |
| Storybook's build and deployment | Phase 6. This phase brings up stories as test infrastructure and docs pages as content; Phase 6 publishes them. **The Vite `base` path is the exception and is set here** — see §3.5 |
| Anchored toasts | Base UI wants a second provider for them; no caller |
| Data-display components (Table, Pagination, Badge, Avatar, Card, EmptyState) | v2, per ADR-0011 |

## 9. Risks

| Risk | Mitigation |
|---|---|
| The Vitest 4 upgrade breaks the existing suite | It is task one of 5a with a named fallback (§3.3); nothing else in the phase starts until it is green |
| Ten components in sequence fork the conventions | §4.1 is written first and every plan cites it; the review checklist is the same each time |
| Storybook's a11y failure path depends on a transitive matcher package | Proven on first run with a deliberate violation (§3.6); if the import is missing, declare it |
| Gate 9 produces noise that trains people to ignore CI | Advisory by construction, PR-only, with a pixel-ratio threshold; ADR-0014 already rejects blocking visual regression |
| Gate 10's number is honest but the pipeline is bespoke | It measures the real consumer pipeline; the alternative measures a bundle nobody ships (§6.1) |
| The showcase and Storybook drift into two galleries | The showcase's job is narrowed to SSR smoke with no prose, and CONTRIBUTING says so |
| `maskTaxId`'s per-country rules are a compliance question | Each country's rule is cited in the plan; uncited countries get the generic rule |
