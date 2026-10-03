# Phase 5c — Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `Select` (single and multiple selection, grouped items, object values) as a convenience component over public compound parts. The selected label must be in server HTML, the trigger must be named in server HTML, the hidden input(s) must post before hydration, and the listbox must follow a predictable bottom placement. Alongside it, bring `Switch` onto the shared control-state token contract.

**Architecture:** `SelectParts.tsx` holds thin styled wrappers over `@base-ui/react@1.7.0`'s Select parts, the `Field` pattern. `Select.Popup` bundles Portal, Positioner and Popup with our positioning defaults. `Select.tsx` is the convenience component. It is built only from those parts plus pure helpers in `selectItems.ts`, which cover serialisation, equality, label lookup and locale list formatting. `Field` learns one protocol: a child carrying the internal non-native-label marker gets a `<div>` label with an explicit id, and that id is passed to the child as `aria-labelledby`.

**Tech Stack:** React 19.2, `@base-ui/react` 1.7.0, vanilla-extract, Vitest 4.1.11 (projects `unit` and `storybook`), Storybook 10.6, Playwright 1.62.1, React Router 8 (the SSR fixture).

**Spec:** `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md`. Read §4.1 (all ten shared decisions, including **§4.1.10, the control-state token contract**) and §4.3–§4.3.3 (this plan's scope). Read the "What actually happened" section of `docs/superpowers/plans/2026-09-06-phase5b-form-controls.md` before starting any task.

**How this plan is written, deliberately:** 5b's plan embedded long literal code that had never been typechecked, and it was wrong in nine places while its surrounding prose was right. This plan instead **states each rule and cites the precedent file that already follows it.** Code appears only where it is short and is itself the contract: type signatures, a marker, a test's exact assertion. Where a step says "match `X.css.ts:NN`", reading that file is part of the step. A deviation from a cited precedent is a review finding unless the step says otherwise.

## Global Constraints

- **Node 22.22.0** in CI. `engines.node` is `>=22.22.0`.
- **`'use client'` is the literal first line** of every `.ts`/`.tsx` under `packages/react/src`, except `index.ts` barrels, `*.css.ts`, and files in `use-client.gate.test.ts`'s `TS_EXEMPTIONS`. **Every new `*.tokens.ts` gets a `TS_EXEMPTIONS` entry** in the `join(SRC, 'components', '<Name>', '<Name>.tokens.ts')` form (see `docs/CONTRIBUTING.md`, "Adding a component").
- **Relative imports carry `.js`**, even from `.tsx`. The package is `NodeNext`.
- **Every style declaration sits inside `'@layer': { [componentsLayer]: { … } }`.** State rules go in `selectors: { … }` with `&`-prefixed keys (`Input.css.ts:31`). `boxSizing: 'border-box'` goes in every recipe base (`Input.css.ts:22`).
- **No physical CSS properties, no Tier 1 tokens, no literal `zIndex`, no suppressed outline, no `boxShadow` in `:focus-visible`.** Durations are tokens. A forbidden literal inside a comment also fails the style gate, so hyphenate it.
- **Tier 3 tokens are `tier3('<component>-<role>', <vars.* fallback>)`**, and every form control follows **spec §4.1.10**.
- **Every user-facing string is a message key or consumer-supplied.** The gate scans `aria-label`, `title`, `placeholder`, `alt`, `label`, `hint`, `error` and all JSX text.
- **`exactOptionalPropertyTypes` is on, and Base UI's prop merge lets an explicit `undefined` win.** Spread optionals conditionally: `{...(x !== undefined ? { x } : {})}`. Never write `prop={undefined}`.
- **There is no jest-dom.** No `toHaveAttribute`. Use `el.getAttribute(…)`. `RegExp.exec` returns `null`, so guard it with `.not.toBeNull()`, not `.toBeDefined()`.
- **Base UI defers some DOM updates to a microtask** (`useCompositeRoot.js:195`). Keyboard and focus assertions use `await waitFor(…)`.
- **No dependency may be added. Never run a snapshot-update flag. Conventional commits, one or more per task.**
- **Every assertion names the change that must make it fail.** When a step lists a perturbation, apply it once, watch the test fail, and revert. If you cannot name one, the assertion is decoration: rewrite it.

## Base UI facts established before writing this plan

Verified by reading `node_modules/@base-ui/react/select/**` and by server-rendering Base UI's Select directly on 2026-09-26 (a scratch `renderToString` probe, not committed). Each fact changes what a task must do.

| Fact | Consequence |
|---|---|
| `Select.Root` renders its hidden `<input>` **inline**, as a sibling of its children, never portalled. With `name` set, it carries `name` and the serialised value, is `aria-hidden`, has `tabIndex=-1` and is visually hidden (`root/SelectRoot.js:400-452`) | Uncontrolled single-select posts before hydration with nothing extra from us |
| With `multiple`, the named input becomes **one `<input type="hidden" name=… value=…>` per selected value**, plus the visually hidden unnamed input (which gets id `<rootId>-hidden-input`) | Gate 6 asserts N `type="hidden"` inputs for a multi-select |
| `Select.Portal` renders nothing unless `mounted \|\| forceMount`. `forceMount` is set on trigger focus or autofill, never on the server (`portal/SelectPortal.js`, `trigger/SelectTrigger.js:145-149`) | Popup is absent from server HTML (§4.1.9). Never set `keepMounted` |
| **The trigger has no `aria-labelledby` in server HTML.** Its value comes from the label id registered in an effect (`useRegisteredLabelId`). A native `<label for>` still names the button by association in SSR, but the `<div>` label §4.3.2 requires names nothing until hydration | **Confirmed.** The fix is R16's (below). Probe: passing `id="lbl"` to `Field.Label` and `aria-labelledby="lbl"` to `Select.Trigger` produced `<div id="lbl">` and `aria-labelledby="lbl"` in server HTML |
| `Field.Label` with `nativeLabel={false}` **still renders `<label>`** unless it is also given `render={<div />}`, and warns in development (`field/label/FieldLabel.js:54-64`) | The Field protocol sets both, always together |
| `Select.Trigger` defaults `nativeButton = true` and hard-sets `role="combobox"` after merging (`trigger/SelectTrigger.js:51,197`) | Deriving `nativeButton` from `render` matters only when a consumer passes `render`, and that is exactly §4.1.1's case |
| `Select.Positioner` defaults **`alignItemWithTrigger = true`**, which ignores `side` and `align` and is skipped on touch (`positioner/SelectPositioner.js:55,84`) | `Select.Popup` passes `alignItemWithTrigger={false}` |
| Positioner CSS variables: `--anchor-width`, `--available-height`, `--transform-origin` | Popup `min-inline-size: var(--anchor-width)`, `max-block-size: var(--available-height)` |
| **An object `defaultValue` rebuilt as a new object renders as JSON in the trigger**, even with `items` and `itemToStringValue` supplied. `resolveSelectedLabel` matches objects only by a `.value` key or identity (`internals/resolveValueLabel.js:69-104`). Probe output: `<span>{&quot;code&quot;:&quot;ca&quot;…}</span>` | The convenience component does **not** rely on Base UI's label resolution. It renders `Select.Value` with a children function that looks up the label by serialised value |
| Base UI joins multiple labels with a hardcoded `', '` (`resolveValueLabel.js:109-117`) | The same children function formats the list with `Intl.ListFormat` |
| `Select.ItemIndicator` unmounts when its item is unselected unless `keepMounted` | Style the unselected state on the item, not on the indicator |
| `Select.Label` exists, but labels only through the select store, not Field's labelable context | Not used. `Field` owns labelling, per §4.3.2 |
| `@ap/tokens` does **not** export its `SPACE` scale from `index.ts` (it lives in `scales/scales.ts:7`, values in px strings) | Task 1 exports it, and the positioner offset is derived from it, never a literal |

**R16, for reference** (5b plan, "Deviations"): RadioGroup's legend id is generated with `useId` and passed to both ends, because Base UI's effect-registered id is missing from server HTML. Its rationale was later corrected, and the corrected version is the one to copy. **It buys a named control in streamed and pre-hydration markup for assistive technology. It does not make the control operable with JavaScript off.** Say exactly that wherever this plan repeats the move.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/tokens/src/index.ts` | Export `SPACE` |
| `packages/react/src/internal/deriveNativeButton.ts` (+ `.test.ts`) | The derivation moved out of `Button.tsx`, shared by every button-like part (§4.1.1) |
| `packages/react/src/internal/positioner.ts` (+ `.test.ts`) | `POSITIONER_SIDE_OFFSET`, the shared numeric default from `SPACE` (§4.1.7), reused by 5d |
| `packages/react/src/components/Button/Button.tsx` | Imports the moved helper; behaviour unchanged |
| `packages/react/src/components/Field/nonNativeLabel.ts` | The internal marker and its detector |
| `packages/react/src/components/Field/Field.tsx` (+ tests) | Detects the marker; `<div>` label, explicit id, `aria-labelledby` to the child |
| `packages/react/src/components/Select/selectItems.ts` (+ `.test.ts`) | Pure helpers: flatten, serialise, default equality, label lookup, list format |
| `packages/react/src/components/Select/Select.tokens.ts` | Tier 3 surface on the §4.1.10 contract, plus popup and item roles |
| `packages/react/src/components/Select/Select.css.ts` | Trigger recipe (`size`), value, icon, popup, list, item, indicator, group label, separator |
| `packages/react/src/components/Select/SelectParts.tsx` (+ `SelectParts.test.tsx`) | The compound parts |
| `packages/react/src/components/Select/Select.tsx` (+ `Select.test.tsx`, `Select.ssr.test.tsx`) | Convenience component, marker, namespace assignment |
| `packages/react/src/components/Select/Select.stories.tsx` | Stories and `play` |
| `packages/react/src/components/Select/index.ts` | Barrel |
| `packages/react/src/index.ts` | Exports, value then type, after `RadioGroup` |
| `packages/react/src/gates/use-client.gate.test.ts` | One `TS_EXEMPTIONS` entry for `Select.tokens.ts` |
| `packages/react/src/components/Switch/{Switch.tokens.ts,Switch.css.ts,Switch.test.tsx,Switch.stories.tsx}` | §4.1.10 roles and the `[data-invalid]` rule |
| `packages/react/src/components/RadioGroup/RadioGroup.tsx` | JSDoc on `invalid` |
| `fixtures/ssr-app/app/routes/form.tsx`, `packages/react/src/gates/ssr-render.gate.test.ts`, `fixtures/ssr-app/e2e/progressive-enhancement.spec.ts` | Two Selects join the pre-hydration post proof |
| `showcase/app/sections.ts`, `showcase/app/routes/select.tsx` | SSR smoke section |
| `docs/CONTRIBUTING.md`, spec §4.3.3 | Traps found, the Field protocol, verified facts |

---

## Review Focus

These five inputs are implied by the spec, not exercised by any obvious test, and most likely to bite a real user. Each one has its test assigned to the task that owns the code.

1. **A consumer sets `name` on the wrapping `Field` as well as on `Select`.** `Field.Root`'s `name` silently overrides the control's own (5b fact). Expect the fixture and stories never to do it, and the Select JSDoc to say so. Pinned in Task 5 (JSDoc) and Task 7 (the fixture uses one `name`).
2. **A `Select` that also has its own `aria-labelledby` inside a `Field`.** Expect the consumer's value to win, and Field not to clobber it. Pinned in Task 2.
3. **A multi-select with zero values selected, submitted.** Expect no field in the post at all (not an empty string), and the placeholder in the trigger. Pinned in Task 4 (SSR) and Task 7 (gate).
4. **An object-valued Select whose `defaultValue` matches no item.** Expect an empty trigger showing the placeholder, not JSON. Pinned in Task 3 (helper) and Task 5 (component).
5. **Playwright label collisions in the fixture.** The visually hidden `<input>` Select renders is labelable to `getByLabel` unless it is `type="hidden"`. Expect the fixture's copy never to collide with the email field's `getByLabel('Email')`. Pinned in Task 7, which runs `test:hydration` itself.

---

### Task 1: Shared internals: `deriveNativeButton` and the positioner offset

**Files:**
- Create: `packages/react/src/internal/deriveNativeButton.ts`, `packages/react/src/internal/deriveNativeButton.test.ts`, `packages/react/src/internal/positioner.ts`, `packages/react/src/internal/positioner.test.ts`
- Modify: `packages/react/src/components/Button/Button.tsx:28-52`, `packages/tokens/src/index.ts`

**Interfaces:**
- Produces: `deriveNativeButton(render: unknown): boolean`, with the same semantics as today's private function. It returns `true` for `undefined`, `false` for a function, and `render.type === 'button'` for an element. Accept the widest type that lets every Base UI part's `render` prop pass without a cast; `Button.tsx`'s signature is the reference.
- Produces: `POSITIONER_SIDE_OFFSET: number`, which is `SPACE['2']` parsed to a number (4).

- [ ] **Step 1: Write the failing helper tests.** Cover four cases: `undefined → true`, `<button /> → true`, `<a href="#" /> → false`, and a render function `→ false`. Perturbation: swap the `undefined` branch to `false` and one case must fail. For the offset, assert it equals `Number.parseFloat(SPACE['2'])` and is a finite number. The perturbation for this test is exporting a hardcoded `4` while `SPACE['2']` is temporarily changed in a scratch edit. The helper must fail to follow it. Revert the scratch edit.
- [ ] **Step 2: Run them and watch them fail.** `npx vitest run --project unit packages/react/src/internal`. Expected: fail on the unresolved import.
- [ ] **Step 3: Move the function.** Move it with its full doc comment. `Button.tsx:28-47` says not to delete that reasoning, so it travels with the code, and `Button.tsx` keeps a one-line pointer. Add `'use client'`. Export `SPACE` from `packages/tokens/src/index.ts` beside `DURATION`. If `packages/tokens/src/index.test.ts` pins the export list, update it in the same commit. Write `positioner.ts` with a comment citing §4.1.7. The comment also notes that the offset is a build-time number, so a theme that overrides `--ap-space-2` does not move it.
- [ ] **Step 4: Run the tests and the Button suite.** `npx vitest run --project unit packages/react/src/internal packages/react/src/components/Button && npm run typecheck && npm run test:guards`. Expected: pass. Button's existing `deriveNativeButton` perturbation tests (`Button.test.tsx:96,159`) still guard the behaviour.
- [ ] **Step 5: Commit.** `refactor(react): share deriveNativeButton and a token-derived positioner offset`.

---

### Task 2: `Field`'s non-native-label protocol

**Files:**
- Create: `packages/react/src/components/Field/nonNativeLabel.ts`
- Modify: `packages/react/src/components/Field/Field.tsx`, `packages/react/src/components/Field/Field.test.tsx`

**Interfaces:**
- Produces, internal and not re-exported from `index.ts`:
  ```ts
  export const NON_NATIVE_LABEL: unique symbol = Symbol.for('ap.field.nonNativeLabel')
  export function usesNonNativeLabel(children: ReactNode): boolean
  ```
  A component opts in by carrying `[NON_NATIVE_LABEL]: true` as a static property. `Symbol.for` is deliberate: it survives a duplicated module copy, the two-React-copies class of problem CONTRIBUTING records under "`@base-ui/react` left external…". `usesNonNativeLabel` is true only when `children` is a single valid element whose `type` carries the marker. Wrapped and fragment children return false.
- Behaviour Task 5 relies on: when the marker is detected, `Field` does three things. It renders `<Field.Label nativeLabel={false} render={<div />} id={labelId}>`, with `labelId` from `useId()`. It clones the child with `'aria-labelledby': labelId`, **unless the child already has an `aria-labelledby`** (Review Focus 2). Everything else is unchanged.

- [ ] **Step 1: Write the failing tests** in `Field.test.tsx`. Use a local test double, `function Fake(props) { return <button {...props} /> }` with `Fake[NON_NATIVE_LABEL] = true`, so this task doesn't depend on Select.
  - With the marked child, the label is a `DIV` with no `for`, and the child's `aria-labelledby` equals the label's `id`. Perturbation: delete the marker assignment and the label must be a `LABEL`.
  - With `<Input />`, the label is still a `LABEL` whose `htmlFor` resolves to the input. This is the regression guard for every existing field.
  - With the marked child carrying `aria-labelledby="mine"`, the child keeps `"mine"`.
  - **Identical DOM.** `<Field label="X"><Fake /></Field>` must equal the hand assembly: `Field.Root` + `Field.Label nativeLabel={false} render={<div />} id=…` + `<Fake aria-labelledby=…>` + `Field.Error`. Extend the existing identical-DOM test's mechanism in this file, and read how it handles generated ids before writing yours. This is ADR-0011 §2's rule: the protocol must be expressible with public parts only.
  - Server render: `renderToString` of the marked case contains the label `id` and a matching `aria-labelledby` on the child's tag, scoped to that tag. Put this in `Field.ssr.test.tsx`.
- [ ] **Step 2: Run and watch them fail.** `npx vitest run --project unit packages/react/src/components/Field`.
- [ ] **Step 3: Implement.** `Field.tsx` may import `nonNativeLabel.js` from its own folder. The rule "no Base UI import, no context read" still holds. Update `Field.tsx`'s doc comment to describe the protocol, and state R16's narrow rationale for the explicit id. Pass `id` and `aria-labelledby` conditionally, never as `undefined`.
- [ ] **Step 4: Run.** `npx vitest run --project unit packages/react/src/components/Field && npm run typecheck && npm run test:guards`. Expected: pass. Existing Field tests are unchanged.
- [ ] **Step 5: Commit.** `feat(react): let Field label a control through aria-labelledby with a server-rendered id`.

---

### Task 3: `selectItems.ts`, the pure helpers

**Files:**
- Create: `packages/react/src/components/Select/selectItems.ts`, `packages/react/src/components/Select/selectItems.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SelectItem<Value> { value: Value; label: string; disabled?: boolean }
  export interface SelectGroup<Value> { label: string; items: ReadonlyArray<SelectItem<Value>> }
  export type SelectItems<Value> = ReadonlyArray<SelectItem<Value>> | ReadonlyArray<SelectGroup<Value>>
  export function isGrouped<Value>(items: SelectItems<Value>): items is ReadonlyArray<SelectGroup<Value>>
  export function flattenItems<Value>(items: SelectItems<Value>): ReadonlyArray<SelectItem<Value>>
  export function defaultToStringValue(value: unknown): string        // strings as-is; anything else throws
  export function equalBySerialisation<Value>(toString: (v: Value) => string): (a: Value, b: Value) => boolean
  export function findLabel<Value>(value: Value | null | undefined, flat: ReadonlyArray<SelectItem<Value>>, toString: (v: Value) => string): string | undefined
  export function formatLabelList(labels: ReadonlyArray<string>, locale: string): string
  ```
- `label` is `string`, not `ReactNode`, on the convenience items. Typeahead, `Intl.ListFormat` and the trigger text all need text. Custom item content is the compound parts' job (spec §4.3.1).
- `defaultToStringValue` throws for non-strings, with a message naming `itemToStringValue`. The type system already requires the prop for non-string values (Task 5), so this is the runtime backstop for an `as` cast.
- `formatLabelList` uses `new Intl.ListFormat(locale, { type: 'conjunction', style: 'long' })`. Returns `''` for an empty list.

- [ ] **Step 1: Write the failing tests.** For each, name the perturbation:
  - `findLabel` finds an object value **rebuilt as a new object** by serialisation. Perturbation: compare with `===`.
  - `findLabel` returns `undefined` for a value matching no item (Review Focus 4) and for `null`.
  - `flattenItems` preserves order across groups.
  - `equalBySerialisation` is true for two distinct objects with the same key and false for different keys.
  - `formatLabelList(['Red','Green','Blue'], 'en-US') === 'Red, Green, and Blue'` and `formatLabelList(['Rot','Grün','Blau'], 'de-DE') === 'Rot, Grün und Blau'`. Perturbation: `labels.join(', ')` must fail the German case. If Node's ICU data yields different punctuation, record the actual strings and keep the differential. The point is that the two locales differ.
  - `defaultToStringValue({})` throws with a message containing `itemToStringValue`.
- [ ] **Step 2: Run and watch them fail.** `npx vitest run --project unit packages/react/src/components/Select/selectItems.test.ts`.
- [ ] **Step 3: Implement.** Add `'use client'`. No React import is needed.
- [ ] **Step 4: Run the tests. Expected: pass.** Then `npm run test:guards`.
- [ ] **Step 5: Commit.** `feat(react): add Select's item helpers — serialised equality, label lookup, locale list`.

---

### Task 4: Select tokens, recipe and compound parts

**Files:**
- Create: `Select.tokens.ts`, `Select.css.ts`, `SelectParts.tsx`, `SelectParts.test.tsx`, `Select.ssr.test.tsx` (parts cases), all in `packages/react/src/components/Select/`
- Modify: `packages/react/src/gates/use-client.gate.test.ts` (one exemption)

**Interfaces:**
- Consumes: `deriveNativeButton`, `POSITIONER_SIDE_OFFSET` (Task 1).
- Produces parts, each a `forwardRef` wrapper that omits and redeclares `className` and merges it after the recipe class, like `FieldParts.tsx`:
  `SelectRoot` (Base UI `Select.Root`, no element), `SelectTrigger`, `SelectValue`, `SelectIcon`, `SelectPopup`, `SelectList`, `SelectItem`, `SelectGroup`, `SelectGroupLabel`, `SelectSeparator`. Export each part's props type as `Select<Part>Props`.
  - `SelectTrigger` takes `size?: 'sm' | 'md' | 'lg'` (the recipe variant) and **derives `nativeButton`** with `deriveNativeButton(render)` unless the consumer passes it, exactly as `Button.tsx:134` does.
  - `SelectIcon` renders `<Icon name="chevron-down" />` as its default children, decorative.
  - `SelectPopup` renders `Select.Portal > Select.Positioner > Select.Popup`. The positioner gets `side="bottom"`, `sideOffset={POSITIONER_SIDE_OFFSET}` and `alignItemWithTrigger={false}`. Each is overridable through a `positioner?: Pick<PositionerProps, 'side' | 'align' | 'sideOffset' | 'alignOffset' | 'collisionPadding'>` prop, not by exposing Portal and Positioner as parts. `className` and `ref` go to the popup element. Read `DialogParts.tsx:82-140` for how Dialog composes portal and popup, and match its motion and `zIndex` usage.
  - `SelectItem` renders `Select.Item > [Select.ItemIndicator (check icon), Select.ItemText (children)]`. It **owns** the indicator: `render` is omitted from `SelectItemProps`, with the same reasoning and doc comment shape as `FieldError` (`FieldParts.tsx`, §4.1.4).
- Tokens: the §4.1.10 roles for the trigger (`bg`, `text`, `border`, `borderHover`, `borderInvalid`, `focusRing`, `radius`) plus `placeholder` (as Input), and **beyond the contract**: `popupBg` (`vars.color.bgSurface`), `popupBorder` (`vars.color.borderNormal`), `popupShadow` (the elevation role `Dialog.tokens.ts` uses), `popupRadius` (`vars.radius.md`), `itemHighlightBg` (`vars.color.actionBgSubtle`), `itemText` (`vars.color.textPrimary`), `itemDisabledText` (`vars.color.textSecondary`), `indicator` (`vars.color.actionText`), `groupLabelText` (`vars.color.textSecondary`), `separator` (`vars.color.borderNormal`). If a named `vars.*` leaf does not exist, stop and report. Do not substitute one.
- Layout, specified here so it is not invented three ways:
  - **Trigger:** `display: inline-flex`, `align-items: center`, `justify-content: space-between`, gap `space['2']`, `inline-size: 100%`, and the same block size, padding and type scale per `size` as `Input.css.ts`'s recipe, which is the precedent to read.
  - **Value:** one line, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`, `min-inline-size: 0`. Placeholder state (`[data-placeholder]` on the trigger) uses the `placeholder` role.
  - **Popup:** `min-inline-size: var(--anchor-width)`, `max-block-size: var(--available-height)`, `overflow-y: auto`, padding-block `space['2']`, `zIndex: vars.z.popover` on the positioner. Motion on the popup matches `Dialog.css.ts:20-21` (`enter.fade-rise` on `[data-open]`, `exit.fade` on `[data-ending-style]`), with no new motion (§4.1.5).
  - **Item:** grid of indicator column (`vars.icon` size used by `Checkbox`'s glyph) plus text, gap `space['2']`, padding-inline `space['4']`, padding-block `space['3']`. `[data-highlighted]` uses `itemHighlightBg`. `[data-disabled]` uses `itemDisabledText` and `cursor: default`. `[data-selected]` is expressed by the indicator glyph, **not** by colour alone.
  - Hover is `&:hover:not([data-disabled])`. Disabled trigger is `&[data-disabled]` with `opacity: 0.6; cursor: default` (§4.1.10).

- [ ] **Step 1: Write the failing parts tests** (`SelectParts.test.tsx`, jsdom). Read `Field/FieldParts.test.tsx` and `Checkbox/Checkbox.test.tsx` for shape.
  - A hand assembly inside `<Field.Root><Field.Label nativeLabel={false} render={<div/>} id="l">…` with `<Select.Trigger aria-labelledby="l">` gives the trigger `role="combobox"` and the accessible name. **ARIA derivation (§4.1.3):** `aria-describedby` resolves to the `Field.Description` text and `aria-invalid="true"` appears under `<Field.Root invalid>`, with no id written by the test. Perturbation: render the trigger outside `Field.Root` and the describedby must vanish.
  - `SelectTrigger` with `render={<a href="#" />}` does **not** get `role="button"`, while it still gets `role="combobox"`. Perturbation: force `nativeButton` true.
  - Opening the popup, by clicking the trigger then `await waitFor`, mounts a listbox whose positioner has `data-side="bottom"` and does not have `data-side="none"`. Perturbation: remove `alignItemWithTrigger={false}`. Base UI then renders side `none` when mounted with a mouse. `alignItemWithTriggerActive` also depends on `openMethod !== 'touch'` (`SelectPositioner.js:84`). If jsdom's synthetic events cannot make this perturbation fail, move the assertion to Task 6's placement `play`, which runs in real Chromium, and say so in the commit. Don't keep a jsdom assertion that cannot fail.
  - Each selected item renders the indicator glyph (an `svg` inside `[data-selected]`). Perturbation: remove the indicator.
  - `size` differential: `sm` and `lg` triggers carry different recipe classes, compared against `selectTriggerRecipe({ size })` output, the way 5b's fix wave asserted `size` (see `RadioGroup.test.tsx`).
  - `ref` on `SelectTrigger` is an `HTMLButtonElement`, and `className` merges with the recipe class.
- [ ] **Step 2: Write the failing parts SSR tests** (`Select.ssr.test.tsx`). Cover four things: the trigger is present, **no `role="listbox"` in the HTML** (perturbation: add `keepMounted`), the hidden input carries `name` and `value`, scoped to its `<input …>` tag, and the process has no DOM (`typeof window === 'undefined'`, as `Switch.ssr.test.tsx` does).
- [ ] **Step 3: Run and watch them fail.** `npx vitest run --project unit packages/react/src/components/Select`.
- [ ] **Step 4: Implement** tokens, recipe and parts. Add the `TS_EXEMPTIONS` entry. Every part carries a doc comment saying what it adds over Base UI's part, and nothing else. It never passes `id`, `aria-describedby` or `aria-invalid` (read `FieldParts.tsx:22-34`).
- [ ] **Step 5: Run.** `npx vitest run --project unit packages/react/src/components/Select && npm run typecheck && npm run test:guards && npm run test:contrast`. Expected: pass. A contrast failure on a new role means the fallback is wrong. Fix the role, never the gate.
- [ ] **Step 6: Commit.** `feat(react): add Select compound parts with bottom-anchored popup and owned indicator`.

---

### Task 5: The `Select` convenience component

**Files:**
- Create: `packages/react/src/components/Select/Select.tsx`, `packages/react/src/components/Select/Select.test.tsx`, `packages/react/src/components/Select/index.ts`
- Modify: `packages/react/src/components/Select/Select.ssr.test.tsx`, `packages/react/src/index.ts`

**Interfaces:**
- Consumes: parts (Task 4), helpers (Task 3), `NON_NATIVE_LABEL` (Task 2), `useLocale` and `useMessages` (`providers/LocaleProvider.tsx`).
- Produces:
  ```ts
  type Serialisation<Value> = [Value] extends [string]
    ? { itemToStringValue?: (value: Value) => string }
    : { itemToStringValue: (value: Value) => string }

  export type SelectProps<Value, Multiple extends boolean | undefined = false> =
    Omit<BaseSelectRootProps<Value, Multiple>, 'items' | 'itemToStringValue' | 'itemToStringLabel' | 'children'> &
    Serialisation<Value> & {
      items: SelectItems<Value>
      placeholder?: string
      size?: 'sm' | 'md' | 'lg'
      className?: string              // → trigger
      'aria-labelledby'?: string      // → trigger; set by Field's protocol
      ref?: Ref<HTMLButtonElement>    // → trigger
    }
  ```
  **`forwardRef` erases generics**, so `Select` is a plain generic function component that takes `ref` as a prop (React 19). The ref goes to the trigger, as `Input`'s goes to its `<input>`. `Select` is also the namespace: `Object.assign(SelectBase, { Root, Trigger, Value, Icon, Popup, List, Item, Group, GroupLabel, Separator, [NON_NATIVE_LABEL]: true })`, the way `Field.tsx` ends. Check that the generic survives `Object.assign` with a type test (Step 1).
- Behaviour:
  - `isItemEqualToValue` defaults to `equalBySerialisation(toString)`. A consumer's own still wins. `toString` is `itemToStringValue ?? defaultToStringValue`, and it is passed to Root as `itemToStringValue`.
  - `items` is passed to Root. The trigger text is `<Select.Value placeholder={placeholder}>{(v) => …}</Select.Value>`, where the children function returns `findLabel` for a single value and `formatLabelList(labels, locale)` for an array. With **no value** it returns `null`, so Base UI shows the placeholder. **Check this in Step 1:** with a children function, `SelectValue.js` never falls back to `placeholder`, so the function must return the placeholder itself when there is no selection. Test it either way.
  - Grouped items render `Select.Group` + `GroupLabel` per group, with `Select.Separator` **between** groups only.
  - An empty `items` renders one non-selectable row with `messages.noResults`. Read `providers/messages.ts`, and add no new key.
  - JSDoc on the component: put `name` on `Select`, never also on the wrapping `Field` (Review Focus 1), with the 5b fact as the reason. Explain why `label` is a string. Explain the default equality and why it differs from Base UI's.
  - **Development warning (§4.3.2).** In a `useEffect`, if the trigger element's `labels` list is non-empty, a `<label for>` points at the button. This means the Select was wrapped where Field could not see the marker. Call `console.error` naming `Field`'s protocol and the fix. Guard it with `typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'`. `useEffect` and an element ref are SSR-safe, but **if `ssr-safety.gate` or any other gate rejects the `process` reference, stop and report.** Do not add an exemption on your own authority.

- [ ] **Step 1: Write the failing tests** (`Select.test.tsx`, jsdom, inside `ApProvider`/`LocaleProvider` as the existing component tests do).
  - **Type tests.** Each carries a comment in the style of `Switch.test.tsx:22-40`, explaining that an `@ts-expect-error` which stops erroring fails typecheck.
    - `<Select items={[{ value: { id: 1 }, label: 'A' }]} />` without `itemToStringValue` → `@ts-expect-error`.
    - With it → compiles.
    - `<Select multiple defaultValue="a" …/>` → `@ts-expect-error` (must be an array).
    - `Select.Root` still exists after `Object.assign`.
  - Inside `<Field label="Country">`: the label is a `DIV` and the combobox's accessible name is "Country". Perturbation: remove `[NON_NATIVE_LABEL]` from the namespace.
  - An object `defaultValue` **rebuilt as a new object** shows its item's label, not JSON, and the combobox exposes that text. Perturbation: drop the `isItemEqualToValue` default and it must fail on the selected state after opening.
  - An object `defaultValue` matching no item shows the placeholder (Review Focus 4).
  - `multiple` with three values at `de-DE` shows `Rot, Grün und Blau`. Perturbation: render Base UI's default `Select.Value` with no children function.
  - Grouped items: two group labels, exactly one separator.
  - Empty items: the `noResults` text, and overriding it through `LocaleProvider messages` changes it.
  - The development warning fires for `<Field.Root><Field.Label>Country</Field.Label><Select …/></Field.Root>` (a native label with `for` pointing at the trigger) and does not fire inside `<Field label>`. Spy on `console.error`.
  - **Identical DOM:** `<Select items={…} />` equals the hand assembly from the parts, as `Field.test.tsx` asserts for Field.
- [ ] **Step 2: Extend `Select.ssr.test.tsx`.**
  - The selected label, not the value, is in the trigger span (`>Canada<`, and not `>ca<` inside the trigger). Perturbation: drop `items` from Root and use a plain `Select.Value`.
  - In `<Field label>`, the trigger tag carries `aria-labelledby` equal to the label `div`'s id. Perturbation: revert Task 2's explicit id.
  - `multiple` with two defaults emits exactly two `<input type="hidden" name="…">` tags with the right values.
  - `multiple` with **no** default emits **zero** named inputs (Review Focus 3).
  - An object value posts its `itemToStringValue` string in the hidden input.
- [ ] **Step 3: Run and watch them fail.**
- [ ] **Step 4: Implement,** plus the barrel and `index.ts` exports: `Select`, `SELECT_TOKENS`, then types `SelectProps`, `SelectItem`, `SelectGroup`, `SelectItems` and every part's props type. Order: after `RadioGroup` (`index.ts:47-53`). **`NON_NATIVE_LABEL` is not exported.**
- [ ] **Step 5: Run.** `npx vitest run --project unit packages/react/src/components/Select packages/react/src/components/Field && npm run typecheck && npm run test:guards`. Expected: pass.
- [ ] **Step 6: Commit.** `feat(react): add the Select convenience component`.

---

### Task 6: Stories

**Files:**
- Create: `packages/react/src/components/Select/Select.stories.tsx`

- [ ] **Step 1: Read `RadioGroup.stories.tsx` and `Field/Field.stories.tsx`.** Match them: `satisfies Meta<typeof Select>`, `argTypes` for `size` and `disabled`, and a size grid rather than a cross-product.
- [ ] **Step 2: Write the stories.** `Default` (in `Field`), `Sizes`, `Grouped`, `Multiple`, `ObjectValues`, `Disabled`, `Invalid` (in `Field` with `error`), `Empty`, and `HandAssembled`. `HandAssembled` shows the compound parts with the non-native label written out by hand, because spec §4.3 requires the story to show both.
- [ ] **Step 3: `play` functions assert behaviour, not rendering:**
  - **Keyboard:** focus the trigger; `ArrowDown` opens; arrows move `data-highlighted`; `Enter` selects and closes; focus is back on the trigger; the trigger text changes. `Escape` closes without changing the value. Typing a letter jumps to the matching item. Use `await waitFor` throughout.
  - **Placement:** once open, the popup's top edge is at or below the trigger's bottom edge (`getBoundingClientRect`). Perturbation: `positioner={{ side: 'top' }}` must fail it. Apply once, then revert.
  - **Multiple:** selecting two items keeps the popup open and the trigger shows the list-formatted text.
- [ ] **Step 4: Run.** `npm run test:stories && npm --prefix storybook run typecheck`. Expected: pass, with the story file count up by one. An axe violation is a real finding: fix the component or story, and never silence it with a parameter. Perturbation for gate 5: temporarily render one story's Select with no label, confirm the run fails naming it, then revert.
- [ ] **Step 5: Commit.** `test(storybook): Select stories with keyboard, placement and multi-select play`.

---

### Task 7: SSR fixture, gate 6 and the showcase

**Files:**
- Modify: `fixtures/ssr-app/app/routes/form.tsx`, `packages/react/src/gates/ssr-render.gate.test.ts`, `fixtures/ssr-app/e2e/progressive-enhancement.spec.ts` (only if a locator needs changing), `showcase/app/sections.ts`
- Create: `showcase/app/routes/select.tsx`

- [ ] **Step 1: Read** `form.tsx` in full and the gate test at `ssr-render.gate.test.ts:240-380`. Phase 1 pins defaults against real markup with literal assertions. Phase 2 posts what phase 1 extracted (R18). Your additions join both phases in that shape.
- [ ] **Step 2: Add two controls to the fixture form,** each inside a `<Field>`, with `name` on the Select only:
  - A single `Select name="country"` with `defaultValue="ca"`, whose items include `{ value: 'ca', label: 'Canada' }`.
  - A `multiple` Select `name="topics"` with two defaults.

  Extend `action` and the echo elements in the style already there (`echo-country`, `echo-topics`, the latter joining `getAll`). **Choose copy that cannot collide** with `getByLabel('Email')` or any other locator in `e2e/*.spec.ts` (Review Focus 5). Read every `getByLabel` in those specs first.
- [ ] **Step 3: Extend the gate test.**
  - Phase 1: the trigger contains `Canada` (the label), and the named hidden input has `value="ca"`. Two `type="hidden" name="topics"` inputs carry the two values. **No `role="listbox"` anywhere in the response** (verification row 7).
  - Phase 2: post the extracted values (`topics` twice) and assert the echoes.
- [ ] **Step 4: Add the showcase section.** One `SECTIONS` entry and `routes/select.tsx`, which only renders: single, grouped, multiple. Match `showcase/app/routes/spinner.tsx`.
- [ ] **Step 5: Run this fixture's own suites here, not later** (5b's Critical):
  ```bash
  npm --prefix fixtures/ssr-app run typecheck
  npm run test:ssr && npm run test:spa
  npm run test:hydration
  npm --prefix showcase run typecheck && npm run showcase:test
  ```
  Expected: all pass. `test:hydration` must still pass `progressive-enhancement.spec.ts` unchanged. If a locator collides, fix the copy first, then the locator by role and name, and say which in the commit.
- [ ] **Step 6: Commit.** `feat(fixtures,showcase): Select joins the pre-hydration form post and SSR smoke`.

---

### Task 8: Put `Switch` on the control-state contract, and add the `RadioGroup` JSDoc

**Files:**
- Modify: `packages/react/src/components/Switch/{Switch.tokens.ts,Switch.css.ts,Switch.test.tsx,Switch.stories.tsx}`, `packages/react/src/components/RadioGroup/RadioGroup.tsx`

- [ ] **Step 1: Write the failing test.** A `Switch` inside `<Field.Root invalid>` has `data-invalid` on its track, and the recipe emits a rule for it. Assert on the recipe's class and on the presence of `borderInvalid` in `SWITCH_TOKENS`, following whatever `Checkbox.test.tsx` does for its invalid state. Read that file first and mirror its approach rather than inventing one. Perturbation: remove the rule.
- [ ] **Step 2: Implement.** Add `border`, `borderHover` and `borderInvalid` from §4.1.10. The track gets `border` at rest, `borderHover` on `&:hover:not([data-disabled])`, and `borderInvalid` on `&[data-invalid]`. The border width matches Checkbox's. If a border changes the track's outer size, compensate inside the recipe so the thumb travel is unchanged, and check the Switch story visually. Remove the comment in `Switch.stories.tsx`'s `Invalid` story that documents the missing rule.
- [ ] **Step 3: RadioGroup JSDoc.** On `invalid`, say that it is a colour-and-border cue only, that ADR-0011 §5 requires it to be paired with visible copy, and point at `Field`'s `error` pattern.
- [ ] **Step 4: Run.** `npx vitest run --project unit packages/react/src/components/Switch packages/react/src/components/RadioGroup && npm run test:stories && npm run test:guards && npm run test:contrast`. Expected: pass.
- [ ] **Step 5: Commit.** `fix(react): give Switch the shared control-state roles and its invalid rule`.

---

### Task 9: Documentation

**Files:**
- Modify: `docs/CONTRIBUTING.md`, `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md` (§4.3.3)

- [ ] **Step 1: Add three sections to CONTRIBUTING's Base UI traps** (they sit between "`nativeButton`/anchor-role trap" and "Known caveats"). Name the source file in each, so the next person can re-check it against a new Base UI version.
  1. **Object values render as JSON when the default is rebuilt.** Cite `internals/resolveValueLabel.js`, and say that the convenience component bypasses it with a children function.
  2. **`nativeLabel={false}` still renders a `<label>`** unless it also gets `render={<div />}`.
  3. **The non-native-label protocol.** The marker, what `Field` does with it, why the id is explicit (R16's narrow rationale, verbatim in meaning), and what a hand assembly must write.
- [ ] **Step 2: Update "Adding a component".** Add one bullet: a control that is not a labelable element opts into `Field`'s protocol with `NON_NATIVE_LABEL`, and a story shows the hand assembly. Also add a bullet for spec §4.1.10: token roles come from the shared contract, and a plan lists only extras.
- [ ] **Step 3: Spec §4.3.3.** Replace "likely absent … the plan checks" with the verified result and the fix taken. Add the object-value finding.
- [ ] **Step 4: Verify and commit.** `npm run typecheck && npm run test:guards` (the style gate scans comments in source, not docs, but run it anyway). `docs: record Select's Base UI traps and Field's non-native-label protocol`.

---

### Task 10: The CI sweep and the pull request

**Files:** none expected.

- [ ] **Step 1: Run every CI step locally, in `ci.yml`'s order.** This list is `ci.yml` transcribed job by job. If `ci.yml` has changed since this plan was written, re-derive the list from it rather than trusting this one.
  ```bash
  # unit
  npm run typecheck && npm test && npm run test:gates && npm run report:contrast
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
  Record the real numbers from each. If a `gen:*` step dirties the tree, Task 1's `SPACE` export or a token change is the likely cause. Commit the regenerated file, don't hand-edit it.
- [ ] **Step 2: Stop and ask before pushing.** Pushing and opening a pull request publishes the branch, so confirm with the human first. Once approved, push `feat/phase5c-select` and open a PR to `main` titled `Phase 5c: Select`. The body says what shipped, names the Base UI facts this plan established, and states which contracts are asserted where: unit tests for DOM, ARIA and types; `play` for keyboard and placement; gate 6 and `test:hydration` for pre-hydration posts.
- [ ] **Step 3: Watch all six jobs to green.** Diagnose any failure from its logs, fix it, and report each job's result.
- [ ] **Step 4: Append "What actually happened"** to this plan, in 5b's format, and commit it on the branch.

---

## Verification plan

Ordered. Each check is a command whose output is the evidence, with the perturbation that must make it fail.

| # | Claim | Command | Must fail when… |
|---|---|---|---|
| 1 | `deriveNativeButton` behaves identically after the move | `npm test` (Task 1) | the `undefined` branch flips |
| 2 | A marked child gets a `<div>` label and `aria-labelledby`; Input keeps `<label for>` | `npm test` (Task 2) | the marker is removed |
| 3 | The trigger is named in **server** HTML | `npm test` SSR project (Tasks 2, 5) | the explicit id is reverted |
| 4 | Object defaults rebuilt as new objects match their item | `npm test` (Tasks 3, 5) | equality falls back to `Object.is` |
| 5 | Object values without `itemToStringValue` do not compile | `npm run typecheck` (Task 5) | the conditional type is loosened |
| 6 | The selected label, not the value, is in server HTML | `npm test`, `test:ssr` | `items` is dropped |
| 7 | No listbox in server HTML | `npm test`, `test:ssr` | `keepMounted` is added |
| 8 | Pre-hydration posts carry single, multiple (N fields) and object values | `test:ssr`, `test:hydration` | the hidden input is portalled or `itemToStringValue` is dropped |
| 9 | An empty multiple posts no field | `npm test` SSR | an empty hidden input is added |
| 10 | Popup opens below the trigger | `test:stories` | `side: 'top'`, or alignment with the trigger is left on |
| 11 | Keyboard listbox semantics | `test:stories` | (real browser behaviour; the test is the evidence) |
| 12 | The multi-select list is locale-formatted | `npm test` | a `', '` join is used |
| 13 | Selection is shown by a glyph | `npm test` | the indicator is removed |
| 14 | `size` reaches the recipe | `npm test` | the variant is dropped |
| 15 | Zero axe violations | `test:stories` | a story loses its label |
| 16 | Switch has a `[data-invalid]` rule | `npm test` | the rule is removed |
| 17 | Every gate is green | `npm run test:gates` | a missing tokens exemption fails `use-client` |
| 18 | Every CI job is green | Task 10's sweep, then the PR | — |

**Final proof artifact:** a green CI run of all six jobs on the Phase 5c pull request, plus Task 10's local sweep output.
