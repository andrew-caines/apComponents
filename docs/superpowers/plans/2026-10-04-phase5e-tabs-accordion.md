# Phase 5e — Tabs and Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `Tabs` (underline and pills variants, horizontal and vertical, manual activation, an indicator that moves by transition) and `Accordion` (hidden-until-found panels, a `headingLevel` prop, height motion from `@ap/motion`) as convenience components over public compound parts.

**Architecture:** `TabsParts.tsx` and `AccordionParts.tsx` hold thin styled wrappers over `@base-ui/react@1.7.0`, the pattern `TooltipParts.tsx` and `PopoverParts.tsx` follow. `Tabs.tsx` and `Accordion.tsx` are convenience components built only from those parts. Each maps an `items` array. Tabs takes a required list name. Accordion takes `headingLevel` and always passes `hiddenUntilFound`.

**Tech Stack:** React 19.2, `@base-ui/react` 1.7.0, vanilla-extract, `@ap/motion`, Vitest 4.1.11 (projects `unit` and `storybook`), Storybook 10.6, Playwright 1.62.1, React Router 8 (the SSR fixture).

**Spec:** `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md`. Read §4.1 (all ten shared decisions, especially §4.1.1, §4.1.5 and §4.1.10) and §4.5–§4.5.1 (this plan's scope). Also read the "What actually happened" sections of the 5b, 5c and 5d plans in `docs/superpowers/plans/` before any task.

**How this plan is written, deliberately:** as in 5c and 5d, **each rule is stated and the precedent file that already follows it is cited.** Code appears only where it is short and is itself the contract. A deviation from a cited precedent is a review finding unless the step says otherwise.

## Global Constraints

- **Node 22.22.0** in CI. `engines.node` is `>=22.22.0`.
- **`'use client'` is the literal first line** of every `.ts`/`.tsx` under `packages/react/src`, except `index.ts` barrels, `*.css.ts`, and files in `use-client.gate.test.ts`'s `TS_EXEMPTIONS`. **Every new `*.tokens.ts` gets a `TS_EXEMPTIONS` entry** in the `join(SRC, 'components', '<Name>', '<Name>.tokens.ts')` form.
- **Relative imports carry `.js`**, even from `.tsx`.
- **Every style declaration sits inside `'@layer': { [componentsLayer]: { … } }`.** State rules go in `selectors: { … }` with `&`-prefixed keys. `boxSizing: 'border-box'` goes in every recipe base.
- **No physical CSS properties** (no `left`, `right`, `top`, `bottom`, `marginLeft` and so on; the style-rules gate rejects them, even in comments, so hyphenate a forbidden word in prose). **No Tier 1 tokens, no literal `zIndex`, no suppressed outline, no `boxShadow` in `:focus-visible`.** Durations are tokens.
- **Tier 3 tokens are `tier3('<component>-<role>', <vars.* fallback>)`.** If a named `vars.*` leaf does not exist, stop and report.
- **Every user-facing string is consumer content.** This plan adds no message key.
- **`exactOptionalPropertyTypes` is on.** Spread optionals conditionally. Never write `prop={undefined}`.
- **There is no jest-dom in unit tests.** Use `el.getAttribute(…)`. Stories use `storybook/test`'s `expect`, which has the DOM matchers.
- **Base UI defers some DOM updates.** Keyboard, focus and open assertions use `await waitFor(…)`.
- **No dependency may be added. Never run a snapshot-update flag. Never run prettier.** House style is single quotes and no semicolons (5d retrospective).
- **Every assertion names the change that must make it fail, `play` functions included.** Apply each perturbation once, watch it fail, and revert.
- **A Base UI citation points at the line that causes the claim** (5d retrospective). When the cause is unknown, write "observed" and cite the test that pins it. If a fact below is wrong, stop and report.
- **Hover is guarded against disabled AND the active state** (`:hover:not([data-disabled]):not([data-selected])` and similar), because `:hover:not(…)` outranks a bare state rule on specificity. `Checkbox.css.ts`'s hover rule is the precedent since the 5c follow-ups.
- **A part that takes a `render` is tested with our own `Button` as the render** (5d retrospective: `deriveNativeButton` was wrong for it for a whole phase).

## Base UI facts established before writing this plan

Verified on 2026-10-04 in `node_modules/@base-ui/react/`. These are copied from spec §4.5.1, which cites each one.

| Fact | Consequence |
|---|---|
| `activateOnFocus = false`, `loopFocus = true` (`tabs/list/TabsList.js:26,28`). `orientation` sets `aria-orientation` (`:83`) | Manual activation and wrapping focus come free. Pass `orientation` to the List as well as the Root |
| `keepMounted = false`; a panel renders only when `keepMounted \|\| mounted` (`tabs/panel/TabsPanel.js:36,100`) | Inactive panels unmount. `keepMounted` passes through |
| `renderBeforeHydration = false`; the script renders only when it is set (`tabs/indicator/TabsIndicator.js:36,134-135`) | Never pass it. The SSR test asserts there is no `<script>` |
| Indicator geometry is `--active-tab-left/right/top/bottom/width/height` in px (`TabsIndicator.js:104-109`). `left` and `right` are measured from the list's physical edges (`:85-90`) | The indicator is placed with **logical** properties: `inset-inline-start: var(--active-tab-left)` in LTR and `var(--active-tab-right)` under `:dir(rtl)`. Review Focus 4 |
| A tab is `useButton`-based with `nativeButton = true` and `role: 'tab'` (`tabs/tab/TabsTab.js:38,115-117,178`) | §4.1.1's derivation applies to `TabsTab` |
| `multiple = false`, `orientation = 'vertical'`, `hiddenUntilFound ?? false`, `keepMounted ?? false` (`accordion/root/AccordionRoot.js:36-37,102-103`) | The convenience component passes `hiddenUntilFound` |
| A panel is `role="region"`, `aria-labelledby` its trigger (`accordion/panel/AccordionPanel.js:106-107`). The trigger sets `aria-expanded`, and `aria-controls` while open (`accordion/trigger/AccordionTrigger.js:62-63`), with `nativeButton = true` (`:29`) | No ARIA of our own |
| The header renders `<h3>` (`accordion/header/AccordionHeader.js:29`) | `headingLevel` swaps it through `render` |
| The panel height variable is `--accordion-panel-height` (`accordion/panel/AccordionPanelCssVars.js:12`). `collapse`/`expand` read `--panel-height` (`packages/motion/src/motions.ts:103-116`) | The panel declares `--panel-height: var(--accordion-panel-height)` (§4.1.5) |
| `hidden="until-found"` is set in a client layout effect, because React renders `hidden` as a boolean (`collapsible/panel/useCollapsiblePanel.js:270-280`). A `beforematch` listener opens the panel (`:281-290`) | Server HTML holds a closed panel's content under plain `hidden`. Find-in-page works only after hydration. Both halves are pinned |
| `Switch.css.ts:217-240` moves its thumb by a **transition** on a logical property with `vars.duration.fast` | This is the precedent for the indicator's transition. Read its comment for why a duration token suppresses itself under reduced motion |

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/react/src/components/Tabs/Tabs.tokens.ts` | Tier 3 roles for tabs, list, indicator and panel |
| `packages/react/src/components/Tabs/Tabs.css.ts` | List and tab recipes over `variant × orientation`, indicator, panel |
| `packages/react/src/components/Tabs/TabsParts.tsx` (+ `TabsParts.test.tsx`) | `TabsRoot`, `TabsList`, `TabsTab`, `TabsPanel`, `TabsIndicator` |
| `packages/react/src/components/Tabs/Tabs.tsx` (+ `Tabs.test.tsx`, `Tabs.ssr.test.tsx`) | Convenience component and namespace |
| `packages/react/src/components/Tabs/Tabs.stories.tsx` | Stories and `play` |
| `packages/react/src/components/Tabs/index.ts` | Barrel |
| `packages/react/src/components/Accordion/Accordion.tokens.ts` | Tier 3 roles for item border, trigger, chevron and panel |
| `packages/react/src/components/Accordion/Accordion.css.ts` | Item, header, trigger, chevron, panel (alias and motion) |
| `packages/react/src/components/Accordion/AccordionParts.tsx` (+ `AccordionParts.test.tsx`) | `AccordionRoot`, `AccordionItem`, `AccordionHeader`, `AccordionTrigger`, `AccordionPanel` |
| `packages/react/src/components/Accordion/Accordion.tsx` (+ `Accordion.test.tsx`, `Accordion.ssr.test.tsx`) | Convenience component and namespace |
| `packages/react/src/components/Accordion/Accordion.stories.tsx` | Stories and `play` |
| `packages/react/src/components/Accordion/index.ts` | Barrel |
| `packages/react/src/index.ts` | Exports, value then types, after `Popover` |
| `packages/react/src/gates/use-client.gate.test.ts` | Two `TS_EXEMPTIONS` entries |
| `vitest.config.ts` | Pre-bundle `@base-ui/react/tabs` and `@base-ui/react/accordion` for the storybook project (5d R4) |
| `fixtures/ssr-app/app/routes/disclosure.tsx`, `fixtures/ssr-app/app/routes.ts`, `fixtures/ssr-app/e2e/disclosure.spec.ts` | Server HTML and hydrated behaviour in a real browser |
| `showcase/app/sections.ts`, `showcase/app/routes/disclosure.tsx` | SSR smoke section |
| `docs/CONTRIBUTING.md`, spec §4.5.2 | Traps found, verified results |

---

## Review Focus

These five inputs are implied by the spec, not exercised by any obvious test, and most likely to bite a real user. Each has its test in the task that owns the code.

1. **A `Tabs` with neither `value` nor `defaultValue`.** Base UI's Root defaults to `0` (`tabs/root/TabsRoot.js:29`), which matches no string `value`. An uncontrolled root does fall back to a valid tab, but only in a client layout effect (`TabsRoot.js:182` onward). So **server HTML has no selected tab and no panel**, and the panel pops in at hydration. Expect the convenience component to select the **first enabled item** itself, so the right panel is in the server response. Pinned in Task 2 (a unit test and an SSR test).
2. **Disabled tabs during keyboard navigation.** Expect arrow keys to skip a disabled tab, and the disabled tab to be unselectable by click. Pinned in Task 5.
3. **A focusable control inside a closed Accordion panel.** Expect Tab to skip it, because `hidden` content is not focusable, and to reach it once the section is open. Pinned in Task 6.
4. **Right-to-left pages.** Base UI measures the indicator's `--active-tab-left/right` from physical edges, and the style gate forbids physical properties. Expect the underline to sit under the active tab in `dir="rtl"` too, and the vertical underline on the inline-end edge, which is physical left in RTL. Pinned in Task 1 (CSS) and Task 5 (an RTL story with a geometry assertion).
5. **More tabs than fit.** Expect a horizontal list to scroll horizontally inside its own box rather than wrap or overflow the page, and the indicator to follow the active tab when it is scrolled into view. Base UI's geometry uses `scrollWidth` (`TabsIndicator.js:89`). Pinned in Task 1 (CSS) and Task 5 (an overflow story).

---

### Task 1: Tabs tokens, recipe and compound parts

**Files:**
- Create: `Tabs.tokens.ts`, `Tabs.css.ts`, `TabsParts.tsx`, `TabsParts.test.tsx`, all in `packages/react/src/components/Tabs/`
- Modify: `packages/react/src/gates/use-client.gate.test.ts` (one exemption), `vitest.config.ts` (add `@base-ui/react/tabs` to the storybook project's `optimizeDeps.include`, beside the 5d entries)

**Interfaces:**
- Consumes: `deriveNativeButton` (`internal/deriveNativeButton.ts`).
- Produces, each exporting its props type as `Tabs<Part>Props`:
  - `TabsRoot`: Base UI's `Tabs.Root`. It takes `variant?: 'underline' | 'pills'` (default `underline`) and provides it, with the `orientation` Base UI already tracks, through a private context. The descendants read that context to choose their recipe.
  - `TabsList`: Base UI's `Tabs.List`. It carries the list recipe for `variant × orientation`, and passes `orientation` (read from context) so `aria-orientation` is set.
  - `TabsTab`: derives `nativeButton` with `nativeButton ?? deriveNativeButton(render)`, exactly as `PopoverParts.tsx`'s trigger does.
  - `TabsIndicator`: Base UI's `Tabs.Indicator`. It **never** passes `renderBeforeHydration`.
  - `TabsPanel`: Base UI's `Tabs.Panel` with a focus-visible ring (the panel is focusable).
- Tokens: §4.1.10's control roles for the tab (`text` → `vars.color.textSecondary`, plus `textSelected` → `vars.color.textPrimary`, `textHover` → `vars.color.textPrimary`, `focusRing`, `radius`), `listBorder` (`vars.color.borderSubtle`), `indicator` (`vars.color.actionBg`) for underline, and `pillBg` (`vars.color.actionBgSubtle`) with `pillText` (`vars.color.actionText`) for pills. Each fallback is a `vars.*` leaf. Run `npm run test:contrast`.
- Layout:
  - **List:** `display: flex`, gap `space['1']`, `position: relative`. Horizontal is a row. Vertical is a column with the tabs stretched.
  - **Underline variant:** a `borderBlockEnd` on a horizontal list, or a `borderInlineEnd` on a vertical one, in `listBorder`.
  - **Overflow (Review Focus 5):** a horizontal list scrolls (`overflowX: 'auto'`) inside its own box and never wraps. `overflow-x` is not a physical property in the gate's list; check the gate if unsure.
  - **Tab:** padding from the space scale, `text.sm`. Selected uses `textSelected`. Hover uses `textHover`, guarded as the Global Constraints say. Disabled uses `opacity: 0.6; cursor: default`. The focus ring follows `Input.css.ts`'s focus-visible rule. Tabs sit above the pill indicator (`position: relative` plus a stacking order from the z scale or source order, never a literal `zIndex`).
  - **Indicator (RTL-correct, Review Focus 4):** `position: absolute`, `insetInlineStart: var(--active-tab-left)`, and under `:dir(rtl)` `insetInlineStart: var(--active-tab-right)`. Underline horizontal: `inlineSize: var(--active-tab-width)`, a thin `blockSize` from a token, at the block end. Underline vertical: `blockSize: var(--active-tab-height)`, `insetBlockStart: var(--active-tab-top)`, a thin `inlineSize`, at the inline end. Pills: full `--active-tab-width` × `--active-tab-height` at the tab's position, `pillBg`, `radius`.
  - **Transition:** on the indicator's position and size properties, with `vars.duration.fast` and an ease token, matching `Switch.css.ts:217-240`. Also add a `@starting-style`-free rule for its first appearance: the indicator is absent until Base UI renders it with a selected tab (`TabsIndicator.js:93-103` sets `style` only when a tab is selected), so the first appearance comes from no width. Read those lines and say in a comment exactly what the first paint looks like.

- [ ] **Step 1: Write the failing parts tests** (`TabsParts.test.tsx`, jsdom). Read `Popover/PopoverParts.test.tsx` for shape.
  - A hand assembly with three tabs: the list has `role="tablist"`, the tabs have `role="tab"`, the selected one has `aria-selected="true"`, and its panel has `role="tabpanel"` labelled by it. Perturbation: none of ours; this pins Base UI wiring, so name it as a regression guard in the comment.
  - Manual activation: focus tab 1 and press ArrowRight, and **focus** moves to tab 2 while selection stays on tab 1. Then Enter selects tab 2. Perturbation: pass `activateOnFocus` to the List, and selection must move on ArrowRight.
  - `orientation="vertical"` on the Root sets `aria-orientation="vertical"` on the list. ArrowDown moves focus. Perturbation: don't pass `orientation` to the List.
  - `variant` and `orientation` reach the recipe. The list and tab carry the classes `tabsListRecipe({ variant, orientation })` and `tabRecipe({ … })` emit, for at least two combinations, compared differentially. Perturbation: ignore `variant` from context.
  - **`TabsTab` with `render={<Button />}`** has `type="button"`, keeps `role="tab"`, and logs no `console.error`. Perturbation: drop the `nativeButton` derivation.
  - An inactive panel is absent from the DOM; with `keepMounted` it is present and hidden.
  - `className` merges on every styled part.
- [ ] **Step 2: Run them and watch them fail.** `npx vitest run --project unit packages/react/src/components/Tabs`.
- [ ] **Step 3: Implement** tokens, recipe and parts. Add the `TS_EXEMPTIONS` entry and the `optimizeDeps` entry. Each part's doc comment says what it adds over Base UI's part.
- [ ] **Step 4: Run.** `npx vitest run --project unit packages/react/src/components/Tabs && npm run typecheck && npm run test:guards && npm run test:contrast`. Expected: pass.
- [ ] **Step 5: Commit.** `feat(react): add Tabs parts with underline and pills, horizontal and vertical`.

---

### Task 2: The `Tabs` convenience component

**Files:**
- Create: `packages/react/src/components/Tabs/Tabs.tsx`, `Tabs.test.tsx`, `Tabs.ssr.test.tsx`, `index.ts`
- Modify: `packages/react/src/index.ts`

**Interfaces:**
- Consumes: Task 1's parts.
- Produces:
  ```ts
  export interface TabsItem<Value extends string = string> {
    value: Value
    label: ReactNode
    content: ReactNode
    disabled?: boolean
  }
  type TabsName = { 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-labelledby': string; 'aria-label'?: never }
  export type TabsProps<Value extends string = string> =
    Omit<TabsRootProps, 'children' | 'value' | 'defaultValue' | 'onValueChange'> & TabsName & {
      items: ReadonlyArray<TabsItem<Value>>
      value?: Value
      defaultValue?: Value
      onValueChange?: (value: Value, …) => void   // match Base UI's signature; read TabsRoot's type
      variant?: 'underline' | 'pills'
      orientation?: 'horizontal' | 'vertical'
      keepMounted?: boolean
    }
  ```
  `aria-label` or `aria-labelledby` goes to `TabsList`. `keepMounted` goes to every `TabsPanel`. `Tabs` is also the namespace: `Object.assign(TabsBase, { Root, List, Tab, Panel, Indicator })`.
- **Review Focus 1:** when neither `value` nor `defaultValue` is given, `defaultValue` is the first item whose `disabled` is not true. With no enabled item, pass nothing.
- JSDoc covers four things: manual activation, what the name is for, that inactive panels unmount (so form state in them is lost unless `keepMounted`), and that `label` should be text.

- [ ] **Step 1: Write the failing tests** (`Tabs.test.tsx`).
  - **Type tests,** in the `@ts-expect-error` comment style of `Popover.test.tsx`: neither name → error; both → error; one alone compiles.
  - With `aria-label="Account"`, the tablist's accessible name is "Account".
  - Review Focus 1: items `[disabled a, b, c]` with no value selects `b`, so `b`'s panel is rendered. Perturbation: default to `items[0]`.
  - `keepMounted` keeps the inactive panels in the DOM. Perturbation: don't pass it to the panels.
  - **Identical DOM** against the hand assembly, as `Popover.test.tsx` does, with ids normalised.
- [ ] **Step 2: Write `Tabs.ssr.test.tsx`.**
  - The selected tab and its panel content are in the HTML, and the other panels' content is not.
  - Review Focus 1: with **no** `value` or `defaultValue`, the first enabled item's panel content is still in the HTML. Perturbation: pass no default, and Base UI's client-only fallback leaves the panel out of the server HTML.
  - **There is no `<script` in the output** (perturbation: pass `renderBeforeHydration` to the indicator, and the test must fail; this one can fail, unlike 5d's `keepMounted` case).
  - The process has no DOM.
- [ ] **Step 3: Run and watch them fail.**
- [ ] **Step 4: Implement,** plus the barrel and `index.ts` exports after `Popover`: `Tabs`, `TABS_TOKENS`, then the types `TabsProps`, `TabsItem` and every part's props type.
- [ ] **Step 5: Run.** `npx vitest run --project unit packages/react/src/components/Tabs && npm run typecheck && npm run test:guards`. Expected: pass.
- [ ] **Step 6: Commit.** `feat(react): add the Tabs convenience component with a required list name`.

---

### Task 3: Accordion tokens, recipe and compound parts

**Files:**
- Create: `Accordion.tokens.ts`, `Accordion.css.ts`, `AccordionParts.tsx`, `AccordionParts.test.tsx`, all in `packages/react/src/components/Accordion/`
- Modify: `packages/react/src/gates/use-client.gate.test.ts` (one exemption), `vitest.config.ts` (add `@base-ui/react/accordion` to `optimizeDeps.include`)

**Interfaces:**
- Consumes: `deriveNativeButton`, `Icon` (`chevron-down`, which exists in `icons/paths.ts:12`), and `cssVarName` from `@ap/motion` (as `Select.css.ts:157-158` and `Dialog.css.ts:20-21` use it).
- Produces, each exporting `Accordion<Part>Props`:
  - `AccordionRoot`: Base UI's root, re-exported.
  - `AccordionItem`: styled, with a block-end border between items.
  - `AccordionHeader`: Base UI's header, unstyled except for a margin reset. Its `render` is untouched, which is how a heading level changes.
  - `AccordionTrigger`: derives `nativeButton`. It renders its children, then a decorative `<Icon name="chevron-down" aria-hidden />` that it **owns**, so `render` cannot remove it (the `FieldError` and `SelectItem` precedent for owned content). The chevron rotates on the trigger's open state (`[data-panel-open]` or whatever attribute Base UI's trigger sets; read `accordion/trigger/AccordionTrigger.js` and cite it).
  - `AccordionPanel`: declares `--panel-height: var(--accordion-panel-height)` (§4.1.5). It runs `animation: var(<cssVarName('expand')>)` on its opening state and `collapse` on its ending state. Read `accordion/panel/AccordionPanel.js` and the collapsible panel for which `data-*` attributes mark those states, and cite them. `overflow: hidden` while animating.
- Tokens: `itemBorder` (`vars.color.borderSubtle`), the §4.1.10 trigger roles (`text` → `vars.color.textPrimary`, `focusRing`, `radius`), `triggerHoverBg` (`vars.color.actionBgSubtle`) and `chevron` (`vars.color.textSecondary`).
- Layout: the trigger is full width, `display: flex`, `justifyContent: space-between`, with padding from the space scale and `text.md` weight `semibold`. Hover is guarded against disabled. The chevron rotation is a **transition** on `rotate` with a duration token (Switch precedent). The panel content has inline padding.

- [ ] **Step 1: Write the failing parts tests** (`AccordionParts.test.tsx`, jsdom).
  - Two items, hand assembled. Each trigger is a button with `aria-expanded="false"`. Clicking one makes it `"true"`, and its panel has `role="region"` with an accessible name equal to the trigger text. Regression guard of Base UI wiring; say so.
  - Single-open: opening item 2 closes item 1. With `multiple`, both stay open. Perturbation: none of ours; regression guard.
  - The header is an `H3` by default, and `render={<h2 />}` makes it an `H2`.
  - **`AccordionTrigger` with `render={<Button />}`:** `type="button"`, no `role="button"`, no `console.error`. Perturbation: drop the derivation.
  - The chevron is present inside the trigger with `aria-hidden="true"`, and a `render` override does not remove it. Perturbation: render the chevron outside the owned position.
  - The panel's class sets `--panel-height`. Assert on the recipe source or the class, the way `Switch.test.tsx` asserts style rules in jsdom. Perturbation: remove the alias. If jsdom cannot see the declaration, move the assertion to Task 6's story and say so in the commit.
- [ ] **Step 2: Run and watch them fail.**
- [ ] **Step 3: Implement,** plus the `TS_EXEMPTIONS` and `optimizeDeps` entries.
- [ ] **Step 4: Run.** `npx vitest run --project unit packages/react/src/components/Accordion && npm run typecheck && npm run test:guards && npm run test:contrast && npm run test:motion`. Expected: pass.
- [ ] **Step 5: Commit.** `feat(react): add Accordion parts with aliased height motion and an owned chevron`.

---

### Task 4: The `Accordion` convenience component

**Files:**
- Create: `packages/react/src/components/Accordion/Accordion.tsx`, `Accordion.test.tsx`, `Accordion.ssr.test.tsx`, `index.ts`
- Modify: `packages/react/src/index.ts`

**Interfaces:**
- Consumes: Task 3's parts.
- Produces:
  ```ts
  export interface AccordionItem<Value extends string = string> {
    value: Value
    title: ReactNode
    content: ReactNode
    disabled?: boolean
  }
  export type AccordionProps<Value extends string = string> =
    Omit<AccordionRootProps, 'children' | 'hiddenUntilFound' | 'keepMounted'> & {
      items: ReadonlyArray<AccordionItem<Value>>
      headingLevel?: 2 | 3 | 4 | 5 | 6        // default 3
    }
  ```
  Name the item type so that it does not collide with the `AccordionItem` part. Use `AccordionEntry`, or rename the part's export; pick one, and make the barrel unambiguous. The 5c rename (`SelectItem` → `SelectOption`) is the precedent for keeping data types apart from parts. The convenience component always passes `hiddenUntilFound` and never `keepMounted`. Each item renders `Item > Header(render = <h{level}>) > Trigger(title) + Panel(content)`. `Accordion` is also the namespace: `Object.assign(AccordionBase, { Root, Item, Header, Trigger, Panel })`.
- JSDoc covers three things: `headingLevel` must fit the page outline (with the reason), closed content is in the page and found by find-in-page after hydration, and `title` should be text.

- [ ] **Step 1: Write the failing tests** (`Accordion.test.tsx`).
  - `headingLevel={2}` renders `H2` headers, and the default renders `H3`. A type test: `headingLevel={1}` → `@ts-expect-error`. Perturbation: ignore the prop.
  - A closed panel is **in the DOM** with its content and a `hidden` attribute. Perturbation: drop `hiddenUntilFound`, and the content must be absent.
  - In jsdom, after mount, a closed panel's `hidden` attribute is `"until-found"` (Base UI's layout effect). If jsdom normalises it, assert the attribute is present and move the exact-value assertion to Task 6's story. Say which in the commit.
  - **Identical DOM** against the hand assembly.
- [ ] **Step 2: Write `Accordion.ssr.test.tsx`.**
  - A closed item's content IS in the HTML, inside an element carrying `hidden`. The attribute is boolean-style (`hidden=""`), NOT `until-found`, which pins the client-only half (spec §4.5.1). Perturbation: drop `hiddenUntilFound`, and the content disappears.
  - The headers render as `<h3`.
  - The process has no DOM.
- [ ] **Step 3: Run and watch them fail.**
- [ ] **Step 4: Implement,** plus the barrel and `index.ts` exports after `Tabs`.
- [ ] **Step 5: Run.** `npx vitest run --project unit packages/react/src/components/Accordion && npm run typecheck && npm run test:guards`. Expected: pass.
- [ ] **Step 6: Commit.** `feat(react): add the Accordion convenience component with headingLevel and hidden-until-found panels`.

---

### Task 5: Tabs stories

**Files:**
- Create: `packages/react/src/components/Tabs/Tabs.stories.tsx`

Match `Popover.stories.tsx`'s shape and house style. Every story's JSDoc names its perturbation.

- [ ] **Step 1: Write the stories and their `play` functions.**
  - **`Default`** (underline, horizontal). Tab into the list and focus lands on the selected tab. ArrowRight moves focus without changing selection, and Enter selects. The panel changes.
  - **`Indicator`.** After selecting tab 3, `await waitFor` until the indicator's bounding box is horizontally aligned with tab 3: its centre within 2 px of the tab's centre, and its inline size within 2 px. This proves the transition landed. Perturbation: point the indicator at `--active-tab-right` in LTR.
  - **`Pills`** and **`Vertical`**, each with the same alignment check in its own geometry. For pills, the indicator's box matches the tab's box. For vertical underline, it matches the tab's block extent and sits at the list's inline end.
  - **`RightToLeft`** (Review Focus 4): the same Indicator check inside `<div dir="rtl">`. Perturbation: drop the `:dir(rtl)` rule.
  - **`Overflow`** (Review Focus 5): twelve tabs in a narrow container. The list's `scrollWidth > clientWidth`, and the page does not scroll horizontally. Selecting the last tab via the keyboard keeps the indicator aligned with it. Perturbation: `flexWrap: 'wrap'` or no overflow rule.
  - **`DisabledTab`** (Review Focus 2): ArrowRight from tab 1 skips the disabled tab 2 and focuses tab 3. Clicking tab 2 does not select it.
  - **`WithButtonTabs`:** `Tabs.Tab render={<Button variant=… />}` shows no console error. The story asserts that `type="button"` and `role="tab"` coexist.
  - **`HandAssembled`:** built from public parts only.
- [ ] **Step 2: Run.** `npm run test:stories && npm --prefix storybook run typecheck`. Expected: pass. An axe violation is a real finding.
- [ ] **Step 3: Commit.** `test(storybook): Tabs stories with manual activation, indicator geometry, RTL and overflow play`.

---

### Task 6: Accordion stories

**Files:**
- Create: `packages/react/src/components/Accordion/Accordion.stories.tsx`

- [ ] **Step 1: Write the stories and their `play` functions.**
  - **`Default`:** click a trigger and its panel opens. `aria-expanded` flips, the chevron's computed `rotate` changes, and then the panel is visible.
  - **`HeadingLevel`:** `headingLevel={2}` gives `getAllByRole('heading', { level: 2 })` one per item.
  - **`Motion`:** while opening, the panel's computed `animation-name` is the `expand` keyframe name (`cssKeyframeName('expand')` from `@ap/motion`), and its `--panel-height` resolves to a pixel value. Perturbation: remove the alias, and the animation must not reach the content height. Assert the end state's height equals `scrollHeight`, and name the perturbation precisely.
  - **`FindInPage`:** after hydration, a closed panel's `hidden` attribute is exactly `"until-found"`. Dispatching a `beforematch` event on it (what the browser does on a find-in-page match) opens the item. This is the real-browser proof of spec §4.5.1's client half.
  - **`HiddenFocus`** (Review Focus 3): a closed panel contains an `<input>`. Tabbing from the trigger goes to the next trigger, not into the hidden input. After opening, Tab reaches the input.
  - **`Multiple`:** two items stay open.
  - **`WithButtonTrigger`:** `Accordion.Trigger render={<Button />}` logs no console error.
  - **`HandAssembled`:** public parts, with a hand-set heading level via `Header render`.
- [ ] **Step 2: Run.** `npm run test:stories && npm --prefix storybook run typecheck`. Expected: pass.
- [ ] **Step 3: Commit.** `test(storybook): Accordion stories with motion, heading level, find-in-page and focus play`.

---

### Task 7: SSR fixture route, e2e spec and showcase

**Files:**
- Create: `fixtures/ssr-app/app/routes/disclosure.tsx`, `fixtures/ssr-app/e2e/disclosure.spec.ts`, `showcase/app/routes/disclosure.tsx`
- Modify: `fixtures/ssr-app/app/routes.ts`, `showcase/app/sections.ts`

- [ ] **Step 1: Read** `fixtures/ssr-app/app/routes/overlays.tsx`, `e2e/overlays.spec.ts` and `routes.ts`. The new route is routed in **both** modes and needs no provider. Say so accurately in its JSDoc (5d final review: the overlays route's JSDoc first gave a false reason).
- [ ] **Step 2: Write the route.** One `Tabs` (three items, `id`s on the panel content) and one `Accordion` (three items, one containing an `<input id="acc-input">`).
- [ ] **Step 3: Write `disclosure.spec.ts`,** reading server HTML from `response.text()` as `overlays.spec.ts` does.
  - The selected tab's content is in the server HTML, and the others' is not. There is no `<script` inside the tabs markup (scope it to the tabs' container).
  - The closed accordion content is in the server HTML, and the tag carrying it has `hidden` but not `until-found`.
  - After hydration, the same panel's `hidden` is `until-found`, and dispatching `beforematch` opens it.
  - After hydration, a keyboard user tabbing into the tabs and pressing ArrowRight then Enter changes the visible panel.
- [ ] **Step 4: Add the showcase section.** One `SECTIONS` entry and `routes/disclosure.tsx`, which only renders a Tabs and an Accordion.
- [ ] **Step 5: Run this fixture's suites here, not later** (5b's Critical):
  ```bash
  npm --prefix fixtures/ssr-app run typecheck
  npm run test:ssr && npm run test:spa
  npm run test:hydration
  npm --prefix showcase run typecheck && npm run showcase:test
  ```
  Expected: all pass, with every existing spec unchanged. Revert any `npm install` lockfile noise.
- [ ] **Step 6: Commit.** `feat(fixtures,showcase): Tabs and Accordion join the SSR and hydration proofs`.

---

### Task 8: Documentation

**Files:**
- Modify: `docs/CONTRIBUTING.md`, `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md`

- [ ] **Step 1: Add to CONTRIBUTING's Base UI traps,** naming the source file and line that causes each:
  1. **The Tabs indicator measures physical edges.** Explain how ours stays logical (`:dir(rtl)` swaps `--active-tab-left` for `--active-tab-right`).
  2. **`hidden="until-found"` is client-only,** and what that means for server HTML and find-in-page.
  3. **The Accordion header's heading level,** and why `headingLevel` exists.
- [ ] **Step 2: Add spec §4.5.2, "Verified during the plan".** Record each Review Focus result, the indicator's actual first-paint behaviour, the attributes Base UI uses for the panel's opening and closing states, and anything Tasks 1–7 found that contradicts §4.5.1. Every citation points at the causing line, or says "observed" and names the test.
- [ ] **Step 3: Verify and commit.** `npm run typecheck && npm run test:guards`. `docs: record Tabs and Accordion's Base UI traps and verified behaviour`.

---

### Task 9: The CI sweep and the pull request

**Files:** none expected.

- [ ] **Step 1: Run every CI step locally, in `ci.yml`'s order.** This list is `ci.yml` as of `6516e60`. If `ci.yml` has changed since, re-derive the list from it.
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
  Record the real numbers. Revert lockfile `libc` noise from the `install` steps.
- [ ] **Step 2: Stop and ask before pushing.** Once approved, push `feat/phase5e-tabs-accordion` and open a PR to `main` titled `Phase 5e: Tabs and Accordion`, with a body in the 5d PR's shape.
- [ ] **Step 3: Watch all six jobs to green.**
- [ ] **Step 4: Append "What actually happened"** to this plan, in the 5b–5d format, and commit it on the branch before merging.

---

## Verification plan

| # | Claim | Command | Must fail when… |
|---|---|---|---|
| 1 | Manual activation: arrows move focus, not selection | `npm test` (Task 1), `test:stories` | `activateOnFocus` is passed |
| 2 | Vertical sets `aria-orientation` | `npm test` (Task 1) | `orientation` isn't passed to the List |
| 3 | An unnamed Tabs does not compile | `npm run typecheck` (Task 2) | the name union is loosened |
| 4 | The first enabled item is selected by default | `npm test` (Task 2) | `items[0]` is used |
| 5 | No indicator `<script>` in server HTML | `npm test` SSR (Task 2), `test:hydration` | `renderBeforeHydration` is passed |
| 6 | The indicator aligns with the active tab in all four layouts and RTL | `test:stories` (Task 5) | the RTL swap or a geometry var is wrong |
| 7 | A crowded tab list scrolls in its own box | `test:stories` (Task 5) | the list wraps or overflows the page |
| 8 | `headingLevel` sets the header tag | `npm test` (Task 4) | the prop is ignored |
| 9 | Closed content is in server HTML under plain `hidden` | `npm test` SSR (Task 4), `test:hydration` | `hiddenUntilFound` is dropped |
| 10 | After hydration, `hidden="until-found"`, and `beforematch` opens it | `test:stories` (Task 6), `test:hydration` | (Base UI behaviour; the story is the evidence) |
| 11 | Hidden content is not tabbable | `test:stories` (Task 6) | the panel is visually hidden but not `hidden` |
| 12 | Panel height motion runs through the alias | `test:stories` (Task 6) | the alias is removed |
| 13 | A `Button` render works for Tab and Trigger | `npm test` (Tasks 1, 3) | the derivation is dropped |
| 14 | Zero axe violations | `test:stories` | a story loses a name |
| 15 | Every CI job is green | Task 9's sweep, then the PR | — |

**Final proof artifact:** a green CI run of all six jobs on the Phase 5e pull request, plus Task 9's local sweep output.

## What actually happened

Eight build tasks, then one whole-branch review and a single fix wave: 20 commits in all. Tasks 4–8 passed their first review. Tasks 1, 2 and 3 each needed one fix round, and none needed a second. The local sweep of all six `ci.yml` jobs passed on the final tree: 1564 unit tests plus every gate and `check:lockfiles`, consumer 12, SSR 7 plus SPA plus hydration 25, stories 104 plus the build, and showcase 11.

Twelve controller rulings were made (R1–R12). The ledger is gitignored, so the ones that matter for 5f–5h are recorded here. Spec §4.5.2 holds every corrected Base UI fact with its causing line.

### The plan's fact table was wrong four times

The 5d lesson (cite the causing line) was applied while writing the plan, and the facts were still wrong where the plan inferred a consequence instead of reading the code path through:

- **`Tabs.List` has no `orientation` prop (R2).** It reads orientation from root context (`TabsList.js:33-37`). Task 1's first implementer stopped with NEEDS_CONTEXT rather than cast past the type, which is the behaviour we want.
- **The RTL indicator rule was wrong (R4).** The plan placed it from `--active-tab-right`, but Base UI computes that as `scrollWidth - left - width` (`TabsIndicator.js:89`), so it was 725px off on an overflowing RTL list. The fix places it from `--active-tab-left` on the inline end. The task reviewer caught it by reading the formula. No story existed yet that could have.
- **The Accordion `collapse` never ran (R6).** The plan keyed it on the ending state. Base UI's collapsible root defers that state (`useCollapsibleRoot.js:33`), so the close-request commit found no animation and unmounted the panel (`useCollapsiblePanel.js:183-189`). It is now keyed on `[data-closed]`.
- **Disabled tabs are not skipped by arrow keys (R7).** They stay focusable (`TabsTab.js:118`) and are announced as disabled. We kept Base UI's behaviour.

**For 5f–5h: a fact table entry that states a consequence ("so pass X", "so key on Y") must cite the line that produces the consequence, not the line that defines the input.**

### jsdom cannot see vanilla-extract CSS

The unit project injects no stylesheet, so every CSS claim (the `--panel-height` alias, the collapse selector, the focus-ring clearance, indicator geometry) moved to `play` functions. Plans should put CSS-behaviour assertions in stories from the start rather than as a jsdom fallback.

### Answered during execution

- **The indicator's first paint** is a jump, not a slide in from zero width (R3). It is `hidden` until the selected tab measures more than 0 (`TabsIndicator.js:111,124`). The `Indicator` story pins it.
- **`onValueChange` can receive `null`** from Tabs' uncontrolled fallback (`TabsRoot.js:194,220`), so it is typed `Value | null`. Accordion has no such fallback, so `Value[]` is honest there.
- **Find-in-page opened disabled Accordion items.** Base UI's `beforematch` ignores `disabled`. A disabled item's panel now opts out of `hiddenUntilFound`.
- **The derived Tabs default was recomputed on every render,** and Base UI's `useControlled` logs an error when a default changes. It is now computed once.
- **Under forced colours the indicator vanished,** because it was drawn as a background only. It now draws a `Highlight` border in that mode (R9), and an e2e check uses `emulateMedia`.
- **Storybook cannot send a native Tab,** because user-event is selector-based. Review Focus 3 is proven by a `page.keyboard` Tab in the fixture e2e. The story uses a focus-acceptance helper.

### Process notes

- **R8:** as in 5d, the final review and fix wave ran before the CI sweep, so the sweep ran once.
- The session was paused once mid-Task 1. The ledger's RESUME note made the restart cost one re-dispatch.
- No implementer ran prettier.

### What is still open

- **Decisions for the human:**
  - The horizontal underline sits above the list's hairline rather than covering it.
  - `:dir()` needs Chrome 120+, above the ~2022 floor in ADR-0016/0017.
  - The Tooltip and Popover width caps, carried over from 5d.
- **Known caveats:**
  - Base UI's server HTML gives every tab `tabindex="-1"`, so the tab list isn't keyboard-reachable before hydration.
  - The Inter fallback's metrics shift the indicator about 3px on a cold first paint.
- **Deferred minors the final reviewer triaged as can-wait:**
  - The Tabs "no error on items change" test depends on Base UI's per-module warning de-duplication. It should move to its own file (R11).
  - CONTRIBUTING's "Base UI's examples put the indicator after the tabs" needs its citation, `docs/react/components/tabs.md:259-262` in the package (R12).
  - The vertical RTL underline is unproven by a story.
  - The pill's `insetBlockStart` is unpinned.
  - `TabsRoot` accepts only a string `className`, while `AccordionRoot` accepts a function.
  - Accordion `value` rejects readonly arrays.
  - The Accordion content box takes no `className` or Tier 3 padding token.
  - `tabFrom` has no guard when `from` is missing.
  - Motion story seek times are tied to the current token durations.
  - The SPA gate never requests `/disclosure`.
