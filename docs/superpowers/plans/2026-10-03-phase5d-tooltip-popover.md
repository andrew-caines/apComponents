# Phase 5d — Tooltip and Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `Tooltip` and `Popover` as convenience components over public compound parts. The Tooltip carries `role="tooltip"` and gives its trigger `aria-describedby` only while it is open. The Popover is a non-modal `role="dialog"` that cannot be left unnamed. `ApProvider` gains app-wide tooltip delay grouping.

**Architecture:** `TooltipParts.tsx` and `PopoverParts.tsx` hold thin styled wrappers over `@base-ui/react@1.7.0`, following the `SelectParts.tsx` pattern. Each `Popup` part bundles Portal and Positioner with our defaults. `Tooltip.Root` creates an id and shares it through a private context. `Tooltip.Popup` puts that id on itself, and `Tooltip.Trigger` reads Base UI's per-trigger `open` render state to add `aria-describedby`. `Tooltip.tsx` and `Popover.tsx` are the convenience components, built only from those parts.

**Tech Stack:** React 19.2, `@base-ui/react` 1.7.0, vanilla-extract, Vitest 4.1.11 (projects `unit` and `storybook`), Storybook 10.6, Playwright 1.62.1, React Router 8 (the SSR fixture).

**Spec:** `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md`. Read §4.1 (all ten shared decisions) and §4.4–§4.4.1 (this plan's scope). Also read the "What actually happened" sections of `docs/superpowers/plans/2026-09-06-phase5b-form-controls.md` and `docs/superpowers/plans/2026-09-26-phase5c-select.md` before starting any task.

**How this plan is written, deliberately:** as in 5c, **each rule is stated and the precedent file that already follows it is cited.** Code appears only where it is short and is itself the contract: type signatures, a test's exact assertion. Where a step says "match `X`", reading that file is part of the step. A deviation from a cited precedent is a review finding unless the step says otherwise.

## Global Constraints

- **Node 22.22.0** in CI. `engines.node` is `>=22.22.0`.
- **`'use client'` is the literal first line** of every `.ts`/`.tsx` under `packages/react/src`, except `index.ts` barrels, `*.css.ts`, and files in `use-client.gate.test.ts`'s `TS_EXEMPTIONS`. **Every new `*.tokens.ts` gets a `TS_EXEMPTIONS` entry** in the `join(SRC, 'components', '<Name>', '<Name>.tokens.ts')` form.
- **Relative imports carry `.js`**, even from `.tsx`. The package is `NodeNext`.
- **Every style declaration sits inside `'@layer': { [componentsLayer]: { … } }`.** State rules go in `selectors: { … }` with `&`-prefixed keys. `boxSizing: 'border-box'` goes in every recipe base. `Select.css.ts` is the nearest precedent for a positioned popup.
- **No physical CSS properties, no Tier 1 tokens, no literal `zIndex`, no suppressed outline, no `boxShadow` in `:focus-visible`.** Durations are tokens. A forbidden literal inside a comment also fails the style gate, so hyphenate it.
- **Tier 3 tokens are `tier3('<component>-<role>', <vars.* fallback>)`.** If a named `vars.*` leaf does not exist, stop and report. Do not substitute one.
- **Every user-facing string is a message key or consumer-supplied.** The only key this plan uses is the existing `close` (`providers/messages.ts`). Add none.
- **`exactOptionalPropertyTypes` is on, and Base UI's prop merge lets an explicit `undefined` win.** Spread optionals conditionally: `{...(x !== undefined ? { x } : {})}`. Never write `prop={undefined}`.
- **There is no jest-dom.** No `toHaveAttribute`, `toBeVisible` or similar in unit tests. Use `el.getAttribute(…)`. (Stories use `storybook/test`'s `expect`, which does have those matchers. The existing stories use them.)
- **Base UI defers some DOM updates.** Open, close and focus assertions use `await waitFor(…)`.
- **No dependency may be added. Never run a snapshot-update flag. Conventional commits, one or more per task.**
- **Every assertion names the change that must make it fail, `play` functions included** (5c retrospective). When a step lists a perturbation, apply it once, watch the test fail, and revert. If you cannot name one, the assertion is decoration: rewrite it.
- **Base UI facts are cited by file and line** (5c retrospective). If you find one of the facts below wrong, stop and report. Don't work around it silently.

## Base UI facts established before writing this plan

Verified by reading `node_modules/@base-ui/react/**` on 2026-10-03. Paths are relative to that directory.

| Fact | Consequence |
|---|---|
| Tooltip emits no ARIA except `aria-hidden` on its arrow (`tooltip/arrow/TooltipArrow.js:49`), and generates no popup id | We add `role="tooltip"`, the id and `aria-describedby` ourselves |
| `Tooltip.Trigger` renders through `useRenderElement('button', …)`, not `useButton`, so it has no `nativeButton` prop (`tooltip/trigger/TooltipTrigger.js`, the `useRenderElement` call near line 210) | §4.1.1's derivation does **not** apply to the tooltip trigger |
| The tooltip trigger's render state is `{ open }`, true only when **this** trigger opened it (`tooltip/trigger/TooltipTrigger.js:207-208`) | `aria-describedby` is driven by that state, so it is per trigger |
| A function `render` is called as `render(props, state)`. An element `render` is merged with `mergeProps(props, render.props)` and then gets `ref = props.ref` (`internals/useRenderElement.js:107-114`) | Our trigger's render function must reproduce the element path, including the ref (Task 1) |
| `mergeProps` is public: `@base-ui/react/merge-props` | Use it. Do not hand-roll a merge |
| Tooltip opens on hover and on focus (`useFocus`, `tooltip/trigger/TooltipTrigger.js:168-170`). Its popup is hoverable unless `disableHoverablePopup` (`tooltip/root/TooltipRoot.js:32`, `trigger/TooltipTrigger.js:149`) | Keep both defaults |
| Tooltip open delay defaults to 600 ms (`tooltip/utils/constants.js:7`). `Tooltip.Provider` takes `delay`, `closeDelay` and `timeout` (default 400) and groups delays (`tooltip/provider/TooltipProvider.js:21-23`) | The grouping story waits on real timing (Task 5) |
| `Tooltip.Positioner` defaults `side = 'top'`, `sideOffset = 0` (`tooltip/positioner/TooltipPositioner.js:29-31`). The Popover positioner defaults `side` to `'bottom'` in `internals/useAnchorPositioning.js:66` | Pass `side` and `sideOffset={POSITIONER_SIDE_OFFSET}` explicitly anyway (§4.1.7: never inherited by accident) |
| Both portals render only when `mounted \|\| keepMounted`, and `keepMounted` defaults to `false` (`tooltip/portal/TooltipPortal.js:23-28`, `popover/portal/PopoverPortal.js:23-28`) | No popup in server HTML (§4.1.9). Never set `keepMounted` |
| `Popover.Popup` sets `role="dialog"`, `aria-labelledby={titleId}` and `aria-describedby={descriptionId}` (`popover/popup/PopoverPopup.js:91-94`). The trigger sets `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls` (`popover/trigger/PopoverTrigger.js:122-124`) | A titled Popover is named by Base UI. An untitled one needs our `aria-label` |
| Focus is trapped only when `modal !== false && hasClosePart` (`popover/popup/PopoverPopup.js:76`), and `modal` defaults to `false` (`popover/root/PopoverRoot.js:26`) | The convenience component never traps |
| On open, initial focus is `true` (the first tabbable in the popup), or the popup itself on touch (`utils/popups/popupStoreUtils.js:45-46`). The focus manager is **disabled when the popover was opened by hover** (`popover/popup/PopoverPopup.js:107`) | A click-opened popover moves focus in. A hover-opened one does not |
| `FloatingFocusManager` defaults `closeOnFocusOut = true` (`floating-ui-react/components/FloatingFocusManager.js:127`), and `PopoverPopup` does not override it | Tab out of a non-modal popover closes it |
| `openOnHover`, `delay` (default 300, `popover/utils/constants.js:7`) and `closeDelay` are **trigger** props (`popover/trigger/PopoverTrigger.js:41-43`) | The convenience component routes them to `Popover.Trigger` |
| A Popover dismisses on an outside press (`popover/root/PopoverRoot.js:115`) inside a `FloatingTree` (`:94`) | Two sibling popovers cannot stay open together. A nested one can |
| `DialogDismiss` is the precedent for an icon close button: `aria-label={messages.close}` (`components/Dialog/DialogParts.tsx:180-189`) | `PopoverDismiss` matches it |

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/react/src/components/Tooltip/Tooltip.tokens.ts` | Tier 3 roles: `bg`, `text`, `border`, `shadow`, `radius` |
| `packages/react/src/components/Tooltip/Tooltip.css.ts` | Positioner `zIndex`, popup surface, type and motion |
| `packages/react/src/components/Tooltip/TooltipParts.tsx` (+ `TooltipParts.test.tsx`) | `TooltipProvider`, `TooltipRoot` (id context), `TooltipTrigger` (render-state wiring), `TooltipPopup` (Portal + Positioner + Popup, `role`, `id`) |
| `packages/react/src/components/Tooltip/Tooltip.tsx` (+ `Tooltip.test.tsx`, `Tooltip.ssr.test.tsx`) | Convenience component and namespace |
| `packages/react/src/components/Tooltip/Tooltip.stories.tsx` | Stories and `play` |
| `packages/react/src/components/Tooltip/index.ts` | Barrel |
| `packages/react/src/components/Popover/Popover.tokens.ts` | Tier 3 roles for the surface, title, description and dismiss |
| `packages/react/src/components/Popover/Popover.css.ts` | Positioner `zIndex`, popup surface, header row, title, description, dismiss, motion |
| `packages/react/src/components/Popover/PopoverParts.tsx` (+ `PopoverParts.test.tsx`) | `PopoverRoot`, `PopoverTrigger`, `PopoverPopup`, `PopoverTitle`, `PopoverDescription`, `PopoverClose`, `PopoverDismiss` |
| `packages/react/src/components/Popover/Popover.tsx` (+ `Popover.test.tsx`, `Popover.ssr.test.tsx`) | Convenience component and namespace |
| `packages/react/src/components/Popover/Popover.stories.tsx` | Stories and `play` |
| `packages/react/src/components/Popover/index.ts` | Barrel |
| `packages/react/src/providers/ApProvider.tsx` (+ `ApProvider.test.tsx`) | Wraps children in `TooltipProvider` |
| `packages/react/src/index.ts` | Exports, value then type, after `Select` |
| `packages/react/src/gates/use-client.gate.test.ts` | Two `TS_EXEMPTIONS` entries |
| `fixtures/ssr-app/app/routes/overlays.tsx`, `fixtures/ssr-app/app/routes.ts`, `fixtures/ssr-app/e2e/overlays.spec.ts` | Server-HTML absence and hydrated open, in a real browser |
| `showcase/app/sections.ts`, `showcase/app/routes/overlays.tsx` | SSR smoke section |
| `docs/CONTRIBUTING.md`, spec §4.4.2 | Traps found, verified results |

---

## Review Focus

These five inputs are implied by the spec, not exercised by any obvious test, and most likely to bite a real user. Each has its test assigned to the task that owns the code.

1. **A consumer's own `aria-describedby` on the tooltip trigger**, for example a `Button` already described by a hint. Expect the consumer's id to stay, with the tooltip's id appended while open and removed on close. Pinned in Task 1.
2. **A tooltip trigger inside a `<form>`.** Expect clicking it never to submit the form. Our render function replaces Base UI's default element, so `type="button"` has to be ours. Pinned in Task 1.
3. **A `ref` and `onClick` on the element passed as the tooltip's child** (a `Button` with its own ref and handler). Expect both to keep working: the ref receives the DOM node and the handler fires. Pinned in Task 1, against `useRenderElement.js:113-114`'s element path.
4. **A Tooltip on a disabled `Button`.** A disabled `<button>` gets no pointer events and no focus, so the tooltip cannot open. Expect the JSDoc to say so and to point at the pattern (explain the disabled state in visible copy, or wrap the button in a focusable element). Pinned in Task 2 (JSDoc) and Task 5 (a story that records the actual behaviour as an assertion).
5. **A Popover opened by hover (`openOnHover`) whose content has a link.** The focus manager is disabled for hover-opened popovers (`PopoverPopup.js:107`), so focus stays on the trigger. Expect a keyboard user who presses Enter or Space on the trigger to get a click-opened popover with focus moved in. Pinned in Task 6.

---

### Task 1: Tooltip tokens, recipe and compound parts

**Files:**
- Create: `Tooltip.tokens.ts`, `Tooltip.css.ts`, `TooltipParts.tsx`, `TooltipParts.test.tsx`, all in `packages/react/src/components/Tooltip/`
- Modify: `packages/react/src/gates/use-client.gate.test.ts` (one exemption)

**Interfaces:**
- Consumes: `POSITIONER_SIDE_OFFSET` (`internal/positioner.ts`), `mergeProps` from `@base-ui/react/merge-props`.
- Produces, each exporting its props type as `Tooltip<Part>Props`:
  - `TooltipProvider`: Base UI's `Tooltip.Provider`, re-exported unchanged.
  - `TooltipRoot`: Base UI's `Tooltip.Root` inside a private `TooltipIdContext.Provider` whose value is `useId()`. No DOM of its own.
  - `TooltipTrigger`: `forwardRef<HTMLElement>`. It takes Base UI's trigger props with **`render` narrowed to `ReactElement`** (no render function: we own the function), plus `className`. It passes Base UI a render function `(props, state) => …` that reproduces the element path (`useRenderElement.js:113-114`):
    ```ts
    const element = render ?? <button type="button" />
    const merged = mergeProps(props, element.props)
    // + ref: props.ref, + aria-describedby (below)
    return cloneElement(element, { ...merged, ref: props.ref, 'aria-describedby': describedBy })
    ```
    `describedBy` is the merged `aria-describedby`, with the context id appended (space-separated) when `state.open`, and the merged value unchanged (possibly absent) when closed. Check how the element path merges the render element's own `ref` into `props.ref` (`useRenderElement.js`, the code above line 107) and reproduce it exactly. Review Focus 3 depends on it.
  - `TooltipPopup`: renders `Tooltip.Portal > Tooltip.Positioner > Tooltip.Popup`. The positioner gets `side="top"`, `sideOffset={POSITIONER_SIDE_OFFSET}`, overridable through `positioner?: Pick<PositionerProps, 'side' | 'align' | 'sideOffset' | 'alignOffset' | 'collisionPadding'>`, filtered for `undefined` exactly as `SelectParts.tsx:161-183` does. The popup gets `role="tooltip"` and `id={useContext(TooltipIdContext)}`. **The id is not overridable**, so it is set after `...rest`. `className` and `ref` go to the popup.
- Tokens: `bg` (`vars.color.bgRaised`), `text` (`vars.color.textPrimary`), `border` (`vars.color.borderSubtle`), `shadow` (the elevation role `Select.tokens.ts:33` uses for `popupShadow`), `radius` (`vars.radius.sm`). **The theme has no inverse colour role** (`theme/contract.css.ts`), so a dark tooltip is out of scope: it would need a new Tier 2 role, the generator and the contrast gate. The raised surface plus border and shadow is what separates the tooltip from the page.
- Layout: popup `max-inline-size` capped by a space or size token (not a literal), padding-block `space['1']`, padding-inline `space['2']`, `text.sm` size and line height, the positioner at `zIndex: vars.z.tooltip`. Motion matches `Select.css.ts:157-158` (`enter.fade-rise` on `[data-open]`, `exit.fade` on `[data-ending-style]`). No arrow.

- [ ] **Step 1: Write the failing parts tests** (`TooltipParts.test.tsx`, jsdom). Open the tooltip with `fireEvent.focus` on the trigger, or by setting `defaultOpen` on the Root, then `await waitFor`. Read `Select/SelectParts.test.tsx` for shape.
  - Open: the popup has `role="tooltip"` and an `id`, and the trigger's `aria-describedby` contains that id. Perturbation: drop the `state.open` branch and the attribute must be missing.
  - Closed: the trigger has **no** `aria-describedby`. Perturbation: append the id unconditionally.
  - Review Focus 1: a trigger rendered as `<button aria-describedby="hint">` with `<p id="hint">` reads `"hint <popupId>"` while open and `"hint"` after closing. Perturbation: overwrite instead of appending.
  - Review Focus 2: inside `<form onSubmit={spy}>`, clicking the default trigger does not call `spy`, and the trigger's `type` is `"button"`. Perturbation: render `<button />` with no type.
  - Review Focus 3: `render={<button ref={r} onClick={h} />}` leaves `r.current` as the `HTMLButtonElement`, and a click calls `h`. A `ref` passed to `TooltipTrigger` itself also gets the node. Perturbation: omit `ref: props.ref` from the clone.
  - Two Roots open at once have distinct popup ids, and each trigger points only at its own. Perturbation: hoist the id out of the Root into a module constant.
  - `className` on `TooltipPopup` merges with the recipe class.
- [ ] **Step 2: Run them and watch them fail.** `npx vitest run --project unit packages/react/src/components/Tooltip`.
- [ ] **Step 3: Implement** tokens, recipe and parts, and add the `TS_EXEMPTIONS` entry. Each part's doc comment says what it adds over Base UI's part. On `TooltipTrigger`, say why `render` is element-only.
- [ ] **Step 4: Run.** `npx vitest run --project unit packages/react/src/components/Tooltip && npm run typecheck && npm run test:guards && npm run test:contrast`. Expected: pass. A contrast failure on `text` against `bg` means the fallback roles are wrong. Fix the role, never the gate.
- [ ] **Step 5: Commit.** `feat(react): add Tooltip parts with role=tooltip and open-only aria-describedby`.

---

### Task 2: The `Tooltip` convenience component and `ApProvider`

**Files:**
- Create: `packages/react/src/components/Tooltip/Tooltip.tsx`, `Tooltip.test.tsx`, `Tooltip.ssr.test.tsx`, `index.ts`
- Modify: `packages/react/src/providers/ApProvider.tsx`, `packages/react/src/providers/ApProvider.test.tsx`, `packages/react/src/index.ts`

**Interfaces:**
- Consumes: Task 1's parts.
- Produces:
  ```ts
  export interface TooltipProps extends Omit<TooltipRootProps, 'children'> {
    /** The tooltip text or markup. Never interactive content, never the only copy of a name. */
    content: ReactNode
    /** The trigger. One element, rendered THROUGH Tooltip.Trigger, so it stays one button. */
    children: ReactElement
    side?: TooltipPositionerOptions['side']
    delay?: number
    closeDelay?: number
  }
  ```
  `delay` and `closeDelay` are Base UI **trigger** props, so they go to `TooltipTrigger`. Check this against `TooltipTrigger.js:74-76` before wiring. `Tooltip` is also the namespace: `Object.assign(TooltipBase, { Provider, Root, Trigger, Popup })`, as `Select.tsx` ends.
- JSDoc covers three rules. Content is any node, but interactive content belongs in `Popover`. The tooltip **describes**, so an icon-only trigger still needs its own `aria-label`. A disabled `Button` cannot open a tooltip (Review Focus 4), and the JSDoc says what to do instead.
- `ApProvider` wraps its `IconProvider` child in `<TooltipProvider>` with no props (Base UI's defaults). Update its doc comment.

- [ ] **Step 1: Write the failing tests** (`Tooltip.test.tsx`).
  - `<Tooltip content="Delete">{<button aria-label="Delete row" />}</Tooltip>`, opened by focus: the trigger's accessible name is still "Delete row", and its description resolves to "Delete". Perturbation: render the content as the trigger's `aria-label`.
  - **Identical DOM:** the convenience output equals the hand assembly from the parts, opened the same way, with ids normalised as `Select.test.tsx` does.
  - `delay` reaches the trigger. Use fake timers: with `delay={0}`, focus opens without advancing time. Perturbation: route `delay` to the Root, where it is ignored.
  - `ApProvider`: in `ApProvider.test.tsx`, prove the provider is present. Render two adjacent tooltips inside `ApProvider` with fake timers. Hover the first and advance past the 600 ms delay, then move to the second: it opens with **no** further advance. Without `ApProvider`, the same sequence needs the full delay. If jsdom's synthetic pointer events cannot drive Base UI's hover logic, move this pair to Task 5's grouping story, and say so in the commit.
- [ ] **Step 2: Write `Tooltip.ssr.test.tsx`.** The trigger is present, **no `role="tooltip"`** in the HTML (perturbation: `keepMounted` on the portal), and **no `aria-describedby`** on the trigger tag, scoped to that tag. The process has no DOM (`typeof window === 'undefined'`).
- [ ] **Step 3: Run and watch them fail.**
- [ ] **Step 4: Implement,** plus the barrel and `index.ts` exports, after `Select`: `Tooltip`, `TOOLTIP_TOKENS`, then types `TooltipProps` and every part's props type.
- [ ] **Step 5: Run.** `npx vitest run --project unit packages/react/src/components/Tooltip packages/react/src/providers && npm run typecheck && npm run test:guards`. Expected: pass. `providers.ssr.test.tsx` must still pass unchanged, because the provider renders no DOM.
- [ ] **Step 6: Commit.** `feat(react): add the Tooltip convenience component and app-wide delay grouping`.

---

### Task 3: Popover tokens, recipe and compound parts

**Files:**
- Create: `Popover.tokens.ts`, `Popover.css.ts`, `PopoverParts.tsx`, `PopoverParts.test.tsx`, all in `packages/react/src/components/Popover/`
- Modify: `packages/react/src/gates/use-client.gate.test.ts` (one exemption)

**Interfaces:**
- Consumes: `deriveNativeButton`, `POSITIONER_SIDE_OFFSET`, `useMessages` (as `DialogParts.tsx` imports it).
- Produces, each exporting its props type as `Popover<Part>Props`:
  - `PopoverRoot`: Base UI's `Popover.Root`, re-exported. Its `modal` prop stays available on the part.
  - `PopoverTrigger`: derives `nativeButton` with `deriveNativeButton(render)` unless passed, exactly as `SelectParts.tsx:79` does (§4.1.1).
  - `PopoverPopup`: Portal + Positioner + Popup. `side="bottom"`, `sideOffset={POSITIONER_SIDE_OFFSET}`, and the same `positioner` override prop and `undefined` filter as `SelectParts.tsx:161-183`.
  - `PopoverTitle`, `PopoverDescription`: styled wrappers with a `className` merge.
  - `PopoverClose`: Base UI's `Popover.Close` with the `nativeButton` derivation.
  - `PopoverDismiss`: an icon close button matching `DialogDismiss` (`DialogParts.tsx:180-189`), with `aria-label={messages.close}` and the same icon and button recipe.
- Tokens: surface roles copied by name and fallback from `Select.tokens.ts`'s popup roles (`popupBg`, `popupBorder`, `popupShadow`, `popupRadius`, here without the `popup` prefix), plus `titleText` (`vars.color.textPrimary`), `descriptionText` (`vars.color.textSecondary`) and `focusRing` (`vars.color.focusRing`).
- Layout: popup padding `space['4']`, a header row (`display: flex`, title then the dismiss at the inline end, gap `space['2']`), title at `text.md` weight `semibold` or whatever `DialogTitle`'s recipe uses (read `Dialog.css.ts`), description at `text.sm`, `max-inline-size` from a size token, the positioner at `zIndex: vars.z.popover`, motion as in Task 1.

- [ ] **Step 1: Write the failing parts tests** (`PopoverParts.test.tsx`).
  - A hand assembly with `PopoverTitle` and `PopoverDescription`, opened by clicking the trigger: the popup has `role="dialog"` and its accessible name is the title text. Its description resolves to the description text. The trigger has `aria-expanded="true"` and `aria-haspopup="dialog"`. Perturbation: drop `PopoverTitle` and the name must be empty.
  - **Non-modal (fact rows 11-13):** open by click, then `await waitFor` focus is inside the popup. Pressing Escape closes it, and focus returns to the trigger. Perturbation: none in jsdom for Tab-out. That assertion lives in Task 6's story, because `closeOnFocusOut` needs real focus movement.
  - `PopoverTrigger` with `render={<a href="#" />}` has no `role="button"` forced onto it. Perturbation: pass `nativeButton` as `false`. Read `Button.test.tsx:96,159` for how that derivation is already pinned.
  - `PopoverDismiss` has the accessible name from `messages.close`, and overriding `close` through `LocaleProvider` changes it.
  - `className` merges on `PopoverPopup`, `PopoverTitle` and `PopoverDescription`.
- [ ] **Step 2: Run and watch them fail.**
- [ ] **Step 3: Implement** tokens, recipe and parts, and add the `TS_EXEMPTIONS` entry.
- [ ] **Step 4: Run.** `npx vitest run --project unit packages/react/src/components/Popover && npm run typecheck && npm run test:guards && npm run test:contrast`. Expected: pass.
- [ ] **Step 5: Commit.** `feat(react): add Popover parts, non-modal, with a message-keyed dismiss`.

---

### Task 4: The `Popover` convenience component

**Files:**
- Create: `packages/react/src/components/Popover/Popover.tsx`, `Popover.test.tsx`, `Popover.ssr.test.tsx`, `index.ts`
- Modify: `packages/react/src/index.ts`

**Interfaces:**
- Consumes: Task 3's parts.
- Produces:
  ```ts
  type PopoverName =
    | { title: string; 'aria-label'?: never }
    | { 'aria-label': string; title?: never }

  export type PopoverProps = Omit<PopoverRootProps, 'children' | 'modal'> & PopoverName & {
    trigger: ReactElement           // rendered THROUGH Popover.Trigger, as Dialog.tsx renders its trigger
    description?: string
    dismissible?: boolean           // default false → PopoverDismiss in the header
    openOnHover?: boolean           // → PopoverTrigger
    delay?: number                  // → PopoverTrigger
    closeDelay?: number             // → PopoverTrigger
    side?: PopoverPositionerOptions['side']
    children: ReactNode
  }
  ```
  `modal` is omitted on purpose (spec §4.4.1). `aria-label` goes to `PopoverPopup`. `Popover` is also the namespace: `Object.assign(PopoverBase, { Root, Trigger, Popup, Title, Description, Close, Dismiss })`.
- JSDoc covers two things: why a name is required, and that hover-open does not move focus, so keyboard users open it with Enter or Space (Review Focus 5).

- [ ] **Step 1: Write the failing tests** (`Popover.test.tsx`).
  - **Type tests,** with the `@ts-expect-error` comment style of `Select.test.tsx:47-80`: neither `title` nor `aria-label` → error; both → error; `modal` → error; `title` alone and `aria-label` alone → compile.
  - With `aria-label="Colour"` and no title, the open popup's accessible name is "Colour" and no heading renders. Perturbation: drop the `aria-label` routing.
  - `dismissible` renders the dismiss button, and by default there is none.
  - `openOnHover`, `delay` and `closeDelay` reach the trigger. Use fake timers with `openOnHover delay={0}`: hovering opens it with no advance. Perturbation: route them to the Root. If jsdom cannot drive the hover path, move this to Task 6's story, and say so in the commit.
  - **Identical DOM** against the hand assembly, as in Task 2.
- [ ] **Step 2: Write `Popover.ssr.test.tsx`.** No `role="dialog"` in the HTML (perturbation: `keepMounted`). The trigger carries `aria-expanded="false"`, scoped to its tag. No DOM.
- [ ] **Step 3: Run and watch them fail.**
- [ ] **Step 4: Implement,** plus the barrel and `index.ts` exports, after `Tooltip`: `Popover`, `POPOVER_TOKENS`, then `PopoverProps` and every part's props type.
- [ ] **Step 5: Run.** `npx vitest run --project unit packages/react/src/components/Popover && npm run typecheck && npm run test:guards`. Expected: pass.
- [ ] **Step 6: Commit.** `feat(react): add the Popover convenience component with a required name`.

---

### Task 5: Tooltip stories

**Files:**
- Create: `packages/react/src/components/Tooltip/Tooltip.stories.tsx`

Stories render inside `ApProvider` already (`storybook/.storybook/preview.tsx:11`). `storybook/test`'s `userEvent.hover` dispatches pointer and mouse events that Base UI's hover logic listens to. It does **not** set CSS `:hover`, which no assertion here needs.

- [ ] **Step 1: Read `Select.stories.tsx`** and match its shape: `satisfies Meta<typeof Tooltip>`, and `play` functions using `await waitFor`.
- [ ] **Step 2: Write the stories and their `play` functions.**
  - `Default`: a `Button` trigger. Focus it with `userEvent.tab()` and the tooltip appears, with the trigger's `aria-describedby` pointing at it. `Escape` closes it and removes the attribute. Perturbation: Task 1's `state.open` branch removed.
  - `IconButton`: an icon-only `Button` with `aria-label` and a tooltip. Assert the name and the description separately.
  - `Placement`: once open, the tooltip's bottom edge is at or above the trigger's top edge (`getBoundingClientRect`). Perturbation: `side="bottom"` must fail it.
  - `DelayGroup`: two adjacent triggers. Hover the first and wait for it to open, then hover the second. It opens in under 200 ms, measured with `performance.now()` around the wait. Perturbation: remove `TooltipProvider` from `ApProvider` temporarily. The second then takes about 600 ms and the assertion fails. Revert.
  - `TwoOpen`: answers the open question in spec §4.4.1. Focus one trigger with the keyboard, then hover a second. **Record what Base UI does** (one or two tooltips visible) as the assertion, and state the observed behaviour in the story's JSDoc. This is a characterisation test. Its perturbation is whatever change would flip the observed count; name it in the JSDoc.
  - `DisabledButton` (Review Focus 4): a disabled `Button` with a tooltip. Assert that hovering and focusing do not open it, which pins the documented limitation. If they *do* open it, stop and report, because the JSDoc from Task 2 would then be wrong.
- [ ] **Step 3: Run.** `npm run test:stories && npm --prefix storybook run typecheck`. Expected: pass, with the story file count up by one. An axe violation is a real finding: fix the component or story, and never silence it with a parameter.
- [ ] **Step 4: Commit.** `test(storybook): Tooltip stories with focus, placement and delay-group play`.

---

### Task 6: Popover stories

**Files:**
- Create: `packages/react/src/components/Popover/Popover.stories.tsx`

- [ ] **Step 1: Write the stories and their `play` functions.**
  - `Default`: a titled Popover with a description and an input inside. Click the trigger and focus moves into the popup (fact row 11). `Escape` closes it and focus returns to the trigger.
  - `TabOut` (fact row 12): open by click, then `userEvent.tab()` past the last focusable element in the popup. The popup closes. Perturbation: pass `modal="trap-focus"` and a `Popover.Close` in a hand-assembled variant. Focus then stays inside, which proves the assertion distinguishes the two.
  - `Unlabelled`: `aria-label` only. The dialog's accessible name is the label. Gate 5's axe scan covers it.
  - `Dismissible`: the dismiss button closes the popover.
  - `HoverInfotip` (Review Focus 5): `openOnHover`. Hovering opens it and focus stays on the trigger. Then `Escape`, focus the trigger, and press `Enter`: it opens with focus moved inside.
  - `Placement`: the popup's top edge is at or below the trigger's bottom edge. Perturbation: `side="top"`.
  - `SiblingsClose` (fact row 14): open popover A, then click popover B's trigger. A closes and B opens.
  - `HandAssembled`: built from public parts only, as `Select.stories.tsx`'s `HandAssembled` is.
- [ ] **Step 2: Run.** `npm run test:stories && npm --prefix storybook run typecheck`. Expected: pass.
- [ ] **Step 3: Commit.** `test(storybook): Popover stories with non-modal focus, hover-open and placement play`.

---

### Task 7: SSR fixture route, e2e spec and showcase

**Files:**
- Create: `fixtures/ssr-app/app/routes/overlays.tsx`, `fixtures/ssr-app/e2e/overlays.spec.ts`, `showcase/app/routes/overlays.tsx`
- Modify: `fixtures/ssr-app/app/routes.ts`, `showcase/app/sections.ts`

- [ ] **Step 1: Read** `fixtures/ssr-app/app/routes/dialog.tsx`, `fixtures/ssr-app/e2e/dialog.spec.ts` and `routes.ts`. The new route follows `dialog.tsx`: `LocaleProvider`, no loader or action, routed in **both** modes. Its JSDoc says why it is routed in both. Wrap the route in `ApProvider` only if the tooltip grouping is part of what the spec asserts. It is not, so use `LocaleProvider`, as `dialog.tsx` does, for the same reason.
- [ ] **Step 2: Write the route.** One `Tooltip` on a `Button` (`id="tip-trigger"`), and one titled `Popover` (`id="pop-trigger"`) containing an `Input`.
- [ ] **Step 3: Write `overlays.spec.ts`,** mirroring `dialog.spec.ts`:
  - The server HTML contains neither `role="tooltip"` nor `role="dialog"`, and `#tip-trigger`'s tag carries no `aria-describedby`.
  - After hydration, focusing `#tip-trigger` shows a `getByRole('tooltip')`, and the trigger's `aria-describedby` equals its id.
  - Clicking `#pop-trigger` shows a `getByRole('dialog', { name: … })` with focus inside it. `Tab` past its input closes it.
- [ ] **Step 4: Add the showcase section.** One `SECTIONS` entry and `routes/overlays.tsx`, which only renders a tooltip and a popover. Match `showcase/app/routes/select.tsx`.
- [ ] **Step 5: Run this fixture's suites here, not later** (5b's Critical):
  ```bash
  npm --prefix fixtures/ssr-app run typecheck
  npm run test:ssr && npm run test:spa
  npm run test:hydration
  npm --prefix showcase run typecheck && npm run showcase:test
  ```
  Expected: all pass, including every existing spec unchanged.
- [ ] **Step 6: Commit.** `feat(fixtures,showcase): Tooltip and Popover join the SSR and hydration proofs`.

---

### Task 8: Documentation

**Files:**
- Modify: `docs/CONTRIBUTING.md`, `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md`

- [ ] **Step 1: Add to CONTRIBUTING's Base UI traps,** naming the source file in each so it can be re-checked against a new Base UI version:
  1. **Base UI's Tooltip emits no ARIA,** and how ours adds it: the id context, the render-state wiring, and why `render` is element-only.
  2. **A Popover traps focus only with `modal !== false` and a close part,** and hover-open disables the focus manager.
  3. **`openOnHover`, `delay` and `closeDelay` are trigger props** on both Tooltip and Popover.
- [ ] **Step 2: Add spec §4.4.2, "Verified during the plan".** Record the two facts §4.4.1 left open (initial focus and `closeOnFocusOut`), the `TwoOpen` story's observed behaviour, and anything Tasks 1–7 found that contradicts §4.4.1. Correct §4.4.1's Tooltip parts list, which names Portal and Positioner although its next sentence says `Popup` bundles them. The shipped parts are `Provider`, `Root`, `Trigger` and `Popup`.
- [ ] **Step 3: Verify and commit.** `npm run typecheck && npm run test:guards`. `docs: record Tooltip and Popover's Base UI traps and verified behaviour`.

---

### Task 9: The CI sweep and the pull request

**Files:** none expected.

- [ ] **Step 1: Run every CI step locally, in `ci.yml`'s order.** This list is `ci.yml` transcribed job by job as of `de371b3`. If `ci.yml` has changed since, re-derive the list from it rather than trusting this one.
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
  Record the real numbers from each. A local `npm install` may rewrite fixture lockfiles with `libc` fields (npm-version noise). Revert that, don't commit it. `check:lockfiles` is the drift check.
- [ ] **Step 2: Stop and ask before pushing.** Once approved, push `feat/phase5d-tooltip-popover` and open a PR to `main` titled `Phase 5d: Tooltip and Popover`. The body says what shipped, names the Base UI facts this plan established, and says where each contract is asserted: unit tests for DOM, ARIA and types; `play` for focus, hover, placement and grouping; the fixture e2e for server HTML and hydration.
- [ ] **Step 3: Watch all six jobs to green.** Diagnose any failure from its logs, fix it, and report each job's result.
- [ ] **Step 4: Append "What actually happened"** to this plan, in 5b's format, and commit it on the branch.

---

## Verification plan

Ordered. Each check is a command whose output is the evidence, with the perturbation that must make it fail.

| # | Claim | Command | Must fail when… |
|---|---|---|---|
| 1 | Open tooltip: `role="tooltip"`, and the trigger is described by it | `npm test` (Task 1) | the `state.open` branch is removed |
| 2 | Closed tooltip: no `aria-describedby` | `npm test` (Task 1), `test:ssr`-style unit (Task 2) | the id is appended unconditionally |
| 3 | A consumer's `aria-describedby` survives | `npm test` (Task 1) | the merge overwrites |
| 4 | The default trigger never submits a form | `npm test` (Task 1) | `type="button"` is dropped |
| 5 | Ref and handler on the child still work | `npm test` (Task 1) | `ref: props.ref` is omitted |
| 6 | No tooltip or popover in server HTML | `npm test` SSR, `test:hydration` | `keepMounted` is added |
| 7 | `ApProvider` groups tooltip delays | `npm test` or `test:stories` (Tasks 2, 5) | the provider is removed |
| 8 | An unnamed Popover does not compile | `npm run typecheck` (Task 4) | the name union is loosened |
| 9 | Popover is non-modal: Tab out closes | `test:stories` (Task 6), `test:hydration` (Task 7) | `modal="trap-focus"` with a close part |
| 10 | Hover-open keeps focus on the trigger | `test:stories` (Task 6) | (Base UI behaviour; the story is the evidence) |
| 11 | Tooltip opens above, Popover below | `test:stories` | `side` is flipped |
| 12 | The dismiss is named from `messages.close` | `npm test` (Task 3) | a literal label is used |
| 13 | Zero axe violations | `test:stories` | a story loses its name |
| 14 | Every gate is green | `npm run test:gates` | a missing tokens exemption fails `use-client` |
| 15 | Every CI job is green | Task 9's sweep, then the PR | — |

**Final proof artifact:** a green CI run of all six jobs on the Phase 5d pull request, plus Task 9's local sweep output.
