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
  the list as `options` (renamed from `items` after 5c, see §4.3.1) and passes Base UI a
  flat `items`.
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

- **`options`** is a flat list `{ value, label, disabled? }[]` (`SelectOption`) or a grouped
  list `{ label, options }[]` (`SelectOptionGroup`). Named after `RadioGroup`'s `options` and
  `RadioGroupOption`, and kept apart from the `Select.Item`/`Select.Group` parts; renamed
  from `items`/`SelectItem`/`SelectGroup` on 2026-10-03, before any release. Groups render as `Select.Group` with a `Select.GroupLabel`, and a
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
- **`placeholder`** is consumer-supplied content, not a message key. An empty `options`
  list shows the existing `noResults` key; no new key is needed.
- **A value matching no option shows serialised, not as the placeholder** (settled
  2026-10-03). It still posts and Base UI counts it as selected, so the placeholder there
  would read as "nothing chosen" while the form submits a value. In a multiple select the
  unmatched entries appear raw in the locale list.
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
  resolution never runs for anything built through `<Select options={…} />`. Only a
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
description parts, and non-modal (§4.4.1). Base UI's hover-open option makes it the
sanctioned "infotip" when content must be richer than a tooltip.

*Corrected 2026-10-03:* this section first said focus is "trapped only when it contains a
close part". Base UI traps only when `modal !== false` **and** a close part is present
(`popover/popup/PopoverPopup.js:76`), and `modal` defaults to `false`
(`popover/root/PopoverRoot.js:26`). So a default Popover never traps focus, close part or
not.

#### 4.4.1 Scope and API — settled 2026-10-03, before the plan

Every Base UI claim below was checked against the installed `@base-ui/react` 1.7.0; paths
are relative to `node_modules/@base-ui/react/`.

**Base UI facts this plan relies on.**

- Tooltip emits no ARIA except `aria-hidden` on its arrow (`tooltip/arrow/TooltipArrow.js:49`).
  No part calls Floating UI's `useRole`. Base UI generates no popup id for it.
- `Tooltip.Trigger` renders a `<button>` through `useRenderElement`, not `useButton`
  (`tooltip/trigger/TooltipTrigger.js`, the `useRenderElement('button', …)` call), so it
  has no `nativeButton` prop and §4.1.1's derivation does not apply to it.
- The trigger's render state carries `open`, true only when *this* trigger opened the
  tooltip (`tooltip/trigger/TooltipTrigger.js:207-208`).
- `Tooltip.Provider` takes `delay`, `closeDelay` and `timeout` (default 400), and groups
  delays only (`tooltip/provider/TooltipProvider.js:21-23`).
- `Popover.Popup` sets `role="dialog"`, with `aria-labelledby`/`aria-describedby` from the
  Title/Description parts (`popover/popup/PopoverPopup.js:91-94`). The trigger sets
  `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls`
  (`popover/trigger/PopoverTrigger.js:122-124`).
- `openOnHover`, `delay` and `closeDelay` are **trigger** props, not root props
  (`popover/trigger/PopoverTrigger.js:41-43`).
- A Popover dismisses on an outside press (`popover/root/PopoverRoot.js:115`, `useDismiss`).
  Two sibling Popovers do not stay open together: opening the second closes the first,
  pinned by the `SiblingsClose` story. Nested Popovers are unverified: no story or test
  exercises them. We keep this default.

**Tooltip.**

- **Convenience:** `<Tooltip content={node} side? delay? closeDelay?>{trigger}</Tooltip>`.
  The child is rendered *through* `Tooltip.Trigger`, as `Dialog` renders its `trigger`, so
  it stays one button. `side` defaults to `top` (§4.1.7).
- **Content is any `ReactNode`.** The JSDoc states that interactive content and the only
  copy of an accessible name do not belong in a tooltip; those go to `Popover`.
- **ARIA wiring.** `Tooltip.Root` generates an id with `useId` and provides it through a
  context of our own. `Tooltip.Popup` sets that `id` and `role="tooltip"`.
  `Tooltip.Trigger` adds `aria-describedby` from its render state, only while `open`,
  appended to any `aria-describedby` the consumer set. While closed, server and client
  HTML carry no reference to the absent popup. Each Root has its own id, so the wiring
  holds for any number of open tooltips.
- **Describe, never name.** The tooltip is always a description. An icon-only trigger still
  needs its own `aria-label`; a story shows the pattern.
- **`ApProvider` gains one `Tooltip.Provider`** with Base UI's default delays.
- **Look:** a raised surface (`bgRaised`, `textPrimary`, a `borderSubtle` border and the popup
  shadow), `text.sm`, no arrow, `enter.fade-rise`/`exit.fade`. Not inverse: the theme has no
  inverse colour role (`theme/contract.css.ts`), and adding one is a token-system change
  outside this plan.
- **Parts:** `Tooltip.Provider`, `Root`, `Trigger`, `Popup`. `Popup` bundles Portal and
  Positioner as `Select.Popup` does, so neither is a part of ours. *(Corrected during
  execution: this list first named `Portal` and `Positioner`, contradicting this sentence.)*

**Popover.**

- **Convenience:** `<Popover trigger={…} title? aria-label? description? dismissible?
  openOnHover? delay? closeDelay? side?>{children}</Popover>`. `side` defaults to `bottom`.
- **A name is required.** The props are a union: `title` (rendered as `Popover.Title`) or
  `aria-label`. Neither is a compile error. `description` renders `Popover.Description`.
- **Non-modal, always in the convenience component.** Escape and outside press close it
  (Base UI's, §4.1.6). Where focus lands on open, and whether Tab out of the popup closes
  it, are **not yet verified in source** (settled in §4.4.2): the plan cites
  `FloatingFocusManager`'s non-modal behaviour by file and line, and a story pins each. The convenience component
  does not expose `modal`; the parts do.
- **`dismissible`** (default `false`) renders a × `Popover.Close` labelled with the
  existing `close` message key (`providers/messages.ts`). No new key.
- `openOnHover`, `delay` and `closeDelay` route to the trigger, where Base UI reads them.
- `Popover.Trigger` and `Popover.Close` use the `nativeButton` derivation (§4.1.1).
- **Look:** Select's popup surface tokens, no arrow, `enter.fade-rise`/`exit.fade`.
- **Parts:** `Popover.Root`, `Trigger`, `Popup` (bundling Portal and Positioner), `Title`,
  `Description`, `Close`, and `Dismiss` (the × icon `Close` labelled with the `close` message
  key, which `dismissible` renders).

**Shared:** `POSITIONER_SIDE_OFFSET`; no `keepMounted` (§4.1.9); every assertion names the
perturbation that makes it fail, `play` functions included (5c retrospective).

#### 4.4.2 Verified during the plan

Paths are relative to `node_modules/@base-ui/react/`, Base UI 1.7.0.

- **Initial focus (open in §4.4.1, now settled).** A click-opened Popover moves focus to its
  first tabbable element, or to the popup on touch (`utils/popups/popupStoreUtils.js:45-46`).
  The focus manager is disabled for a hover-opened popover (`popover/popup/PopoverPopup.js:107`),
  so focus stays on the trigger. Pinned by the `Default` and `HoverInfotip` stories and
  `fixtures/ssr-app/e2e/overlays.spec.ts`.
- **Tab out closes (open in §4.4.1, now settled).** `FloatingFocusManager` defaults
  `closeOnFocusOut = true` (`floating-ui-react/components/FloatingFocusManager.js:127`) and
  `PopoverPopup` does not override it. Pinned by the `TabOut` story (with the
  `TabOutTrapped` control) and the fixture spec.
- **Two tooltips at once.** Base UI keeps one tooltip visible: focusing one trigger and then
  hovering another closes the first. Pinned by the `TwoOpen` characterisation story, so
  §4.4.1's "holds for any number of open tooltips" is true of the wiring, not of what Base UI
  lets stay open. The mechanism is the delay group: every `Tooltip.Trigger` calls
  `useDelayGroup` unconditionally (`tooltip/trigger/TooltipTrigger.js:106`), and when a
  tooltip opens, the group's effect closes the previously open one with reason `none`
  (`floating-ui-react/components/FloatingDelayGroup.js:144-166`, the close at `:166`).
  `ApProvider`'s `Tooltip.Provider` gives its tooltips one shared group; with no provider,
  the default context's `currentIdRef` and `currentContextRef` are module-level objects
  (`FloatingDelayGroup.js:17-33`), so every unprovided tooltip shares one group too.
  Removing the provider therefore does not let two stay open.
- **Two `defaultOpen` Roots.** Two uncontrolled `defaultOpen` Tooltip Roots cannot both stay
  open on mount, by the same mechanism: the second to open closes the first with reason
  `none` (`FloatingDelayGroup.js:166`). Checked during the fix wave: wrapping each Root in its
  own `Tooltip.Provider` (two groups) keeps both open. Controlled `open` also keeps both open,
  because the close is only a request to `onOpenChange`; the two-Roots test in
  `TooltipParts.test.tsx` relies on that.
- **`keepMounted` does not put a popup in server HTML.** `FloatingPortal` starts with
  `portalNode` null (`:44`) and sets it only from a ref callback, on the client
  (`:45-50`); the portal renders only once it is set (`:195-199`). The unit assertions that server
  HTML has no `role="tooltip"` or `role="dialog"` are therefore regression guards, and
  `keepMounted` cannot make them fail. The real-browser proof is `overlays.spec.ts`, which
  reads the raw response.
- **`deriveNativeButton` and our own `Button` (Ruling R5).** `deriveNativeButton(<Button/>)`
  returned false, because `Button` is a composite, so `<Popover trigger={<Button>}>` told Base
  UI a real `<button>` was non-native: a console error and wrong ARIA. `Button` now carries a
  `NATIVE_BUTTON_DERIVABLE` marker and the helper derives through it
  (`packages/react/src/internal/deriveNativeButton.ts`). This corrects §4.1.1's reuse for
  `PopoverTrigger`, `PopoverClose` and `SelectTrigger`.
- **An anchor as a Popover trigger keeps `role="button"` (Ruling R3).** `Button` clears the
  forced role only for navigation elements (`href`/`to`), because activating them navigates.
  Activating a popover trigger opens the popover, so `role="button"` is truthful. `SelectTrigger`
  already behaves this way.
- **`Tooltip.Trigger`'s `render`** takes an element or a function. A function receives `props`
  that already carry `aria-describedby` while open, and must spread them.
- **Programmatic open still describes the trigger.** With a single trigger, Base UI claims it
  as the active trigger (`utils/popups/popupStoreUtils.js:232-237`, `:350-356`), so the
  render state's `open` is true and `aria-describedby` is set.

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

*Superseded 2026-10-04 for Accordion:* closed panels are **hidden until found**, not
unmounted. See §4.5.1.

#### 4.5.1 Scope and API — settled 2026-10-04, before the plan

Every Base UI claim was checked against the installed `@base-ui/react` 1.7.0. Paths are
relative to `node_modules/@base-ui/react/`. Each citation points at the line that causes
the claim (5d retrospective).

**Base UI facts this plan relies on.**

- **Tabs activation is manual by default:** `activateOnFocus = false` (`tabs/list/TabsList.js:26`).
  Focus wraps, with `loopFocus = true` (`:28`). `orientation` sets `aria-orientation` (`:83`).
- **Inactive tab panels unmount:** `keepMounted = false` (`tabs/panel/TabsPanel.js:36`). A panel renders
  only when `keepMounted || mounted` (`:100`).
- **The indicator's pre-hydration script is off by default:** `renderBeforeHydration = false`
  (`tabs/indicator/TabsIndicator.js:36`). The script is rendered only when that flag is set (`:134-135`).
  The indicator's geometry comes as `--active-tab-left/right/top/bottom/width/height` (`:104-109`).
- **A tab is a native button with `role="tab"`:** `nativeButton = true` (`tabs/tab/TabsTab.js:38`) feeds
  `useButton` (`:115-117`), and `role: 'tab'` is set at `:178`.
- **The Accordion is single-open and vertical by default:** `multiple = false` and `orientation = 'vertical'`
  (`accordion/root/AccordionRoot.js:36-37`). `hiddenUntilFound` and `keepMounted` both default to `false`
  (`:102-103`).
- **A panel is `role="region"`, labelled by its trigger** (`accordion/panel/AccordionPanel.js:106-107`).
  The trigger sets `aria-expanded` and, while open, `aria-controls` (`accordion/trigger/AccordionTrigger.js:62-63`).
  The trigger is a native button: `nativeButton = true` (`:29`).
- **The header renders `<h3>`:** `useRenderElement('h3', …)` (`accordion/header/AccordionHeader.js:29`).
- **The panel height variable is `--accordion-panel-height`** (`accordion/panel/AccordionPanelCssVars.js:12`).
  `@ap/motion`'s `collapse`/`expand` read `--panel-height` (`packages/motion/src/motions.ts:103-116`, in
  this repo), so the §4.1.5 alias stands.
- **`hidden="until-found"` is applied on the client only.** React renders `hidden` as a boolean, so Base UI
  sets the string value in a layout effect (`collapsible/panel/useCollapsiblePanel.js:270-280`, citing
  react#24740). A `beforematch` listener opens the panel when find-in-page matches it (`:281-290`).
  **Consequence:** server HTML contains a closed panel's content under a plain `hidden`. Find-in-page can
  reveal it only after hydration. The plan pins both halves.

**Tabs.**

- **Convenience:** `<Tabs items={[{ value, label, content, disabled? }]} variant? orientation? keepMounted?
  defaultValue | value onValueChange … />`. Each item renders a `Tabs.Tab` in the list and a
  `Tabs.Panel` with its `content`.
- **A name is required.** The tab list needs one, so the props are a union of `aria-label` and
  `aria-labelledby`, applied to `Tabs.List`. Neither is a compile error, the pattern `Popover` uses.
- **`variant`:** `underline` (default) or `pills`.
- **`orientation`:** `horizontal` (default) or `vertical`.
- **What the indicator looks like:**
  - `underline` + `horizontal`: a bar along the active tab's block-end edge.
  - `underline` + `vertical`: a bar along its inline-end edge.
  - `pills`: a filled background behind the active tab, in either orientation.
- **How the indicator moves.** It is one `Tabs.Indicator`. Its position and size **transition** on the
  `--active-tab-*` variables, timed by a duration token (§4.1.5), and nothing is keyframed.
- **Manual activation and wrapping focus** are Base UI's defaults, kept.
- **Inactive panels unmount.** `keepMounted` passes through.
- **No pre-hydration script** (§4.5). The indicator appears at hydration, and its first appearance is a
  transition from no width, never a jump. The plan pins this.
- **Parts:** `Tabs.Root`, `List`, `Tab`, `Panel`, `Indicator`. `Tabs.Tab` uses the `nativeButton`
  derivation (§4.1.1), and is tested with our own `Button` as its `render` (5d retrospective).

**Accordion.**

- **Convenience:** `<Accordion items={[{ value, title, content, disabled? }]} multiple? headingLevel?
  defaultValue | value onValueChange … />`.
- **`headingLevel`:** `2 | 3 | 4 | 5 | 6`, default `3`. The convenience component passes the matching
  heading element as each `Accordion.Header`'s `render`. The parts still accept `render`, so a hand
  assembly controls the level directly.
- **Closed panels are hidden until found.** The convenience component passes `hiddenUntilFound`. Closed
  content is in server HTML (under `hidden`), and after hydration browser find-in-page opens the matching
  section. This supersedes §4.5's "unmounted when closed". It costs a heavier DOM, which is accepted for
  searchable content.
- **Trigger:** a native button whose title text is followed by a decorative chevron (`aria-hidden`) that
  rotates while open. The trigger uses the `nativeButton` derivation, tested with our own `Button`.
- **Height motion:** `collapse`/`expand` from `@ap/motion` on the panel's closing and opening states, through
  `--panel-height: var(--accordion-panel-height)` (§4.1.5). The component has no reduced-motion query.
- **Single-open by default.** `multiple` passes through.
- **Parts:** `Accordion.Root`, `Item`, `Header`, `Trigger`, `Panel`.

**Shared.**

- Token roles follow §4.1.10 where a part is a control (tab, trigger).
- Hover is guarded against disabled **and** against the selected or open state. That is the 5c follow-up's
  rule: `:hover:not(…)` outranks a state rule on specificity.
- Every string is consumer content, so no new message key.
- Every assertion names the perturbation that makes it fail, `play` functions included.

#### 4.5.2 Verified during the plan

Paths are relative to `node_modules/@base-ui/react/`, Base UI 1.7.0. Where the cause is not a
source line, the entry says "observed" and names the test that pins it. §4.5.1 is left as
written; this section records what contradicts it, and the Review Focus results.

**Contradicts §4.5.1.**

- **`Tabs.List` has no `orientation` prop.** §4.5.1 and the plan's facts row had the list
  taking it. `TabsList` reads orientation from the Root's context (`tabs/list/TabsList.js:33-37`)
  and sets `aria-orientation` at `:83`. Ours passes `orientation` to the Root only; `TabsList`
  uses our private context just to pick its recipe class. Pinned by the vertical test in
  `TabsParts.test.tsx` (a regression guard).
- **The indicator's first paint is not a transition from no width** (§4.5, §4.5.1). The
  indicator renders `hidden` until the selected tab measures wider and taller than zero
  (`tabs/indicator/TabsIndicator.js:111`, `:124`) and renders nothing with no value (`:130`),
  so it appears directly at the tab, with no `@starting-style`. Later changes transition.
  Pinned by the `Indicator` story.
- **The right-to-left indicator uses `--active-tab-left`, not `--active-tab-right`.** Base UI
  measures `left` in scroll-origin coordinates including `scrollLeft` (`TabsIndicator.js:81`)
  and `right` as `scrollWidth - left - width` (`:89`), so `--active-tab-right` is wrong
  whenever the list overflows. Under `:dir(rtl)`, `Tabs.css.ts` sets `insetInlineStart: auto`
  and `insetInlineEnd: var(--active-tab-left)`. Observed: the `--active-tab-right` form was
  725px off on an overflowing RTL list. Pinned by the `RightToLeft` story's geometry assertion.
- **Disabled tabs stay focusable, and arrow keys do not skip them** (contradicts Review Focus
  2 below). `TabsTab` passes `focusableWhenDisabled: true` (`tabs/tab/TabsTab.js:118`) and
  `TabsList` passes no disabled indices (`TabsList.js:108`). A disabled tab gets
  `aria-disabled="true"` and cannot be selected by Enter or click. Pinned by the
  `DisabledTab` story.
- **`Tabs` `onValueChange` can receive `null`.** An uncontrolled root's automatic fallback
  notifies `firstEnabledTabValue ?? null` (`tabs/root/TabsRoot.js:220`, notified at `:194`).
  Ours types `value` as `Value | null`. Pinned by the null-fallback test in `Tabs.test.tsx`.
- **Accordion `value` is `Value[]`.** Base UI's value is an array of item values with no null
  fallback (`accordion/root/AccordionRoot.js:56-61`), so `Accordion` narrows `value`,
  `defaultValue` and `onValueChange` to `Value[]`.
- **The data type is `AccordionSection`** (the part stays `AccordionItem`), following the 5c
  `SelectOption` precedent.

**Panel states.** Expand runs on `[data-open]`. Collapse must be keyed on `[data-closed]`,
not `[data-ending-style]`: the root defers the ending state (`collapsible/root/useCollapsibleRoot.js:33`
passes `deferEndingState`, applied at `internals/useTransitionStatus.js:31-35`), and on the
close-request commit the panel sees no animation (`collapsible/panel/useCollapsiblePanel.js:134`)
and unmounts immediately (`:187-189`). `data-closed` comes from `utils/collapsibleOpenStateMapping.js:12-14`,
`:25-31`; the trigger's open attribute is `data-panel-open` (`:15-23`). Pinned by the `Motion`
story; swapping the selector to `[data-ending-style]` fails it.

The panel keeps an always-on `overflow: hidden`, because `data-starting-style` lasts one frame
(`internals/useTransitionStatus.js:61-63`). Padding therefore lives on an owned inner `div`,
whose `paddingBlockStart` is the focus ring's offset plus width, so a first focusable child's
ring is not clipped. Pinned by the `HiddenFocus` story.

**`hidden="until-found"` is client-only (confirms §4.5.1, adds detail).** Server HTML has the
boolean `hidden=""`; a layout effect sets `until-found` (`useCollapsiblePanel.js:270-280`) and
`beforematch` opens the panel (`:281-290`). jsdom keeps the `until-found` value. A panel closed
on mount runs its collapse from 0 to 0 under `content-visibility: hidden`, so nothing is
visible. Pinned by `Accordion.ssr.test.tsx`, `Accordion.test.tsx`, the `FindInPage` story and
`disclosure.spec.ts`.

**Server HTML renders every tab with `tabindex="-1"`.** A composite item's `tabIndex` is 0 only
when `highlightedIndex === index` (`internals/composite/item/useCompositeItem.js:23`, `:27`),
and the index comes from a DOM registry that is not populated in server markup
(`internals/composite/list/useCompositeListItem.js:42`). Observed: the keyboard spec in
`disclosure.spec.ts` waits for hydration. The consequence is that a keyboard user cannot enter
the tab list before hydration.

**Disabled Accordion trigger.** It stays focusable (`accordion/trigger/AccordionTrigger.js:45`,
`focusableWhenDisabled: true`; the `useButton` call is at `:43-47`), exposes `data-disabled`
and `aria-disabled`, and cannot be opened by click. Pinned by the `DisabledItem` story.

**Heading level.** `Accordion.Header` renders `<h3>` (`accordion/header/AccordionHeader.js:29`),
which is why `headingLevel` exists.

**Review Focus results.**

1. **`Tabs` with neither `value` nor `defaultValue`.** Confirmed. Base UI's Root defaults to
   `0`, which matches no string value, and the uncontrolled fallback runs in a client layout
   effect, so server HTML would have no selected tab. `Tabs` computes the first enabled item
   itself. Pinned by `Tabs.ssr.test.tsx` and `disclosure.spec.ts`.
2. **Disabled tabs during keyboard navigation.** Contradicted: arrow keys do not skip a
   disabled tab (see above). The tab is unselectable by click and Enter.
3. **A focusable control inside a closed Accordion panel.** Confirmed: Tab skips it, and
   reaches it once the section is open. Proven with a native Playwright Tab in
   `disclosure.spec.ts`. Storybook's user-event Tab cannot prove it (it picks by selector), so
   `HiddenFocus` uses a `tabFrom` helper.
4. **Right-to-left pages.** Confirmed with the correction above: the underline sits under the
   active tab in `dir="rtl"`, using `--active-tab-left` under `:dir(rtl)`. Pinned by
   `RightToLeft`.
5. **More tabs than fit.** Confirmed: a horizontal list scrolls inside its own box, and the
   indicator follows the active tab, because `left` includes `scrollLeft`
   (`TabsIndicator.js:81`). Pinned by the overflow story.

**Known issue, observed and not a Base UI fact.** The Inter fallback font's metrics make tabs
about 3px narrower before the web font loads, so on a cold first paint the indicator follows
the tabs by about 3px once it loads.

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

> **Superseded in part by §4.6.1 (2026-10-06).** Overflow is not queued, there is no
> assertive toast region, `confirm()`/`alert()` are built on Base UI's `AlertDialog` (with
> `Dialog`'s styling), and `ApProvider` gains one optional, additive prop. The paragraphs
> above are kept as written.

#### 4.6.1 Scope and API — settled 2026-10-06, before the plan

Every Base UI claim was checked against the installed `@base-ui/react` 1.7.0. Paths are
relative to `node_modules/@base-ui/react/`. Each citation points at the line that causes
the claim.

**Base UI facts this plan relies on.**

- **The toast manager is a pure emitter.** `createToastManager` holds a `Set` of listeners
  (`toast/createToastManager.js:12`). `add()` (`:25`) only emits to them (`:14`). It touches no DOM, so it
  is safe at module scope and on the server. With no subscriber the call goes nowhere and is not
  buffered.
- **The provider subscribes in an effect** (`toast/provider/ToastProvider.js:39-59`), so a call made before
  mount or hydration is dropped. Its defaults are `timeout = 5000` and `limit = 3` (`:24-25`).
- **Overflow is rendered, not queued.** The store marks a toast `limited` when `activeIndex >= limit`
  (`toast/store.js:49`), and the newest toasts stay visible. A limited Root stays in the DOM, `inert`
  (`toast/root/ToastRoot.js:431`), with `data-limited`. Our CSS must hide it. It reappears as newer toasts
  close.
- **`timeout: 0` never auto-dismisses.** A timer is scheduled only when `duration > 0` and the type is not
  `'loading'` (`toast/store.js:149`). Timers pause on hover, on focus, and while the window is blurred
  (`:66`).
- **Priority, not `type`, sets the semantics.** A Root's role is `alertdialog` for `priority: 'high'`, and
  `dialog` otherwise (`toast/root/ToastRoot.js:420`). The viewport is a `region` with `aria-live="polite"`
  for every priority (`toast/viewport/ToastViewport.js:185-186`). While the viewport is not focused, it adds
  a visually hidden `role="alert"` copy of each high-priority toast (`:47`, `:223`). There is **no assertive
  live region**. `type` becomes `data-type` only.
- **The viewport label is hard-coded English:** `'aria-label': 'Notifications'`
  (`toast/viewport/ToastViewport.js:189`). It is overridable by prop, so ours comes from a message key.
- **F6 focuses the viewport** (`toast/viewport/ToastViewport.js:61`). Escape on a focused toast closes it
  (`toast/root/ToastRoot.js:381`).
- **Swipe defaults to `['down', 'right']`** (`toast/root/ToastRoot.js:50`). It is a prop, so placement can
  set it.
- **The toast portal is client-only.** `FloatingPortalLite` returns `null` until its node exists
  (`utils/FloatingPortalLite.js:36-37`), so a portalled viewport is absent from server HTML.
- **`AlertDialog` is `Dialog` in alert mode.** `useRenderDialogRoot` sets `role = 'alertdialog'`
  and `disablePointerDismissal` for that mode (`dialog/root/useRenderDialogRoot.js:32-35`), so an outside
  click cannot dismiss it.

**One emitter per kind, one provider.**

- `toast()` goes straight to a module-level `createToastManager()`. Base UI's queue, timers, pause,
  `promise()` and id upsert are reused, not rewritten.
- `banner()`, `confirm()`/`alert()` and `announce()` go through one small typed emitter of ours. It has the
  same subscribe/emit shape and no DOM access.
- `NotificationProvider` subscribes to both on mount. It renders four things: the toast viewport (portalled,
  so client-only), the dialog host, two live regions, and the context that `BannerRegion` reads.
- **Every surface is a module-level function** importable from `@ap/react`, callable anywhere on the client.
- **A call made with no provider mounted is dropped,** with a development-only `console.warn` naming the
  function. `confirm()` resolves `false` and `alert()` resolves at once, so nothing hangs.

**`toast(options) → id`.**

- `toast({ title, description?, severity?, action?: { label, onClick }, id?, timeout? })`, with
  `toast.info/success/warning/error(titleOrOptions)`, `toast.promise(promise, { loading, success, error })`,
  and `toast.close(id?)`. No id closes all.
- **`severity`:** `'info'` (the default), `'success'`, `'warning'` or `'error'`.
  - `error` maps to `priority: 'high'` and `timeout: 0`. An error toast's `timeout` cannot be overridden,
    because ADR-0012's "errors never auto-dismiss" is absolute.
  - The rest map to `priority: 'low'` with a 5000 ms timeout that a call can override.
  - Severity also becomes `type`, so it is styled through `data-type`. Each level has its own decorative
    icon, so severity is never colour alone.
- **`id` dedupes.** Base UI updates an existing toast in place.
- **Overflow:** Base UI's behaviour is kept, with three visible and the newest shown. An error can be hidden
  behind newer toasts until they time out. This is accepted.
- **Parts:** `Toast.Viewport`, `Root`, `Title`, `Description`, `Action`, `Close`. `Close` and `Action` use the
  `nativeButton` derivation and are tested with our own `Button` as `render`. `Close` is labelled by the
  existing `dismiss` message.

**`placement`.**

- One of `top-start | top-center | top-end | bottom-start | bottom-center | bottom-end`. The default is
  `bottom-end`.
- It is set on `NotificationProvider`, and `ApProvider` passes it through a new optional prop,
  `notifications={{ placement }}`. This is additive, so existing `ApProvider` code is unchanged.
- Placement is a recipe variant using logical insets only, so it mirrors in RTL.
- Swipe dismissal follows placement: toward the nearest inline edge, or toward the block edge for `*-center`.
- Toasts stack as a simple vertical list with a gap, newest nearest the edge. There is no collapsed deck.

**`banner(options) → { close }`.**

- `banner({ title, description?, severity?, action?, id?, dismissible? })`. `dismissible` defaults to `true`.
- Banners never auto-dismiss. A banner with the same `id` replaces the existing one. New banners are
  appended to the stack.
- They render in `<BannerRegion />`, which the app places in its layout. It is not a portal, so banners sit
  in normal page flow.
- Banners are our own markup, so ADR-0012's roles apply literally: `role="status"` for info, success and
  warning, and `role="alert"` for error.
- If no `BannerRegion` is mounted, `banner()` warns in development and falls back to a toast of the same
  severity.

**`confirm(options) → Promise<boolean>`, `alert(options) → Promise<void>`.**

- `confirm({ title, description?, confirmLabel?, cancelLabel?, tone? })`, where `tone` is `'default'` or
  `'danger'`. `alert({ title, description?, okLabel? })`.
- Both are built on Base UI's `AlertDialog`, which has `role="alertdialog"` and no outside-click dismissal.
  They are styled with `Dialog`'s recipe classes.
- Escape resolves `false`. With `tone: 'danger'`, the confirm button uses `Button`'s danger variant and
  initial focus goes to Cancel. Otherwise initial focus goes to Confirm.
- Focus returns to the previously focused element on close (Base UI's default; the plan cites the line).
- Calls queue first-in-first-out, and one dialog is open at a time.
- Labels default to the new `confirm`, `cancel` and `ok` messages.

**`announce(message, { politeness? })`.**

- `politeness` is `'polite'` (the default) or `'assertive'`. The JSDoc reserves `'assertive'` for errors,
  per ADR-0012.
- The provider renders two visually hidden live regions, one per politeness. They are present and empty in
  server HTML and on the first client render, and text is written only in effects.
- Repeating the same text is still announced, because the region is cleared and the text set on the next
  frame. A region clears itself 5 s after its last write. 5g's `useAnnounce` will wrap this function.

**SSR.** Server HTML contains the two empty live regions and the empty `BannerRegion` wrapper, and no toast
or dialog markup (gate 7's Toast row).

**New message keys:**

- `notifications`: the toast viewport label.
- `confirm`, `cancel` and `ok`: the dialog buttons.

The existing `dismiss` labels the toast close button. There are no severity strings: the icon is decorative,
and the title carries the meaning.

**Styling.**

- Tier 3 tokens cover the toast and banner surface, the border, and one accent per severity, from existing
  `vars.color` roles. `test:contrast` gates them.
- Under `forced-colors` the toast and banner keep a visible border, after the 5e lesson. An e2e check runs
  under `forcedColors`.
- Enter and exit motion use `@ap/motion` tokens. The plan reads which state attribute Base UI animates before
  writing a selector, after the 5e `[data-closed]` lesson.

**Shared.**

- Every assertion names the perturbation that makes it fail, `play` functions included.
- CSS behaviour is asserted in stories, because jsdom has no vanilla-extract CSS (5e).
- Real keyboard proofs (F6, Escape, Tab) are made in the fixture e2e.

#### 4.6.2 Verified during the plan

Paths are relative to `node_modules/@base-ui/react/`, Base UI 1.7.0. Where the cause is not a
source line, the entry says "observed" and names the test or story that pins it. §4.6.1 is
left as written; this section records what contradicts it, what the plan added to it, and the
Review Focus results. ADR-0008 records the contrast decisions at the end (commit 095e419), so
they are linked, not repeated.

**Contradicts §4.6.1.**

- **`toast()` does not go to a module-level `createToastManager()`.** This supersedes the
  first bullet under "One emitter per kind". `ToastProvider` subscribes to a manager in a
  passive `useEffect` (`toast/provider/ToastProvider.js:39-59`), and only when it was given
  one (`:40-42`). React runs passive effects child-first, so a page's own
  `useEffect(() => toast(…), [])` fires before the provider above it has subscribed, and the
  manager (a `Set` of listeners, `toast/createToastManager.js:12-15`) delivers to nobody.
  §4.6.1 accepted that as correct, and it is wrong for the commonest use, a route that toasts
  on arrival. Ours is one channel (`notifications/channel.ts`) for every kind, relayed into
  Base UI's own store by `Relay` in `notifications/NotificationProvider.tsx`. `Relay`
  subscribes in a layout effect (which runs before every passive effect) and calls the
  `add`, `close` and `promise` of `useToastManager()` (`toast/useToastManager.js:17-23`,
  which are the store's own methods). The queue, timers, pause, upsert and promise handling
  are still Base UI's. The plan's facts table cited `ToastProvider.js:108-128` for the
  subscription. That is wrong: the file is 82 lines long, and the subscription is at `:39-59`.
- **The layout effect alone is not what delivers a mount-effect toast.** `Relay` renders as an
  earlier sibling of the provider's children, so a toast raised by a *child's* `useEffect`
  also arrives after the relay has subscribed, whichever effect type the relay uses. The
  discriminator is the test that renders the page *before* the provider in tree order,
  `NotificationProvider.test.tsx` "shows a toast raised by a mount effect that runs BEFORE the
  provider (fails if the relay subscribes in useEffect)". The child-of-provider test beside it
  cannot tell the two effect types apart, and neither can the fixture e2e "a toast raised from
  a page mount effect is shown after hydration" (`fixtures/ssr-app/e2e/notifications.spec.ts`),
  which is a real-browser regression pin. The deviation from `createToastManager` still
  stands, because Base UI's provider is an ancestor and subscribes after its children's
  passive effects.
- **A toast action closes its toast after `onClick`; the fallback toast is persistent.** Base UI's
  `ToastAction` merges `toast.actionProps` into the button and never closes the toast
  (`toast/action/ToastAction.js:46-48`), so `Relay` wraps `onClick` to call the caller's handler,
  then `close(id)`. A banner that falls back to a toast gets the same wrap and `timeout: 0`,
  because banners never auto-dismiss. Two development warnings catch duplicate mounts: a second
  live channel subscriber (two NotificationProviders in sibling trees deliver every notification
  twice, `notifications/channel.ts`) and a second `BannerRegion` (every banner renders and is
  announced in each, `notifications/banners.ts`). StrictMode's replay triggers neither.
- **Banner icons are shared with toasts.** `notifications/severity.ts` exports `SEVERITY_ICON`,
  which `ToastList.tsx` and `BannerRegion.tsx` both read, so the two surfaces cannot drift.
- **A `banner()` raised before `BannerRegion` registers falls back to a toast.** The region
  registers in a layout effect (`components/Banner/BannerRegion.tsx`), so a banner raised from
  a *passive* mount effect is shown in the region, pinned by `BannerRegion.test.tsx` "shows a
  banner raised by a sibling mount effect without falling back". One raised from an earlier
  sibling's *layout* effect, before the region registers, takes the documented fallback to a
  toast, with its development warning (by construction in `Relay`; the fallback itself is
  pinned by "falls back to a toast, warning once, with no region").
- **Story names.** The plan's `Promise` story is `PromiseRejects`, because `Promise` shadows
  the global. There is no `ReducedMotion` story: no reduced-motion story has a precedent in
  this repo, and the motion tokens carry `reduced: 'opacity'`
  (`packages/motion/src/motions.ts:119-131`).

**Base UI facts the plan added.**

- **`toast.promise` errors keep the default priority and timeout.** On rejection the store
  updates the toast with `type: 'error'` and `timeout: errorOptions.timeout`
  (`toast/store.js:252-258`) and never sets `priority`, so the toast stays polite (the role
  follows priority, `toast/root/ToastRoot.js:420`). An unset `timeout` is `undefined`, and the
  store falls back to the provider's 5000 (`toast/store.js:184-187`). A raw rejected-promise
  toast would therefore auto-dismiss after five seconds and break ADR-0012's "errors never
  auto-dismiss". `toPromiseOptions` (`notifications/severity.ts`) forces the error branch
  through severity `error`, whatever the caller gave. Pinned by `severity.test.ts` "forces the
  error branch for an object, ignoring its severity and timeout" and the `PromiseRejects` story.
- **A string promise option becomes `{ description }`.** `resolvePromiseOptions` wraps a string,
  and a function's string result, as a description
  (`toast/utils/resolvePromiseOptions.js:8-11`, `:15-17`), so the toast would show no title.
  `toPromiseOptions` maps strings to `{ title }` itself. Pinned by `severity.test.ts` "maps a
  string to { title }, not a description".
- **Adding with an existing `id` updates in place and resets the timer**
  (`toast/store.js:124-137`). Adding with the id of a toast that is still ending removes it
  first (`:127-128`). So `id` dedupes, as §4.6.1 says. Pinned by `NotificationProvider.test.tsx`
  "updates in place when the id repeats".
- **Removal waits for `getAnimations()`.** The Root removes the toast when its animations
  finish (`toast/root/ToastRoot.js:106-114`, through `internals/useOpenChangeComplete.js:23-29`
  and `internals/useAnimationsFinished.js:45`). The ending state is `data-ending-style`, from
  `transitionStatus: 'ending'` (`toast/store.js:223-227`). Unlike 5e's collapsible nothing
  defers it, so exit motion keys on `[data-ending-style]`. Pinned by the `Motion` story.
- **`AlertDialog` is `Dialog` with three settings forced.** `AlertDialogRoot` is
  `useRenderDialogRoot('alert-dialog', …)` (`alert-dialog/root/AlertDialogRoot.js:16`), which
  sets `modal`, `disablePointerDismissal` and `role = 'alertdialog'`
  (`dialog/root/useRenderDialogRoot.js:32-35`). Its other parts are the Dialog parts
  (`alert-dialog/index.parts.js:6-40`), so our `DialogPopup`, `DialogTitle` and the rest work
  under it unchanged. Pinned by `DialogHost.test.tsx` "does not dismiss on an outside click".
- **The default initial focus is the first tabbable.** `DialogPopup` resolves an unset
  `initialFocus` to `createDefaultInitialFocus` (`dialog/popup/DialogPopup.js:59`), which
  returns `true` for a pointer or keyboard open (`utils/popups/popupStoreUtils.js:45-47`), and
  `FloatingFocusManager` turns `true` into the first tabbable element
  (`floating-ui-react/components/FloatingFocusManager.js:381-389`). Our footer is Cancel, then
  Confirm, so the default would focus Cancel in the default tone too. `DialogHost.tsx` passes
  `initialFocus` explicitly in every case: Cancel for `tone: 'danger'`, Confirm otherwise, OK
  for `alert`. Pinned by `DialogHost.test.tsx` "focuses Confirm by default (fails if
  initialFocus is omitted: Cancel is the first tabbable)" and "focuses Cancel when tone is
  danger".
- **Focus returns to the opener with no code.** `returnFocus` defaults to `true`
  (`FloatingFocusManager.js:124`), the previously focused element is recorded at `:365` and
  `:428`, and read at `:477-479`. Pinned by `DialogHost.test.tsx` "returns focus to the button
  that triggered confirm()" and the fixture e2e "a danger confirm focuses Cancel, Tab reaches
  Confirm, Enter resolves true and focus returns".

**`aria-hidden` traps for tests.** `ToastClose` is `aria-hidden` until the stack is expanded or
focused (`toast/close/ToastClose.js:49`), so a role query misses it. An unfocused high-priority
Root is `aria-hidden` (`toast/root/ToastRoot.js:425`), and the viewport renders a visually
hidden `role="alert"` copy of its `title` and `description`
(`toast/viewport/ToastViewport.js:220-231`). Tests find the close button by label
(`ToastParts.test.tsx` "names the close button from the dismiss message and removes the toast
on click"), and a high-priority Root by its attributes or `hidden: true` (the `PromiseRejects`
story; `NotificationProvider.test.tsx`).

**The `nativeButton` derivation needs an anchor test.** `ToastAction` and `ToastClose` derive
`nativeButton` from their `render`. A `<Button />` render cannot catch a dropped derivation,
because `Button` derives `true`, which is also Base UI's default. Only an `<a>` render pins it:
`ToastParts.test.tsx` "are non-native when the render is an anchor: role="button", no type, no
console.error (fails if the nativeButton derivation is dropped)".

**Motion is physical, and so is the swipe default.** `toast.slide-in` and `toast.slide-out`
animate a physical `translateX(100%)` (`packages/motion/src/motions.ts:119-131`), and §4.1.5
forbids adding motions. So only `*-end` in a left-to-right page, where the toast comes from
the edge it is docked to, uses them. `*-start`, `*-center` and every right-to-left page use
`enter.fade-rise` and `exit.fade` (`components/Toast/Toast.css.ts`). Exit is keyed on
`[data-ending-style]`. Swipe defaults to `['down', 'right']` (`toast/root/ToastRoot.js:50`),
so `swipeDirectionsFor` (`components/Toast/ToastParts.tsx`) sets it per placement and
direction. `ToastList` reads the page direction once, from the first Root's parent (the
viewport), because only the DOM knows it, and starts left-to-right so server and first client
render agree. Pinned by the `RightToLeft` story (the right-to-left toast sits at the physical
left edge and does not use `toast.slide-in`, a drag left sets `data-swipe-direction="left"`,
and with the page flipped to left-to-right `bottom-end` slides while `bottom-start` fades) and
the `Motion` story.

**Swipe.** A drag begins on `pointerdown` with `setPointerCapture` (`ToastRoot.js:227-271`), the
first `pointermove` re-bases the drag origin (`:280-288`), and the release dismisses when the
displacement passes `SWIPE_THRESHOLD = 40` (`:33`, `:210-217`). Observed in the `Swipe` story:
an 80px real pointer drag (`userEvent.setup()`, one instance, because pressed-button state does
not survive across `userEvent.pointer` calls) closes the toast, and a released 20px drag leaves
it open. While swiping, `--toast-swipe-movement-x/y` carry the offset (`:406-416`), so the entry
animation is held at `animation-duration: 0s`. Setting `animation: none` instead would restart
the entrance on release, and the story's `animationstart` counter fails it.

**Review Focus results.**

1. **A `toast()` from a page's own mount effect.** Confirmed, with the correction above: it is
   shown, because the relay subscribes in a layout effect. Pinned by the page-before-provider
   test in `NotificationProvider.test.tsx` and, as a regression pin, the fixture e2e.
2. **`toast.promise` that rejects.** Confirmed: the error toast is an `alertdialog`, persistent
   and titled. Pinned by `NotificationProvider.test.tsx` "makes a rejected toast.promise a
   titled, persistent alertdialog" and the `PromiseRejects` story.
3. **Two providers in one tree.** Confirmed: a nested `NotificationProvider` renders only its
   children, with a development warning (`NotificationProvider.tsx`, the `NotificationContext`
   check). Pinned by `NotificationProvider.test.tsx` "renders one toast, one pair of live
   regions and one warning when nested".
4. **`confirm()` twice, and unmounting with dialogs pending.** Confirmed: one dialog shows at a
   time, first-in-first-out, and every pending promise resolves `false` on a real unmount.
   Pinned by `DialogHost.test.tsx` "shows one dialog for two same-tick calls, then the second
   after the first closes" and "resolves every pending call false when the provider unmounts",
   and the `Queued` story. **StrictMode adds a case.** The unmount cleanup is deferred with
   `queueMicrotask` and cancelled by StrictMode's effect replay (`DialogHost.tsx`), so a
   mount-time `confirm()` is not resolved `false` in development, and only a real unmount
   resolves it. Pinned by `DialogHost.test.tsx` "keeps a mount-time confirm() alive under
   StrictMode". Under StrictMode a child's mount effect that calls `confirm()` raises two
   requests, because React replays the effect, and both are shown in turn.
5. **A `*-start` placement, or a right-to-left page.** Confirmed: see "Motion is physical"
   above. Pinned by the `RightToLeft` and `Motion` stories.

**Contrast (user decision, 2026-10-08).** Banner and toast pairings are in the contrast gate.
The severity container borders and the toast accent stripe are deliberately not asserted: they
are non-essential boundaries, and the severity is carried by the title, the role and the icon.
ADR-0008 records the principle (commit 095e419). Solving the brand focus ring against the
status subtle fills (commit 1847928) moved the light-mode ring from `#5a87e9` to `#5a86e9`, so
its ratio on the danger-subtle fill rose from 2.9983 to 3.03. Dark mode is unchanged.

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

### 5.5 Scope and API — settled 2026-10-08, before the plan

5g is **one plan and one PR**. The formatters and the hooks share no runtime code, but they
share the subpath plumbing, the gate changes and the ADR amendment, and splitting them
would review those twice.

#### 5.5.1 Surface and dependencies

- `packages/react/package.json` gains `./hooks` → `src/hooks/index.ts`, `./format` →
  `src/format/index.ts` and `./format/phone` → `src/format/phone.ts`.
- The main `.` entry keeps exactly what it exports today (`useHydrated`,
  `useIsomorphicLayoutEffect`, `useTheme`, `useColorScheme`), so nothing breaks. Every new
  hook and formatter is exported **only** from its subpath; the main entry does not grow,
  which is what gate 10's per-entry budgets assume. `./hooks` re-exports `useTheme`,
  `useColorScheme` and `useHydrated` so the catalogue is complete from one import.
- `@base-ui/utils` becomes an explicit dependency pinned to the version Base UI 1.7.0
  installs (`0.3.2`). `libphonenumber-js` becomes an optional peer and a dev dependency;
  only `format/phone.ts` imports it, from `libphonenumber-js/min`.
- **Two departures from the ADR-0012 catalogue**, both recorded as an amendment to it:
  - **`useFieldContext` is dropped.** Our `Field` has no context of its own, and Base UI
    exports its field context only under `internals`. A custom control joins a field
    through `Field.Control render={…}`, which already wires ids, labelling and validity.
    A hook over an unexported API, with no caller, buys nothing.
  - **`useFormatter()` is added** to `./hooks`. It is the one place `LocaleProvider` meets
    the formatters, and the one place the ADR's two-pass date rule is implemented (5.5.3).
    It does not include `formatPhone`, so `./hooks` never reaches `libphonenumber-js`.

#### 5.5.2 Formatters — `./format`

**Shape.** Every formatter is `fn(value, options)`. `options.locale` is **required**; date and
time functions also require `options.timeZone`, because an implicit host zone is exactly the
SSR bug ADR-0012 describes. Beyond those, options pass through to the native `Intl` options —
there is no parallel option vocabulary to learn. Nothing reads `Date.now()` or a zero-argument
`new Date()`; `formatRelative` takes an explicit `now`.

**Bad input never throws.** An invalid date, `NaN`, `null` or `undefined` returns `''`, so a
bad value in one table cell renders empty rather than taking the route down. In development
the formatter warns once per function with the offending value, so the empty string is not a
silent bug.

| Group | Functions and settled behaviour |
|---|---|
| Date/time | `formatDate`, `formatTime`, `formatDateTime`, `formatDateRange` wrap `Intl.DateTimeFormat`. `formatRelative(value, { now, locale })` auto-selects the unit (seconds → minutes → hours → days → weeks → months → years). `formatDuration({ hours, minutes, … }, { locale, style })` composes `Intl.NumberFormat` unit style with `Intl.ListFormat` (§5.2) |
| Number | `formatNumber`, `formatCurrency` (`currency` required), `formatPercent`, `formatCompact` (`notation: 'compact'`). `formatPercentChange` always signs (`+12.5%`, `-3%`) and returns `''` for a zero base. `formatOrdinal` uses the §5.2 suffix table. `formatBytes` is SI with localised units (§5.3) |
| Text | `formatName(record, { locale, form: 'display' \| 'initials' })` over `{ given, family, displayName?, order? }` (§5.3; particles are a documented limitation). `formatList`. `pluralize(count, forms, { locale })` selects from caller-supplied forms through `Intl.PluralRules`. `truncate(text, { locale, length })` counts grapheme clusters through `Intl.Segmenter`, so it never splits an emoji or a combining sequence |
| Address | `formatAddress(address, { locale, form: 'multiline' \| 'single' })` — the twelve-country template table plus a generic fallback (§5.3). The country line comes from `Intl.DisplayNames` and is **omitted when the address country is the reader's own region** (the locale's region subtag) |
| Sorting | `collator(locale, options?)` returns a comparator ready for `.sort()` |
| Masking | Deterministic, separator-preserving, no locale (plain string work, no `Intl`). `maskEmail` keeps the local part's first character and the whole domain. `maskPhone` and `maskCardNumber` keep the last four digits. `maskTaxId(value, country)` uses the table below |
| Phone (`./format/phone`) | `formatPhone(value, { format: 'national' \| 'international' \| 'E.164', defaultCountry? })`. Unparseable input returns the trimmed input unchanged — a number shown as typed beats a blank |

**`maskTaxId` country table.** Spec §5.3 requires each country's convention to be cited. The
twelve address countries were researched on 2026-10-08; only these carry a country rule:

| Country | Identifier | Rule | Source and strength |
|---|---|---|---|
| US | SSN, ITIN, ATIN, EIN | Mask the first five of nine digits, show the last four, keep the format: `***-**-1234`, EIN `**-***1234` | **Law.** 26 CFR 301.6109-4(a), truncated taxpayer identifying numbers: the number "in which the first five digits of the nine-digit number are replaced with Xs or asterisks" (<https://www.law.cornell.edu/cfr/text/26/301.6109-4>) |
| CA | SIN | Show the last three digits only, keep separators: `***-***-789` | **Official guidance by analogy, not a display regulation.** ESDC, *SIN fraud and data breaches* (page dated 2026-05-13) accepts "your full SIN or last 3 digits of your SIN" on police reports and credit documents (<https://www.canada.ca/en/employment-social-development/services/sin/fraud-data-breaches.html>). ESDC's *SIN Code of Practice* (<https://www.canada.ca/en/employment-social-development/services/sin/reports/code-of-practice.html>) was checked and covers storage and disposal only — no display rule |
| IN | Aadhaar | Mask the first eight digits, show the last four: `**** **** 1234` | **Regulation + guidance.** Aadhaar (Sharing of Information) Regulations 2016, reg. 6(1): the number "shall not be published, displayed or posted publicly", and 6(3) permits databases only where numbers are "redacted or blacked out" (<https://www.uidai.gov.in/images/The_Aadhaar_Sharing_of_information_regulation_2016.pdf>). The last-four format is UIDAI's "Masked Aadhaar" FAQ, read via search results only (the page returned 404 when fetched). The regulation gives no digit count |
| SG | NRIC, FIN | Last three digits plus the check letter: `*****567A` — which is the generic last-four rule on a nine-character NRIC, so no special case is coded; the row exists to cite that the fallback is compliant | **Guidance.** PDPC *Advisory Guidelines on the PDPA for NRIC and Other National Identification Numbers* (31 Aug 2018) para 5.2, and the PDPC Technical Guide ("masked NRIC number (only showing last three digits + last alphabet)"). A December 2024 notice says the guidelines will be updated |

**Uncited — generic last-four fallback:** GB (NINO, UTR), IE (PPSN), AU (TFN; the Privacy (TFN)
Rule 2015 covers handling, no display rule found), NZ (IRD number), DE (Steuer-ID), FR (NIR —
CNIL addresses use, not partial display), NL (BSN — enforcement is about not processing it),
JP (My Number — Art. 19 restricts provision; arguably it should not be displayed at all), and
India's PAN. The fallback shows the last four characters and masks every other alphanumeric,
keeping separators. A country is added to the table only with a source.

The mask character is always `*`. Note what the table does and does not change: US, IN and
SG all coincide with the generic last-four rule, so their rows are citations that the
fallback is compliant; **CA is the only country whose output differs** (last three, so the
middle group of a 3-3-3 SIN is never partly shown).

#### 5.5.3 Hooks — `./hooks`

| Group | Hooks and settled behaviour |
|---|---|
| SSR | `useIsomorphicLayoutEffect`, `useHydrated` (exist). `useMediaQuery(query, ssrDefault)` on `useSyncExternalStore`; `ssrDefault` is **required** |
| State | `useControllableState({ value, defaultValue, onChange })` → `[value, setValue]`, on `useControlled` + `useStableCallback` from `@base-ui/utils`; `onChange` fires only on an actual change. `useDisclosure({ open?, defaultOpen?, onOpenChange? })` → `{ open, setOpen, onOpen, onClose, onToggle }`. `useToggle(initial)` → `[value, toggle, set]`. `usePrevious` wraps `usePreviousValue`. `useDebouncedValue(value, ms)` on `useTimeout` |
| DOM | Every hook takes a ref or a target and attaches only in an effect. `useClickOutside(ref, handler)` listens for `pointerdown` on the ref's `ownerDocument` and tests `composedPath()`, so it works across shadow roots. `useResizeObserver(ref)` → `{ width, height } \| undefined`. `useIntersectionObserver(ref, options)` → latest entry or `undefined`. `useEventListener(target, type, handler, options)` calls the latest handler and re-subscribes only when target, type or options change. `useCopyToClipboard({ resetMs = 2000 })` → `[copied, copy]`; `copy` resolves `false` rather than throwing when the clipboard is unavailable or denied |
| Theme | `useTheme`, `useColorScheme` (re-exported). `useReducedMotion()` is `useMediaQuery('(prefers-reduced-motion: reduce)', false)`, for JS-driven motion only |
| A11y | `useAnnounce()` returns 5f's `announce`, stable across renders; it must be used inside `NotificationProvider`, like every surface. `useFocusReturn(active)` records the focused element when `active` turns true and restores it when `active` turns false or on unmount, if that element is still connected |
| Storage | `useLocalStorage(key, default)`, `useSessionStorage(key, default)` → `[value, setValue, remove]`. JSON-serialised; a parse failure returns the default and warns in development. `useSyncExternalStore` with `default` as the server snapshot, subscribed to the `storage` event and a same-tab emitter. A write that fails (quota, blocked storage) degrades to in-memory for the session and does not throw |
| Locale | `useFormatter()` returns the `./format` functions bound to `LocaleProvider`'s `locale`, `currency` and `timeZone`; per-call options still override. With `timeZone` unset, date functions format in **UTC** on the server and on the first client pass, then in `Intl.DateTimeFormat().resolvedOptions().timeZone` after hydration — ADR-0012's two-pass rule. `isoFor(value)` supplies the `<time dateTime>` attribute |

Per §4.1.6, most of these have no in-repo caller; their tests are their only consumer.

#### 5.5.4 Gates and tests

- **SSR-safety gate:** named exemptions for `hooks/useMediaQuery.ts` (`matchMedia`) and
  `hooks/useStorage.ts` (`localStorage`, `sessionStorage`). Each is paired with a narrower
  assertion in the `useIsomorphicLayoutEffect` pattern — the banned name appears only inside
  the subscribe and snapshot functions — and each exemption is asserted to still exist. DOM
  hooks reach the document through `ownerDocument` or a caller-supplied target and need no
  exemption.
- **`use-client` gate:** a named exemption for `src/format/**` (pure functions, no React
  import), itself asserted.
- **New gate — formatters are deterministic** (§7 row 14): under `src/format`, no
  `Date.now()`, no zero-argument `new Date()`, no `react` import.
- **New gate — phone isolation:** `libphonenumber-js` is imported only by `format/phone.ts`,
  and is unreachable from `format/index.ts` and `hooks/index.ts` by walking their import
  graphs, not by scanning one file.
- **Package shape:** the three subpaths exist and resolve; `libphonenumber-js` is an optional
  peer; `@base-ui/utils` is pinned to Base UI's own version.
- **Formatter tests** run at fixed locales (en-US, en-GB, de-DE, fr-FR, ja-JP and one RTL
  locale) with explicit time zones, each with a named perturbation. CI's Node 22.22.0 is the
  reference runtime; any assertion that depends on ICU data version is identified and pinned
  to output stable across Node 22 and 24.
- **Hook tests** in jsdom, plus `.ssr.test.tsx` renders for every hook with a server default
  (media query, reduced motion, storage, `useFormatter`'s dates). `useFormatter` gets an
  SSR-then-hydrate test proving no hydration warning and the post-hydration swap.
- **No stories** — these are not components. **No showcase route** in this phase.

### 5.6 Verified during the plan

Checked on 2026-10-08 on Node 22.22.0 (ICU 77.1) and Node 24.19.0 (ICU 78.3), and against
the code as built. §5.5 is left as written, except that §5.5.2's `formatPercentChange`
example read `−3%` and now reads `-3%`: ICU emits a hyphen-minus there, not U+2212. Paths
are relative to `packages/react/src/` unless they start with `node_modules/`.

**Facts the plan relied on.**

1. Every `Intl` output pinned in the format tests, except `formatPhone`'s (which depend on
   `libphonenumber-js` metadata), is byte-identical on Node 22.22.0 and Node 24.19.0, so the
   tables are asserted exactly.
2. One divergence: `de-DE` `unitDisplay: 'narrow'` hours are `"2 Std."` on ICU 77.1 and
   `"2h"` on ICU 78.3. No test asserts a narrow duration or unit in `de-DE`, and
   `formatDuration`'s default style is `'short'`.
3. `Intl.DurationFormat` is `undefined` on Node 22.22.0 and a function on Node 24.19.0. This
   is why §5.2 composes and never feature-detects; a test asserts the composed path is used
   even where the native API exists.
4. An invalid locale (`'xx_YY'`), an invalid time zone (`'Mars/Base'`) and an invalid `Date`
   all make `Intl` throw `RangeError`. "Bad input never throws" (§5.5.2) therefore means every
   formatter catches (the shared `guard` in `format/`).
5. `new Intl.NumberFormat('en-US', { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 1 }).format(999.95)`
   is `"1,000 kB"`. `formatBytes` steps up a unit after rounding, so `999_950` bytes is `"1 MB"`.
6. The `en-US` short form of the `byte` unit is singular (`"512 byte"`); the long form is
   plural-correct. `formatBytes` formats `byte` with `unitDisplay: 'long'` and every larger
   unit with `'short'`.
7. `@base-ui/utils` 0.3.2 exports `./useControlled`, `./useStableCallback`,
   `./usePreviousValue`, `./useTimeout`, `./useValueAsRef` and `./owner`
   (`node_modules/@base-ui/utils/package.json`). `useControlled` returns
   `[value, setValueIfUncontrolled]` and never calls a change handler
   (`useControlled.mjs:4-42`), so `useControllableState` calls `onChange` itself.
   `usePreviousValue` returns the previous distinct value, `null` before the first change
   (`usePreviousValue.mjs:9-20`), so `usePrevious` returns `T | null`. `useStableCallback`
   throws if called during render (`useStableCallback.d.ts`).
8. `ownerDocument(null)` returns the global document (`node_modules/@base-ui/utils/owner.mjs:2-4`),
   so `useFocusReturn` and `useClickOutside` never name the global and need no SSR-safety
   exemption.
9. `NotificationContext` was private to `notifications/NotificationProvider.tsx`, which also
   imports the Toast parts and their CSS. `useAnnounce` importing it would have pulled Toast's
   CSS into every `./hooks` consumer (gate 10, §6.1), so the context moved to
   `notifications/context.ts`. The phone-isolation gate asserts `./hooks` does not reach
   `NotificationProvider.tsx`.
10. `useHydrated` flips in a passive effect (`hooks/useHydrated.ts:14-18`), so it is `false`
    on the first render of every mount, client-only mounts included. `useFormatter` would
    flash UTC on every client-side navigation if it used it, so it uses
    `useSyncExternalStore(noop, () => true, () => false)`, which is `false` only while
    hydrating (`hooks/useFormatter.ts`).
11. `new Date('2026-03-05')` (date-only ISO) is UTC midnight and
    `new Date('2026-03-05T14:30:00Z')` parses exactly, so formatters accept
    `Date | number | string` and parse strings with `new Date(string)`.
12. `new Intl.Locale('en').maximize().region` is `'US'`, `'he'` gives `'IL'` and `'ja'` gives
    `'JP'`, so `formatAddress` derives the reader's region from the maximised locale.

**Found while building.**

- **`timeZoneName` is a component option.** `formatDate`, `formatTime` and the other date
  formatters apply their style defaults only when the caller named no component option, and
  `timeZoneName` is on that list (`COMPONENT_KEYS` in `format/date.ts`). Intl throws
  `TypeError` for `timeStyle` beside `timeZoneName`, so passing `timeZoneName` has to disable
  the default style. `hour12` and `hourCycle` combine with a style and are not on the list.
- **`formatName` and `displayName`.** When `displayName` is present, both the display form
  and the initials come from it (§5.3, "displayName wins"; `format/text.ts`).
- **`formatPhone` and an unknown default country.** `libphonenumber-js` 1.13.13 does not
  throw for `defaultCountry: 'XX'`. A `+`-prefixed number parses regardless of it, and a
  national number returns `undefined`, so `formatPhone` returns the trimmed input
  (`format/phone.ts`). The code also catches a throw and retries without a country, in case a
  later version does throw.
- **`useClickOutside` and a conditional target.** It attaches whenever `enabled`, on the
  owner document of the ref (the global one while the ref is empty), and reads the ref at
  event time, so a target rendered conditionally works without toggling `enabled`
  (`hooks/useClickOutside.ts`). `useEventListener` (ref form), `useResizeObserver` and
  `useIntersectionObserver` instead need the ref attached when their effect runs; each says
  so in its doc comment.
- **`useFocusReturn` records in a layout effect**, so a child's passive-effect focus move is
  not recorded as the element to return to. `autoFocus` is not supported: it runs at commit,
  before any layout effect, and the doc comment states that contract (`hooks/useFocusReturn.ts`).
- **Storage hooks.** The parse is memoised on the raw string only, so the value's identity is
  stable even when the caller passes an inline literal default. A failed write keeps the
  value in memory for the session (`hooks/useStorage.ts`).
- **Hydration errors in React 19.** Recoverable hydration errors reach `hydrateRoot`'s
  `onRecoverableError`, and not reliably `console.error`, so the hydration tests assert both
  (`hooks/useFormatter.test.tsx`).
- **The phone-isolation gate fails on any relative import it cannot resolve**, so a resolver
  bug cannot make it pass because the walk silently stopped early (the `unresolved` check in
  the gate under `gates/`).

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

### 6.3 Plan 5h — scope and API, settled 2026-10-10, before the plan

5h is **one plan and one PR**. It closes Phase 5.

**What changed since §2 was written.** 5b–5f each added their own fixture route and showcase
page, and 5g added the `./format` and `./hooks` imports to the consumer fixture. So "fixture
and showcase pages for every new component" is already done, except for the streamed route
(§6.3.3). In its place, 5h takes on the Tooltip flake, which would otherwise make gate 9
flaky, and the cheap open follow-ups (§6.3.4).

#### 6.3.1 Gate 10 — `npm run size`

- **Mechanism.** `scripts/size.ts` (run with `tsx`) writes a one-line virtual entry for each
  check and calls `vite.build()` on it with:
  - `configFile: false` and `plugins: [apComponents()]`, which is `@ap/vite`, the real
    consumer plugin;
  - `react`, `react-dom`, `react/jsx-runtime` and `libphonenumber-js` marked external;
  - minified output and `write: false`.

  The script then brotli-compresses the JS outputs and the CSS outputs **separately** with
  `node:zlib`.
- **Checks.**
  - `index` (`export * from '@ap/react'`), `hooks` and `format`.
  - `format/phone`, measured with `libphonenumber-js` external. It is an optional peer, so
    the number is our wrapper alone, and the report says so.
  - One `import:<Name>` per directory in `packages/react/src/components/`, so a new
    component is covered with no edit. The script fails, naming the directory, if a
    directory's name is not a value export of the index.
- **Budgets** live in `packages/react/size-budget.json`, shaped
  `{ "<check>": { "js": <bytes>, "css": <bytes> } }`.
  - The first ceilings are each measured size plus 10%, rounded up to the next 100 B.
  - A check with no budget entry counts as a breach, so a new component forces someone to
    choose its budget.
- **Tree-shaking proof.** Every `import:<Name>` must have JS ≤ 50% of `index` JS. If side
  effects drag the library in, every single import comes out close to 100%. The plan's
  facts table confirms the 50% tripwire against the measured numbers before fixing it. If a
  legitimate component exceeds it, the threshold question goes back to the user rather than
  being raised silently.
- **Output.**
  - A markdown table (check, JS, CSS, budget, ratio, status) is written to `reports/size.md`
    and appended to `$GITHUB_STEP_SUMMARY` when that variable is set.
  - Exit code 1 on any breach.
- **CI.** A new `size` job runs on pull requests and on `main`. The size step sets
  `continue-on-error: true`, which keeps it advisory (ADR-0014's "warns on regression"), and
  it uploads `reports/size.md` as an artifact.
- **Tests.**
  - The pure parts (budget comparison, the ratio check, rendering the table) get unit
    tests.
  - Perturbations:
    - `"sideEffects": true` in `packages/react/package.json` must push `import:Button` past
      the ratio;
    - lowering one budget by 1 byte must report a breach;
    - deleting one budget entry must report a breach.

#### 6.3.2 Gate 9 — `npm run test:visual`

- **Location.** `storybook/visual/`, with its own `playwright.config.ts` in the storybook
  workspace. `@playwright/test` is added there at the fixtures' `^1.62.1`. Every lockfile
  that installs the workspace is refreshed (5g's lesson).
- **Server.** Playwright's `webServer` runs
  `vite preview --outDir storybook-static --port 6007 --strictPort`. This adds no
  dependency. `STORYBOOK_BASE_PATH` is unset, so the build is served from `/` (§3.5).
- **Enumeration.** A single spec file reads `storybook-static/index.json` and generates one
  test for each entry whose `type` is `'story'`. Docs entries are ignored.
- **Projects.** Two projects, `light` and `dark`.
  - Both use viewport 1024×768, `deviceScaleFactor: 1` and `reducedMotion: 'reduce'`.
  - They differ only in `colorScheme`.
  - Dark comes from emulation alone, because `theme.css` already switches on
    `prefers-color-scheme`.
- **When to shoot: after `play` finishes.** 119 of 126 stories have `play` functions, and
  their end states (open popups, invalid fields, toasts) are where visual regressions live.
  Each test:
  1. opens `iframe.html?id=<id>&viewMode=story`;
  2. polls `window.__STORYBOOK_PREVIEW__.currentRender.phase` until it reads `'completed'`;
  3. fails immediately, naming the phase, on `'errored'` or `'aborted'`;
  4. awaits `document.fonts.ready`;
  5. calls `expect(page).toHaveScreenshot('<id>.png', { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 })`.

  The phase names were checked in Storybook 10.6's `dist/preview/runtime.js`. The screenshot
  is of the **viewport**, not `#storybook-root`, because popups, toasts and dialogs are
  portalled to `body`.
- **Opt-out.** A story may set `parameters.visual = { skip: '<reason>' }`, and the reason is
  required. Skipped stories are listed in the job summary. The plan names every story that
  opts out and why; an implementer does not decide this alone.
- **Linux only.** `snapshotPathTemplate` is `'{testDir}/__screenshots__/{projectName}/{arg}{ext}'`,
  with no platform suffix (§6.2). Every test calls
  `test.skip(process.platform !== 'linux', 'Baselines are Linux-only (spec §6.2)')`.
- **Baselines.** A new `workflow_dispatch` workflow, `visual-baselines.yml`, takes a `branch`
  input. It:
  - checks that branch out;
  - builds Storybook;
  - runs `test:visual -- --update-snapshots`;
  - commits `storybook/visual/__screenshots__` back to the branch, with
    `permissions: contents: write`.

  CONTRIBUTING documents local generation through the
  `mcr.microsoft.com/playwright:v<version>-noble` image as a convenience, not a
  requirement.
- **CI.** New steps in the existing `storybook` job, which reuse the build it already
  produces.
  - They run only on pull requests (`if: github.event_name == 'pull_request'`), and the step
    sets `continue-on-error: true`.
  - When the step fails, actual, expected and diff images are uploaded as an artifact.
  - The job summary states the count of diffs and of skipped stories. When no baselines
    exist, it says to run the Visual baselines workflow on the branch.

#### 6.3.3 The streamed route

- `fixtures/ssr-app/app/routes/streamed.tsx` gains `Select`, `Tabs`, `Accordion`, `Checkbox`,
  `Switch`, `RadioGroup` and `Textarea`, inside the existing deferred `<Await>`.
  - These are the components whose server markup carries real state, which a second-chunk
    mismatch would break first.
  - Tooltip, Popover and Toast are left out: their popups are absent server-side, so
    streaming them proves nothing about the popups.
- Gate 6 asserts that each component's state-bearing markup appears in the response
  **after** `loading…`. The markup checked is:
  - Select's selected item text;
  - the selected tab's `aria-selected="true"`;
  - the open Accordion panel;
  - the checked state of each checkbox, switch and radio.
- The hydration spec covers `/streamed` with zero recoverable errors. The plan checks that
  it watches `onRecoverableError` and not only the console (5g's lesson).

#### 6.3.4 The Tooltip flake and the cheap follow-ups

**Tooltip `TwoOpen`** (`Tooltip.stories.tsx`).
- The fixed 500 ms sleep becomes
  `waitFor(() => expect(body().queryAllByRole('tooltip')).toHaveLength(1), { timeout: 3000 })`,
  followed by the text assertion.
- Perturbation: pin the first tooltip open, and the story must still fail.

| # | Item | Kind |
|---|---|---|
| F1 | Notification option types (`notifications/types.ts`, `NotificationProvider`'s `placement`) declare optionals as `?: T \| undefined` | Types; consumer typecheck |
| F2 | RadioGroup `invalid` JSDoc (5b): verify the existing doc covers it and record it closed | Doc, if anything |
| F3 | Address templates for AU, NZ, IE, IN, SG, NL and CA, and JP's single-line form | Tests |
| F4 | `maskPhone` keeps the last four digits **of the main number**. An extension (after `ext`, `x`, `#` or `;ext=`, case-insensitive) is masked in full and never counts toward the four | Fix + tests |
| F5 | The storage `clear()` branch (`StorageEvent` with a `null` key) | Test |
| F6 | Unmounting `useCopyToClipboard` during its reset sets no state and leaves no timer | Test |
| F7 | The hydration-pass `timeZone: undefined` case, with a non-UTC zone forced so it cannot pass vacuously on a UTC host | Test |
| F8 | The `timeZoneName`-alone test asserts the exact string | Test |
| F9 | `useIntersectionObserver` resets a stale entry to `null` when its observer is rebuilt | Fix + test |
| F10 | The SSR gate's AST check catches a storage read helper called through a local alias | Gate + perturbation |
| F11 | `useEventListener`'s typing is tightened and the `defined()` casts are removed | Refactor; typecheck |
| F12 | `useControllableState`'s JSDoc states that it cannot hold a function-typed value | Doc |

**Still deferred:**
- the date-only ISO default;
- the focus ring against `bg-raised`;
- underline vs hairline;
- Switch `[data-invalid]`;
- `:dir()`;
- the Tooltip and Popover width caps.

Each is a design or product call, not cheap work.

#### 6.3.5 Order, sweep and proof

**Task order:**
1. F1–F12 and the Tooltip flake, so gate 9's baselines are taken on a stable tree.
2. The streamed route.
3. Gate 10.
4. Gate 9.
5. One whole-branch review and fix wave, before the CI sweep.

**The local sweep** runs every `ci.yml` job and records its counts:
- unit tests, also on Node 22.22.0;
- gates;
- `check:lockfiles`;
- consumer;
- SSR, SPA and hydration;
- stories and the Storybook build;
- showcase;
- `size`.

`test:visual` is skipped locally by design.

**The PR sequence:**
1. Open the PR. Gates 1–8 are green, gate 10 reports, and gate 9 reports that there are no
   baselines.
2. Run Visual baselines on the branch.
3. The re-run reports zero diffs.
4. A throwaway commit changes one token colour. Gate 9 must report diffs with images.
5. Revert the throwaway commit.

**Proof artifact** (§7, made concrete): the PR's CI run, plus `reports/contrast.md` and
`reports/size.md` from it. The run must show:
- gates 1–8 green;
- gate 9 clean against committed baselines;
- gate 10's summary table.

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
