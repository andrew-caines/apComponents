# Phase 5f — Toast and NotificationProvider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship ADR-0012's notification system: five module-level functions (`toast`, `banner`, `confirm`, `alert`, `announce`), one `NotificationProvider` that `ApProvider` mounts, a `<BannerRegion />` slot, styled `Toast` parts, and a `placement` option.

**Architecture:** One typed channel of ours (`notifications/channel.ts`) carries every call. It is a pure emitter with no DOM access. `NotificationProvider` subscribes to it in a **layout** effect and dispatches each event. Toasts go to Base UI's toast store (through `useToastManager()`), banners go to provider state read by `BannerRegion`, dialogs go to a FIFO host built on Base UI's `AlertDialog` with `Dialog`'s parts, and announcements go to two live regions. Base UI owns toast queueing, timers, pause, overflow, upsert, promise tracking, focus and dismissal.

**Tech Stack:** React 19.2, `@base-ui/react` 1.7.0 (`toast`, `alert-dialog`), vanilla-extract, `@ap/motion`, Vitest 4.1.11 (projects `unit` and `storybook`), Storybook 10.6, Playwright 1.62.1, React Router 8 (the SSR fixture).

**Spec:** `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md`. Read §4.1 (all ten shared decisions, especially §4.1.1, §4.1.5, §4.1.6, §4.1.8 and §4.1.9), §4.6 and **§4.6.1, which is this plan's scope**. Read the "What actually happened" sections of the 5b, 5c, 5d and 5e plans in `docs/superpowers/plans/` before any task.

**How this plan is written, deliberately:** as in 5c–5e, **each rule is stated, and the precedent file that already follows it is cited.** Code appears only where it is short and is itself the contract. A deviation from a cited precedent is a review finding unless the step says otherwise.

## Global Constraints

- **Node 22.22.0** in CI. `engines.node` is `>=22.22.0`.
- **`'use client'` is the literal first line** of every `.ts`/`.tsx` under `packages/react/src`, except `index.ts` barrels, `*.css.ts`, and files in `use-client.gate.test.ts`'s `TS_EXEMPTIONS`. **Every new `*.tokens.ts` gets a `TS_EXEMPTIONS` entry** in the `join(SRC, 'components', '<Name>', '<Name>.tokens.ts')` form.
- **Relative imports carry `.js`**, even from `.tsx`.
- **Every style declaration sits inside `'@layer': { [componentsLayer]: { … } }`.** State rules go in `selectors: { … }` with `&`-prefixed keys. `boxSizing: 'border-box'` goes in every recipe base.
- **No physical CSS properties** (no `left`, `right`, `top`, `bottom`, `marginLeft` and so on; the style-rules gate rejects them, even in comments, so hyphenate a forbidden word in prose). **No Tier 1 tokens, no literal `zIndex`, no suppressed outline, no `boxShadow` in `:focus-visible`.** Durations are tokens.
- **Tier 3 tokens are `tier3('<component>-<role>', <vars.* fallback>)`.** If a named `vars.*` leaf does not exist, stop and report.
- **The SSR-safety gate scans raw text, comments included** (`gates/ssr-safety.gate.test.ts`). Runtime source must not contain `window.`, `document.`, `Date.now()`, `Math.random()` or `useLayoutEffect` (use `useIsomorphicLayoutEffect` from `hooks/`). Ids come from a module counter, never from a clock or `Math.random`.
- **Development-only warnings** use a bare `process.env.NODE_ENV !== 'production'` check, never guarded by `typeof process`. `Select.tsx:267-274` is the precedent, and its comment says why.
- **Every user-facing string is a message key or consumer content.** This plan adds exactly four keys: `notifications`, `confirm`, `cancel` and `ok` (spec §4.6.1). `dismiss` already exists and labels the toast close button.
- **`exactOptionalPropertyTypes` is on.** Spread optionals conditionally. Never write `prop={undefined}`. `ApProvider.tsx` is the precedent.
- **There is no jest-dom in unit tests.** Use `el.getAttribute(…)`. Stories use `storybook/test`'s `expect`, which has the DOM matchers.
- **Base UI defers some DOM updates.** Keyboard, focus and open assertions use `await waitFor(…)`.
- **jsdom has no vanilla-extract CSS** (5e). Every assertion about layout, visibility from CSS, motion or computed style goes in a story `play` function or the fixture e2e, from the start.
- **No dependency may be added. Never run a snapshot-update flag. Never run prettier.** House style is single quotes and no semicolons.
- **Every assertion names the change that must make it fail, `play` functions included.** Apply each perturbation once, watch it fail, and revert.
- **A Base UI citation points at the line that causes the claim** (5d), and **a fact stating a consequence cites the line that produces the consequence** (5e). When the cause is unknown, write "observed" and cite the test that pins it. If a fact below is wrong, stop and report.
- **A part that takes a `render` is tested with our own `Button` as the render** (5d).
- **Hover is guarded against disabled** (`:hover:not([data-disabled])`). `Checkbox.css.ts`'s hover rule is the precedent.

## Base UI facts established before writing this plan

Verified on 2026-10-07 in `node_modules/@base-ui/react/` (1.7.0). Rows 1–10 restate spec §4.6.1. Rows 11–17 are new, found while writing this plan, and the spec does not have them yet. Task 9 adds them to §4.6.2.

| # | Fact | Consequence |
|---|---|---|
| 1 | `createToastManager` is a `Set` of listeners. `add()` only emits (`toast/createToastManager.js:12-15,25-37`) | Safe at module scope, but see row 11 |
| 2 | `ToastProvider` defaults `timeout = 5000`, `limit = 3` (`toast/provider/ToastProvider.js:24-25`) | We pass neither, and inherit both |
| 3 | `applyLimited` flags every active toast past `limit` (`toast/store.js:49`). New toasts are prepended (`:146`), so the newest stay unflagged. A limited Root is `inert` (`toast/root/ToastRoot.js:431`) and carries `data-limited` (`ToastRootDataAttributes.js:18`) | Our CSS hides `[data-limited]`. It reappears when newer toasts close |
| 4 | A timer is scheduled only when `type !== 'loading' && duration > 0` (`toast/store.js:148-151`) | `timeout: 0` never auto-dismisses |
| 5 | Root `role` is `alertdialog` for `priority: 'high'`, else `dialog` (`toast/root/ToastRoot.js:420`). A high-priority Root is `aria-hidden` while the viewport is unfocused (`:425`) | Severity maps to priority. `type` only sets `data-type` |
| 6 | The viewport is `role="region"`, `aria-live="polite"` (`toast/viewport/ToastViewport.js:185-186`). While unfocused it renders a visually hidden `role="alert"` copy of each high-priority toast's `title` and `description` (`:220-231`) | No assertive region of ours for toasts. `title` and `description` must be renderable text |
| 7 | The viewport's `aria-label` default is `'Notifications'` (`ToastViewport.js:189`), merged before `elementProps` (`:213`) | We pass `aria-label={messages.notifications}` |
| 8 | F6 focuses the viewport (`ToastViewport.js:60-69`). Escape inside a focused Root closes it (`ToastRoot.js:380-386`) | Proven in the fixture e2e |
| 9 | `swipeDirection` defaults to `['down', 'right']` (`ToastRoot.js:50`) | Set per placement |
| 10 | `ToastPortal` is `FloatingPortalLite` (`toast/portal/ToastPortal.js:20`), which returns `null` until its node exists (`utils/FloatingPortalLite.js:36-38`) | The viewport is absent from server HTML |
| 11 | **`ToastProvider` subscribes to the manager in a passive `useEffect`** (`ToastProvider.js:108-128`). React runs passive effects child-first, so a page's own `useEffect(() => toast(…), [])` fires **before** the provider above it subscribes, and is dropped | **We do not use `createToastManager`.** Our channel is subscribed in a layout effect, which runs before every passive effect, and relays to the store through `useToastManager()`. That hook returns the store's own `addToast`/`closeToast`/`promiseToast` (`toast/useToastManager.js:15-22`). This corrects spec §4.6.1's "goes straight to a module-level `createToastManager()`". The queue, timers, pause, upsert and promise handling are still Base UI's. Review Focus 1 |
| 12 | `promiseToast` updates the toast with `type: 'error'` on rejection and `timeout: errorOptions.timeout`, and **does not touch `priority`** (`toast/store.js:252-258`). An unset `timeout` falls back to the provider's 5000 (`:184`) | A raw promise error toast would be polite and auto-dismiss. Our `toast.promise` maps the error branch through the severity table. Review Focus 2 |
| 13 | A string promise option becomes `{ description }`, not `{ title }` (`toast/utils/resolvePromiseOptions.js:8-11`) | Our `toast.promise` maps strings to `{ title }` itself |
| 14 | Adding with an existing `id` updates in place and resets its timer (`toast/store.js:124-137`). Adding with the id of a toast that is still ending removes it first (`:127-128`) | `id` dedupes, as the spec says |
| 15 | Removal waits for `getAnimations()` to finish on the Root (`ToastRoot.js:106-114`, via `internals/useOpenChangeComplete.js:23-29` and `internals/useAnimationsFinished.js:45`). The ending state is `data-ending-style`, from `transitionStatus: 'ending'` (`toast/store.js:223-227`) | Exit motion keys on `&[data-ending-style]`. Unlike 5e's collapsible, nothing defers the ending state, but the story still proves it |
| 16 | `AlertDialog.Root` is `useRenderDialogRoot('alert-dialog', …)` (`alert-dialog/root/AlertDialogRoot.js:16`), which forces `modal`, `disablePointerDismissal` and `role = 'alertdialog'` (`dialog/root/useRenderDialogRoot.js:32-35`). Its other parts are the Dialog parts (`alert-dialog/index.parts.js:6-40`) | Our `DialogBackdrop`, `DialogViewport`, `DialogPopup`, `DialogTitle` and `DialogDescription` work under `AlertDialog.Root` unchanged |
| 17 | Default initial focus is the popup's first tabbable element (`utils/popups/popupStoreUtils.js:45-47`, passed at `dialog/popup/DialogPopup.js:59`). Focus returns to the element focused before open: `returnFocus = true` (`floating-ui-react/components/FloatingFocusManager.js:124`), recorded at `:365` and `:428`, read at `:479` | Our footer is Cancel then Confirm, so the default would focus **Cancel**. We pass `initialFocus` explicitly in both tones. Focus return needs no code |

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/react/src/notifications/types.ts` | Every public option type and the internal `DialogRequest` |
| `packages/react/src/notifications/channel.ts` (+ `channel.test.ts`) | The typed emitter, the event union, the id counter |
| `packages/react/src/notifications/severity.ts` (+ `severity.test.ts`) | Severity → Base UI toast options, promise option mapping |
| `packages/react/src/notifications/api.ts` (+ `api.test.ts`) | `toast`, `banner`, `confirm`, `alert`, `announce`: the public functions |
| `packages/react/src/notifications/NotificationProvider.tsx` (+ `.test.tsx`, `.ssr.test.tsx`) | Subscribes, renders the toast viewport, dialog host, live regions and banner context |
| `packages/react/src/notifications/LiveRegions.tsx` | The two announce regions |
| `packages/react/src/notifications/DialogHost.tsx` (+ `DialogHost.test.tsx`) | FIFO confirm/alert on `AlertDialog` |
| `packages/react/src/notifications/index.ts` | Barrel |
| `packages/react/src/internal/visuallyHidden.css.ts` | One shared visually-hidden class (none exists yet) |
| `packages/react/src/components/Toast/Toast.tokens.ts`, `Toast.css.ts` | Tier 3 roles, the viewport placement recipe, the root recipe and motion |
| `packages/react/src/components/Toast/ToastParts.tsx` (+ `ToastParts.test.tsx`) | `ToastViewport`, `ToastRoot`, `ToastTitle`, `ToastDescription`, `ToastAction`, `ToastClose` |
| `packages/react/src/components/Toast/ToastList.tsx` | Renders the store's toasts with the parts (internal, used by the provider) |
| `packages/react/src/components/Toast/Toast.stories.tsx`, `index.ts` | Stories, barrel |
| `packages/react/src/components/Banner/Banner.tokens.ts`, `Banner.css.ts`, `BannerRegion.tsx` (+ `BannerRegion.test.tsx`), `Banner.stories.tsx`, `index.ts` | The banner slot |
| `packages/react/src/notifications/Notifications.stories.tsx` | Confirm, alert and announce stories |
| `packages/react/src/icons/paths.ts` | Two icons: `check-circle`, `alert-triangle` |
| `packages/react/src/providers/messages.ts` | Four keys |
| `packages/react/src/providers/ApProvider.tsx` (+ test) | Mounts `NotificationProvider`, the additive `notifications` prop |
| `packages/react/src/index.ts` | Exports |
| `packages/react/src/gates/use-client.gate.test.ts` | Two `TS_EXEMPTIONS` entries |
| `vitest.config.ts` | Pre-bundle `@base-ui/react/toast` and `@base-ui/react/alert-dialog` for the storybook project |
| `fixtures/ssr-app/app/routes/notifications.tsx`, `routes.ts`, `e2e/notifications.spec.ts` | Server HTML and real-keyboard proofs |
| `showcase/app/sections.ts`, `showcase/app/routes/notifications.tsx` | SSR smoke section |
| `docs/CONTRIBUTING.md`, spec §4.6.2 | Traps found, verified results |

---

## Review Focus

These five inputs are implied by the spec, not exercised by any obvious test, and most likely to bite a real user. Each has its test in the task that owns the code.

1. **A `toast()` from a page's own mount effect.** `useEffect(() => { toast.success('Signed in') }, [])` in a route component. Base UI's provider subscribes in a passive effect that runs after its children's (fact 11), so the spec's design drops this toast silently. Expect it to show. Pinned in Task 3 (unit) and Task 8 (fixture route).
2. **`toast.promise` that rejects.** Base UI marks it `type: 'error'` but leaves it polite and on a 5 s timer (fact 12), which breaks ADR-0012's "errors never auto-dismiss". A string option would also land in the description with no title (fact 13). Expect the error toast to be high priority, persistent, and titled. Pinned in Task 1 (mapping) and Task 3 (rendered, fake timers).
3. **Two providers in one tree.** Storybook's preview wraps every story in `ApProvider`, and an app can nest `ApProvider` for a themed subtree. Two subscribed providers render every toast twice and every dialog twice. Expect the inner provider to render only its children. Pinned in Task 3.
4. **`confirm()` called twice before the first is answered,** as with a double-clicked Delete. And **the provider unmounting with dialogs pending,** as on route change. Expect the second to open after the first closes, each promise to resolve with its own answer, and every pending promise to resolve `false` on unmount instead of hanging. Pinned in Task 4.
5. **A `*-start` placement, or any placement in a right-to-left page.** `toast.slide-in` and `toast.slide-out` animate a physical `translateX(100%)` (`packages/motion/src/motions.ts:119-131`), and spec §4.1.5 forbids adding motions. Expect a toast never to fly in from the edge opposite its placement. Pinned in Task 2 (CSS) and Task 6 (a placement × direction story).

---

### Task 1: Messages, icons, the channel and the public functions

**Files:**
- Create: `packages/react/src/notifications/types.ts`, `channel.ts`, `channel.test.ts`, `severity.ts`, `severity.test.ts`, `api.ts`, `api.test.ts`
- Modify: `packages/react/src/providers/messages.ts`, `packages/react/src/icons/paths.ts`

**Interfaces:**
- Produces (the contract every later task uses):
  ```ts
  // types.ts: plain types only, imported with `import type` by every other module
  export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'
  export interface NotificationAction { label: string; onClick: () => void }
  export interface ToastOptions {
    title: string
    description?: string
    severity?: NotificationSeverity        // default 'info'
    action?: NotificationAction
    id?: string
    timeout?: number                       // ignored when severity is 'error'
  }
  export type ToastPromiseOption<T> = string | Omit<ToastOptions, 'id'> | ((value: T) => string | Omit<ToastOptions, 'id'>)
  export interface ToastPromiseOptions<T> { loading: ToastPromiseOption<void>; success: ToastPromiseOption<T>; error: ToastPromiseOption<unknown> }
  export interface BannerOptions { title: string; description?: string; severity?: NotificationSeverity; action?: NotificationAction; id?: string; dismissible?: boolean }
  export interface ConfirmOptions { title: string; description?: string; confirmLabel?: string; cancelLabel?: string; tone?: 'default' | 'danger' }
  export interface AlertOptions { title: string; description?: string; okLabel?: string }
  export type DialogRequest =
    | { type: 'confirm'; id: string; options: ConfirmOptions; resolve: (ok: boolean) => void }
    | { type: 'alert'; id: string; options: AlertOptions; resolve: () => void }
  export interface AnnounceOptions { politeness?: 'polite' | 'assertive' }

  // severity.ts
  /** Base UI add-options. error → priority 'high', timeout 0, always. Else priority 'low', timeout ?? 5000. */
  export function toBaseToast(options: ToastOptions): ToastManagerAddOptions<object>
  /** For toast.promise: a string becomes { title }. The error branch is forced through severity 'error'. */
  export function toPromiseOptions<T>(options: ToastPromiseOptions<T>): ToastManagerPromiseOptions<T, object>

  // channel.ts
  export type NotificationEvent =
    | { kind: 'toast'; options: ToastOptions & { id: string } }
    | { kind: 'toast-close'; id?: string }
    | { kind: 'toast-promise'; promise: Promise<unknown>; options: ToastManagerPromiseOptions<unknown, object> }
    | { kind: 'banner'; options: BannerOptions & { id: string } }
    | { kind: 'banner-close'; id: string }
    | { kind: 'dialog'; request: DialogRequest }
    | { kind: 'announce'; message: string; politeness: 'polite' | 'assertive' }
  /** Returns true when at least one listener received the event. */
  export function emit(event: NotificationEvent): boolean
  export function subscribe(listener: (event: NotificationEvent) => void): () => void
  export function nextId(prefix: 'toast' | 'banner' | 'dialog'): string   // `ap-${prefix}-${n}`, module counter
  export function warnDropped(fn: string): void   // dev-only console.warn naming the function

  // api.ts
  type SeverityShortcut = (titleOrOptions: string | Omit<ToastOptions, 'severity'>) => string
  export const toast: ((options: ToastOptions) => string) & {
    info: SeverityShortcut
    success: SeverityShortcut
    warning: SeverityShortcut
    error: SeverityShortcut
    promise<T>(promise: Promise<T>, options: ToastPromiseOptions<T>): Promise<T>
    close(id?: string): void
  }
  export function banner(options: BannerOptions): { id: string; close(): void }
  export function confirm(options: ConfirmOptions): Promise<boolean>
  export function alert(options: AlertOptions): Promise<void>
  export function announce(message: string, options?: AnnounceOptions): void
  ```
- **Dropped calls.** Each function emits. When `emit` returns `false`, it calls `warnDropped('<name>')`. Then `confirm` resolves `false`, `alert` resolves, `toast` still returns its id, and `toast.promise` still returns the caller's promise.
- **`toast.promise` returns the caller's promise unchanged.** Rejections still reject for the caller, and the toast is a side channel.
- Messages: add `notifications: 'Notifications'`, `confirm: 'Confirm'`, `cancel: 'Cancel'`, `ok: 'OK'` to `DEFAULT_MESSAGES`, after `dismiss`.
- Icons: add `'check-circle': 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 12l3 3 5-6'` and `'alert-triangle': 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01'`. Update the file's "five icons" comment to say which component renders the two new ones. `Icon.test.tsx` iterates `ICON_PATHS`, so the new entries are covered.
- JSDoc on every function says that it is **client-only**, that a call with no `NotificationProvider` mounted is dropped (with what it returns), and, on `announce`, that `'assertive'` is for errors only (ADR-0012).

- [ ] **Step 1: Write the failing tests.**
  - `severity.test.ts`: for each severity, `toBaseToast` gives `type` equal to the severity and the right `priority`. `error` with `timeout: 9000` still gives `timeout: 0` (perturbation: let the caller's timeout win). `info` with `timeout: 9000` gives 9000, and with none gives 5000. `action` becomes `actionProps: { children: label, onClick }`. `toPromiseOptions` maps `'Saved'` to `{ title: 'Saved' }` (perturbation: pass the string through), and maps the error branch, given as a string, an object or a function, to `priority: 'high', timeout: 0` (perturbation: map only the object form).
  - `channel.test.ts`: `emit` with no listener returns `false`. With one it returns `true` and delivers the event. Unsubscribe stops delivery. `nextId` values are distinct.
  - `api.test.ts`, with no provider, using `vi.spyOn(console, 'warn')`: `confirm()` resolves `false` and warns once, naming `confirm`. `alert()` resolves. `toast()` returns a string id and warns. With a listener subscribed through `channel.subscribe`, `toast.error('x')` emits a `toast` event with severity `error` and no warning (perturbation: drop the `emit` result check, and the no-provider test warns nothing). `toast.close()` emits `toast-close` with no id. `banner().close()` emits `banner-close` with the banner's id.
- [ ] **Step 2: Run them and watch them fail.** `npx vitest run --project unit packages/react/src/notifications`.
- [ ] **Step 3: Implement** the four modules, the messages and the icons.
- [ ] **Step 4: Run.** `npx vitest run --project unit packages/react/src/notifications packages/react/src/icons packages/react/src/providers && npm run typecheck && npm run test:guards`. Expected: pass. If `no-hardcoded-strings` flags a default label, the label must come from `useMessages()` at render time in Task 4, not from `api.ts`.
- [ ] **Step 5: Commit.** `feat(react): add the notification channel and the toast, banner, confirm, alert and announce functions`.

---

### Task 2: Toast tokens, recipes and parts

**Files:**
- Create: `Toast.tokens.ts`, `Toast.css.ts`, `ToastParts.tsx`, `ToastParts.test.tsx`, `ToastList.tsx`, all in `packages/react/src/components/Toast/`, and `packages/react/src/internal/visuallyHidden.css.ts`
- Modify: `packages/react/src/gates/use-client.gate.test.ts` (one exemption), `vitest.config.ts` (add `@base-ui/react/toast` and `@base-ui/react/alert-dialog` to the storybook project's `optimizeDeps.include`)

**Interfaces:**
- Consumes: `deriveNativeButton` (`internal/deriveNativeButton.ts`), `Icon`, `Spinner`, `useMessages`, `cssVarName` from `@ap/motion` (as `Dialog.css.ts:20-21` uses it). From Task 1: `NotificationSeverity`.
- Produces:
  ```ts
  export type ToastPlacement = 'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end'
  export interface ToastViewportProps extends BaseToast.Viewport.Props { placement?: ToastPlacement }  // default 'bottom-end'
  export const ToastViewport, ToastRoot, ToastTitle, ToastDescription, ToastAction, ToastClose
  // each exports Toast<Part>Props
  export function ToastList(props: { placement: ToastPlacement }): JSX.Element  // internal, not exported from the package
  export const visuallyHiddenClass: string
  ```
  - `ToastViewport`: Base UI's viewport with `aria-label={messages.notifications}` placed **before** `{...rest}`, so a caller can still override it (`DialogDismiss` is the precedent). It takes the placement recipe class.
  - `ToastRoot`: Base UI's root with the root recipe. `swipeDirection` defaults from placement, see below.
  - `ToastAction`, `ToastClose`: derive `nativeButton ?? deriveNativeButton(render)`, as `PopoverParts.tsx`'s trigger does. `ToastClose` renders `<Icon name="close" />` and takes `aria-label={messages.dismiss}` before `{...rest}`.
  - `ToastList`: inside a Base UI provider, maps `useToastManager().toasts` to `ToastRoot > [severity icon] + ToastTitle + ToastDescription? + ToastAction? + ToastClose`. The severity icon is **owned** by the list (the `AccordionTrigger` chevron precedent). It is `info`, `check-circle`, `alert-triangle` or `alert-circle` for the four severities, and a decorative `Spinner` for `type: 'loading'`. It is decorative, because the title carries the meaning (spec §4.6.1).
- Tokens (`TOAST_TOKENS`): `bg` (`vars.color.bgRaised`), `text` (`vars.color.textPrimary`), `textSecondary` (`vars.color.textSecondary`), `border` (`vars.color.borderSubtle`), `radius` (`vars.radius.md`), `shadow` (`vars.shadow['2']`), `padding` (`vars.space['4']`), `gap` (`vars.space['3']`), `margin` (`vars.space['4']`, the viewport's distance from the edge), `width` (`'22rem'`, a cap like `Dialog`'s `sizeMd`), and one accent per severity: `accentInfo` (`vars.color.infoBorder`), `accentSuccess` (`successBorder`), `accentWarning` (`warningBorder`), `accentError` (`dangerBorder`), plus `iconInfo/Success/Warning/Error` from the matching `*Text` roles. Run `npm run test:contrast`.
- Layout and placement:
  - **Viewport:** `position: fixed`, `zIndex: vars.z.toast`, `display: flex`, `gap`, `inlineSize: min(<width>, 100% - 2 * <margin>)` written with `calc`, no `margin` of its own. The `placement` variant sets logical insets only: `insetBlockStart` or `insetBlockEnd`, then `insetInlineStart`, `insetInlineEnd`, or, for `*-center`, `insetInline: 0` with `marginInline: auto`. Bottom placements use `flexDirection: column-reverse` and top use `column`, because Base UI prepends new toasts (fact 3), so the newest sits nearest the edge. Empty, the viewport takes no space and catches no clicks.
  - **Root:** `bg`, `text`, a real **1px solid `border`** on every side, plus `borderInlineStartWidth` of 4px in the severity accent through `&[data-type="info"]` and the rest. The real border is what keeps the toast visible under `forced-colors` (5e R9). Add a grid of icon, text column and buttons. Focus-visible ring per `Input.css.ts`.
  - **`&[data-limited] { display: 'none' }`** (fact 3).
  - **Motion (Review Focus 5):** entry is a base `animation`, so it runs on insertion. Exit is on `&[data-ending-style]` (fact 15). Which motion to use:
    - **`*-end` placements:** `toast.slide-in` and `toast.slide-out`. Under `:dir(rtl)`, these use `enter.fade-rise` and `exit.fade` instead, because the slide is physically rightward.
    - **`*-start` and `*-center`:** `enter.fade-rise` and `exit.fade` in both directions.

    No new motion is added (§4.1.5). Give the placement to the Root as a `data-placement` attribute so the root recipe can key on it.
  - **Swipe:** while `[data-swiping]`, the motion is off. An ending toast with `[data-swipe-direction]` uses `exit.fade` and keeps its drag offset through `translate: var(--toast-swipe-movement-x) var(--toast-swipe-movement-y)`. Read `ToastRoot.js:406-416` and cite it.
  - **Swipe directions by placement:** the nearest inline edge plus the nearest block edge. `*-end` is `['right', <block>]` in LTR, `*-start` is `['left', <block>]`, and `*-center` is the block edge only. In RTL the inline direction flips. `ToastList` reads direction once after mount from the viewport element's `getComputedStyle(el).direction`. The SSR gate forbids `window.` but not this global. The result is pinned in Task 6's story, because jsdom does not compute `direction`.
- `visuallyHiddenClass`: the standard clip pattern (`position: absolute`, `inlineSize: 1px`, `blockSize: 1px`, `overflow: hidden`, `clipPath: inset(50%)`, `whiteSpace: nowrap`, `margin: -1px`, `padding: 0`, `border: 0`), in the components layer.

- [ ] **Step 1: Write the failing parts tests** (`ToastParts.test.tsx`, jsdom). Render inside `<BaseToast.Provider>` with a small harness component that calls `useToastManager().add(…)` from a button click.
  - The viewport has `role="region"` and its accessible name equals `DEFAULT_MESSAGES.notifications`, and a `messages={{ notifications: 'Avisos' }}` `LocaleProvider` changes it. Perturbation: put `{...rest}` before `aria-label`, or hardcode the label.
  - A rendered error toast's Root has `role="alertdialog"`, `data-type="error"`, and a `svg` whose `d` is `ICON_PATHS['alert-circle']`. An info toast has `role="dialog"` and the `info` path. Perturbation: swap two icon mappings.
  - A `type: 'loading'` toast renders the spinner, not a severity icon.
  - `ToastClose` has the accessible name `DEFAULT_MESSAGES.dismiss`, and clicking it removes the toast. Use `waitFor`, and set `globalThis.BASE_UI_ANIMATIONS_DISABLED = true` in this file's setup (`internals/useAnimationsFinished.js:40`) so removal is immediate in jsdom. Say why in a comment.
  - **`ToastClose` and `ToastAction` with `render={<Button />}`:** `type="button"`, no `role="button"`, no `console.error`. Perturbation: drop the derivation.
  - The action button's text is the action label, and clicking it calls `onClick`.
  - `placement` reaches the recipe: the viewport carries `toastViewportRecipe({ placement: 'top-start' })`'s class, compared differentially against `bottom-end`. Perturbation: ignore the prop.
  - `className` merges on every styled part.
- [ ] **Step 2: Run them and watch them fail.** `npx vitest run --project unit packages/react/src/components/Toast`.
- [ ] **Step 3: Implement** tokens, recipes, parts, `ToastList` and `visuallyHidden.css.ts`. Add the `TS_EXEMPTIONS` and `optimizeDeps` entries. Each part's doc comment says what it adds over Base UI's.
- [ ] **Step 4: Run.** `npx vitest run --project unit packages/react/src/components/Toast && npm run typecheck && npm run test:guards && npm run test:contrast && npm run test:motion`. Expected: pass.
- [ ] **Step 5: Commit.** `feat(react): add styled Toast parts with placement, severity icons and logical motion`.

---

### Task 3: `NotificationProvider`, live regions and `ApProvider`

**Files:**
- Create: `packages/react/src/notifications/NotificationProvider.tsx`, `NotificationProvider.test.tsx`, `NotificationProvider.ssr.test.tsx`, `LiveRegions.tsx`, `index.ts`
- Modify: `packages/react/src/providers/ApProvider.tsx`, `ApProvider.test.tsx`, `packages/react/src/index.ts`

**Interfaces:**
- Consumes: Task 1's channel and types, Task 2's `ToastViewport` and `ToastList`, `useIsomorphicLayoutEffect`, `visuallyHiddenClass`. `DialogHost` arrives in Task 4 and `BannerContext` in Task 5. Leave a typed slot for each, and add it in its task.
- Produces:
  ```ts
  export interface NotificationProviderProps { placement?: ToastPlacement; children: ReactNode }
  export function NotificationProvider(props: NotificationProviderProps): JSX.Element
  // ApProvider gains:  notifications?: { placement?: ToastPlacement }
  ```
- **Structure:** `<BaseToast.Provider>` wraps an inner `Relay` component and the children. `Relay` calls `useToastManager()` and subscribes to the channel in **`useIsomorphicLayoutEffect`** (fact 11). It handles `toast` with `add(toBaseToast(o))`, `toast-close` with `close(id)`, `toast-promise` with `promise(…)`, `announce` by writing to the live regions' state, and passes the rest to Tasks 4 and 5. The children render after `Relay`. `<BaseToast.Portal><ToastViewport placement><ToastList/></ToastViewport></BaseToast.Portal>` is rendered too.
- **Nesting (Review Focus 3):** a private `NotificationContext`. A provider that finds an ancestor renders `{children}` only, with a development warning, once per mount.
- **`LiveRegions`:** two `div`s with `visuallyHiddenClass`, one `aria-live="polite"` and one `aria-live="assertive"`, both `aria-atomic="true"`, rendered empty. Their text is React state. An announcement sets the region's text to `''`, then sets the message in a `requestAnimationFrame` callback, so repeated text re-announces. A `setTimeout` of 5000 ms clears it. Pending frames and timers are cancelled on unmount. Never write the DOM directly.
- `ApProvider` wraps its children in `NotificationProvider` **inside** `IconProvider`, because the dialog host and toasts read messages and icons. Pass `placement` only when given. Update its doc comment: the fourth provider has arrived, with one optional additive prop (spec §4.6.1). `BaseTooltip.Provider` stays innermost.
- Exports in `index.ts`, after `Accordion`: `toast`, `banner`, `confirm`, `alert`, `announce`, `NotificationProvider`, `Toast` (the parts namespace, `Object.assign({}, { Viewport, Root, Title, Description, Action, Close })` or the precedent shape `Dialog.tsx` uses), `TOAST_TOKENS`, then the types `ToastOptions`, `ToastPromiseOptions`, `ToastPromiseOption`, `ToastPlacement`, `NotificationSeverity`, `NotificationAction`, `BannerOptions`, `ConfirmOptions`, `AlertOptions`, `AnnounceOptions`, `NotificationProviderProps`, and every `Toast<Part>Props`. `ToastList` stays internal.

- [ ] **Step 1: Write the failing tests** (`NotificationProvider.test.tsx`). Wrap in `LocaleProvider`, and set `BASE_UI_ANIMATIONS_DISABLED` as in Task 2.
  - **Spec verification #13:** after mount, a module-scope `toast({ title: 'Saved' })` (call `act`) renders a dialog named "Saved". Perturbation: render no `Relay`.
  - **Review Focus 1:** a child whose own `useEffect` calls `toast({ title: 'From mount' })` on first render shows that toast. Perturbation: subscribe in `useEffect` instead of the layout effect.
  - **Spec verification #12** (fake timers): `toast.error('Failed')` and `toast.info('Note')`. After 6000 ms advanced, "Failed" is present and "Note" is gone. Perturbation: let `error` take the 5000 default.
  - **Review Focus 2** (fake timers): `toast.promise(Promise.reject(new Error()), { loading: 'Saving', success: 'Saved', error: 'Could not save' })`. Catch the returned promise. The toast titled "Could not save" has `role="alertdialog"` and is still present after 6000 ms. Perturbation: pass the options to Base UI unmapped.
  - `toast({ id: 'a', title: 'One' })` then `toast({ id: 'a', title: 'Two' })` leaves one toast, titled "Two".
  - Four info toasts leave three without `data-limited` and one with it. The newest is unflagged.
  - **Review Focus 3:** `<NotificationProvider><NotificationProvider>…` and one `toast()` gives exactly one rendered toast and one pair of live regions. Perturbation: remove the context check.
  - `announce('Saved')` puts "Saved" in the polite region after a frame. Advance timers and flush `requestAnimationFrame`. `announce('Failed', { politeness: 'assertive' })` targets the assertive region. Announcing "Saved" twice clears and re-sets the text, so the region is observed as `''` between the two. After 5000 ms it is empty. Perturbation: set the text directly with no clear.
  - Unmounting cancels pending frames and timers, with no React "update on unmounted" error.
  - `ApProvider` (in `ApProvider.test.tsx`): with `notifications={{ placement: 'top-center' }}`, the viewport carries the `top-center` class. Without the prop, existing tests pass unchanged.
- [ ] **Step 2: Write `NotificationProvider.ssr.test.tsx`** (`renderToString`, no DOM, following `LocaleProvider.ssr.test.tsx`).
  - The HTML contains two empty `aria-live` regions, and no `role="region"` toast viewport, no `alertdialog` and no `Notifications` label. Perturbation: render the viewport outside the portal.
  - `ApProvider`'s server HTML gains only those two regions. Every existing `providers.ssr.test.tsx` assertion holds.
- [ ] **Step 3: Run and watch them fail.**
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run.** `npx vitest run --project unit packages/react/src/notifications packages/react/src/providers packages/react/src/components/Toast && npm run typecheck && npm run test:guards`. Expected: pass.
- [ ] **Step 6: Commit.** `feat(react): add NotificationProvider with a layout-effect relay, live regions, and ApProvider placement`.

---

### Task 4: `confirm()` and `alert()` on `AlertDialog`

**Files:**
- Create: `packages/react/src/notifications/DialogHost.tsx`, `DialogHost.test.tsx`
- Modify: `packages/react/src/notifications/NotificationProvider.tsx`

**Interfaces:**
- Consumes: `DialogRequest`, `ConfirmOptions`, `AlertOptions` (Task 1). `DialogBackdrop`, `DialogViewport`, `DialogPopup`, `DialogHeader`, `DialogHeadings`, `DialogTitle`, `DialogDescription` and `DialogFooter` from `components/Dialog/DialogParts.js` (fact 16). `Button` with `tone="danger"`. `AlertDialog` from `@base-ui/react/alert-dialog`.
- Produces: `DialogHost` (internal). The provider passes it each `dialog` event.
- **Queue (Review Focus 4):** state is `DialogRequest[]`. The head is the open dialog. Answering resolves the head's promise **at once**, then sets `open` to false. The head is shifted from the queue in `onOpenChangeComplete(false)`, so the exit motion finishes before the next one opens. On unmount, every request still in the queue resolves `false` (or resolves, for `alert`).
- **Rendering:** `AlertDialog.Root open onOpenChange onOpenChangeComplete` > `AlertDialog.Portal` (Base UI's portal; Dialog's has no wrapper) > `DialogBackdrop` + `DialogViewport` > `DialogPopup size="fit" layout="dialog"` > header (title, description) + footer. There is no `DialogDismiss`. Confirm's footer is `[Cancel (variant outline)] [Confirm (tone danger if tone is 'danger')]`. Alert's footer is `[OK]`. Each button is an `AlertDialog.Close render={<Button …/>}`, or a plain `Button` that calls the handler. Pick one, and test it with our `Button` either way.
- **Focus (fact 17):** `initialFocus` is a ref to Confirm, or to Cancel when `tone: 'danger'`, or to OK. Return focus is Base UI's default, with no code.
- **Escape** goes through `onOpenChange(false, …)` and resolves `false`. An outside click cannot dismiss (fact 16).
- Labels come from `options.*Label ?? messages.confirm / cancel / ok`.

- [ ] **Step 1: Write the failing tests** (`DialogHost.test.tsx`, through `NotificationProvider`, animations disabled).
  - `confirm({ title: 'Delete record?' })` opens a dialog with `role="alertdialog"`, named "Delete record?". Clicking Confirm resolves `true`. A second call answered with Cancel resolves `false`.
  - Escape resolves `false`. Perturbation: resolve only from the buttons.
  - Initial focus is on Confirm by default, and on Cancel with `tone: 'danger'`. Perturbation: omit `initialFocus`, and the default case must fail (fact 17).
  - The danger Confirm carries `buttonRecipe({ tone: 'danger', … })`'s class.
  - **Review Focus 4:** two `confirm()` calls in one tick show one dialog. Answering it `true` opens the second, and answering that `false` resolves the two promises `true` and `false`, respectively. Perturbation: render every queued request.
  - **Review Focus 4:** unmounting the provider with two pending calls resolves both `false` (`await` them; the test must not time out).
  - Focus returns to the button that triggered `confirm()` after closing. Perturbation: pass `finalFocus={false}`.
  - `alert({ title: 'Saved' })` has one button named `DEFAULT_MESSAGES.ok`, and resolves on click.
  - `confirmLabel: 'Delete'` replaces the default label.
- [ ] **Step 2: Run and watch them fail.**
- [ ] **Step 3: Implement,** and wire `DialogHost` into the provider.
- [ ] **Step 4: Run.** `npx vitest run --project unit packages/react/src/notifications && npm run typecheck && npm run test:guards`. Expected: pass.
- [ ] **Step 5: Commit.** `feat(react): add promise-based confirm and alert on AlertDialog with a FIFO queue`.

---

### Task 5: `BannerRegion` and `banner()`

**Files:**
- Create: `Banner.tokens.ts`, `Banner.css.ts`, `BannerRegion.tsx`, `BannerRegion.test.tsx`, `index.ts`, all in `packages/react/src/components/Banner/`
- Modify: `packages/react/src/notifications/NotificationProvider.tsx`, `packages/react/src/gates/use-client.gate.test.ts` (one exemption), `packages/react/src/index.ts`

**Interfaces:**
- Consumes: `BannerOptions` (Task 1), the provider's private context, `Icon`, `Button`, `useMessages`.
- Produces: `BannerRegion` (props: `className?`), `BANNER_TOKENS`, and the type `BannerRegionProps`. Export them after the notification exports.
- **Provider side:** banner state is `Array<BannerOptions & { id: string }>`. A `banner` event replaces the entry with the same `id` in place, or appends one. `banner-close` removes it. The context also exposes `registerRegion(): () => void`, a counter. `BannerRegion` calls it in a layout effect.
- **Fallback:** on a `banner` event, if no region is registered, the provider warns in development and adds a toast with the same `title`, `description`, `severity`, `action` and `id`. `banner-close` then also closes the toast with that id.
- **Markup:** `BannerRegion` renders a `div` wrapper, which is always present (empty on the server; spec §4.6.1 SSR). Each banner is a `div` with `role="status"` for info, success and warning, or `role="alert"` for error, holding a decorative severity icon (the same mapping as toasts), the title, the description, the optional action as `Button variant="outline" size="sm"`, and, when `dismissible` is not `false`, a close button with `aria-label={messages.dismiss}`. **Not a portal.**
- Tokens: `bg<Severity>` from `*BgSubtle`, `border<Severity>` from `*Border` (`dangerBorder` for error), `icon<Severity>` from `*Text`, `text` (`textPrimary`), `radius`, `padding`, `gap`. Each banner has a real 1px border (forced colours), and the region stacks banners with a gap. Run `npm run test:contrast`.

- [ ] **Step 1: Write the failing tests** (`BannerRegion.test.tsx`, through `NotificationProvider` + `BannerRegion`).
  - `banner({ title: 'Maintenance tonight' })` renders inside the region with `role="status"`. `severity: 'error'` gives `role="alert"`. Perturbation: one role for all.
  - The same `id` twice gives one banner with the second title, in the original position. New ids append.
  - The close button removes it. `dismissible: false` renders no close button. `banner().close()` removes it.
  - **Fallback:** with no `BannerRegion`, `banner({ title: 'X', severity: 'warning' })` warns once and renders a toast titled "X" with `data-type="warning"`. Its `close()` closes that toast. Perturbation: drop the region check.
  - The region is not portalled: it is a DOM descendant of the element it is rendered in.
  - SSR (add to `NotificationProvider.ssr.test.tsx`): a `BannerRegion` renders its empty wrapper and no `role="status"`.
- [ ] **Step 2: Run and watch them fail.**
- [ ] **Step 3: Implement,** plus the exemption and the exports.
- [ ] **Step 4: Run.** `npx vitest run --project unit packages/react/src/components/Banner packages/react/src/notifications && npm run typecheck && npm run test:guards && npm run test:contrast`. Expected: pass.
- [ ] **Step 5: Commit.** `feat(react): add BannerRegion with status and alert roles, falling back to a toast`.

---

### Task 6: Toast and Banner stories

**Files:**
- Create: `packages/react/src/components/Toast/Toast.stories.tsx`, `packages/react/src/components/Banner/Banner.stories.tsx`
- Modify: `storybook/.storybook/preview.tsx`

Match `Popover.stories.tsx`'s shape and house style. Every story's JSDoc names its perturbation.

**Placement in stories.** The preview decorator wraps every story in `ApProvider`, so the global provider is the one that subscribes. A story's own provider is nested and renders only its children (Review Focus 3), so its placement would be ignored. Therefore the preview decorator passes `notifications={{ placement: context.parameters.notifications?.placement ?? 'bottom-end' }}`, and a story sets `parameters: { notifications: { placement } }`. Update the decorator's comment to say why. `Placements` is therefore one story per placement, generated from the six values.

- [ ] **Step 1: Write the Toast stories and their `play` functions.**
  - **`Severities`:** four buttons, one per severity. Each toast shows its icon, and the error toast's border-inline-start colour differs from the info toast's (computed style). Perturbation: drop a `[data-type]` rule.
  - **`Placement<Name>`**, six stories (Review Focus 5): for each placement, the toast's bounding box sits within `margin` + 2px of the expected viewport corner or centre line. Perturbation: a physical inset, or a missing variant.
  - **`RightToLeft`** (Review Focus 5): `bottom-end` inside `dir="rtl"` sits at the physical left. While entering, its computed `animation-name` is not the `toast.slide-in` keyframe (`cssKeyframeName` from `@ap/motion`), and for `bottom-start` in LTR it is not either. For `bottom-end` in LTR it is. Perturbation: drop the `:dir(rtl)` override.
  - **`Motion`:** the exit runs on `[data-ending-style]`. After close is clicked, the Root is still in the DOM with that attribute and an exit `animation-name`, and then it is removed. Perturbation: key the exit on `[data-closed]`.
  - **`Overflow`:** five toasts leave three visible. The two `[data-limited]` Roots have `display: none` and are `inert`. Closing one visible toast reveals one. Perturbation: remove the `data-limited` rule.
  - **`Swipe`:** with the toast at `bottom-end`, dispatch a pointer drag of 80px toward the inline end. The toast closes. Read `ToastRoot.js` for the pointer events needed, and cite the line. If the test runner cannot drive pointer capture, say so in the story JSDoc and pin only `swipeDirection` through the `data-swipe-direction` attribute after a partial drag.
  - **`ForcedColors`:** this cannot be emulated in Storybook. Leave it to the e2e and say so in a comment.
  - **`WithButtonParts`:** a hand-assembled toast whose `Close` and `Action` take `render={<Button/>}` logs no console error.
  - **`Promise`:** a button that runs `toast.promise` on a promise that rejects after 300 ms. The loading toast shows a spinner, then an error toast with `role="alertdialog"`.
- [ ] **Step 2: Write the Banner stories.** `Default` (each severity in a region at the top of the story), `Replace` (same id), `NotDismissible`, `FallbackToToast` (no region in the story). Every play asserts role and visible content.
- [ ] **Step 3: Run.** `npm run test:stories && npm --prefix storybook run typecheck`. Expected: pass. An axe violation is a real finding.
- [ ] **Step 4: Commit.** `test(storybook): Toast and Banner stories with placement, RTL, motion, overflow and swipe play`.

---

### Task 7: Confirm, alert and announce stories

**Files:**
- Create: `packages/react/src/notifications/Notifications.stories.tsx`

- [ ] **Step 1: Write the stories and their `play` functions.**
  - **`Confirm`:** clicking "Delete" opens an `alertdialog`. Confirm is focused. Clicking the backdrop leaves it open (fact 16). Escape closes it, and focus is back on "Delete". The story renders the resolved value as text, and the play reads `false`. Perturbation: build the host on `Dialog.Root` instead of `AlertDialog.Root`, and the backdrop click closes it.
  - **`DangerConfirm`:** Cancel is focused, and the confirm button's computed background is the danger fill.
  - **`Queued`:** one click fires two confirms. The first is answered, and the second appears after the first's exit animation (`await waitFor`). The text shows both answers in order.
  - **`Alert`:** OK is focused, and Enter resolves it.
  - **`Announce`:** after a click, the polite region's `textContent` becomes the message within a frame. It is visually hidden (a 1×1 box, computed `clip-path`). Perturbation: drop `visuallyHiddenClass`.
  - **`ReducedMotion`:** under the token layer's reduced-motion handling, the dialog and toast still open and close. Follow the existing reduced-motion story pattern if one exists (search `prefers-reduced-motion` in `*.stories.tsx`). If none exists, say so in the JSDoc and skip this story.
- [ ] **Step 2: Run.** `npm run test:stories && npm --prefix storybook run typecheck`. Expected: pass.
- [ ] **Step 3: Commit.** `test(storybook): confirm, alert and announce stories with focus, queue and live-region play`.

---

### Task 8: SSR fixture route, e2e spec and showcase

**Files:**
- Create: `fixtures/ssr-app/app/routes/notifications.tsx`, `fixtures/ssr-app/e2e/notifications.spec.ts`, `showcase/app/routes/notifications.tsx`
- Modify: `fixtures/ssr-app/app/routes.ts`, `showcase/app/sections.ts`

- [ ] **Step 1: Read** `fixtures/ssr-app/app/routes/disclosure.tsx`, `e2e/disclosure.spec.ts` (its forced-colours check at `:130-140` is the precedent) and `routes.ts`. The new route needs `ApProvider`, because it is the first route that needs the notification provider. It is routed in **both** modes: it exports no loader and no action. Its JSDoc says exactly that.
- [ ] **Step 2: Write the route.** `ApProvider` > `BannerRegion` + buttons with ids: `#toast-info`, `#toast-error`, `#banner-warning`, `#confirm-danger` (writes its answer into `#confirm-result`), `#announce`. Add **a child component whose `useEffect` calls `toast({ title: 'Mounted toast' })` on first render** (Review Focus 1, in a real browser).
- [ ] **Step 3: Write `notifications.spec.ts`,** reading server HTML from `response.text()`.
  - The server HTML has the two empty live regions and the empty banner wrapper, and no `role="region"` viewport, no "Mounted toast" and no `alertdialog` (spec verification #7, Toast row).
  - After hydration, "Mounted toast" is visible (Review Focus 1).
  - **F6:** after `#toast-info` is clicked, `page.keyboard.press('F6')` focuses the viewport (`document.activeElement` has `role="region"`), Tab reaches the toast, and Escape closes it (fact 8).
  - **Danger confirm:** focus goes to Cancel. A native Tab moves to Confirm, and Enter resolves `true` in `#confirm-result`. Focus returns to `#confirm-danger`.
  - **Forced colours:** with `emulateMedia({ forcedColors: 'active' })`, an open toast's and a banner's computed `border-block-start-width` is at least 1px and the style is not `none`. Perturbation: remove the border, keeping the background only.
  - No hydration warnings on this route. Reuse `hydration.spec.ts`'s console capture.
- [ ] **Step 4: Add the showcase section.** One `SECTIONS` entry and `routes/notifications.tsx`, which renders a `BannerRegion` and three trigger buttons.
- [ ] **Step 5: Run this fixture's suites here, not later** (5b's Critical):
  ```bash
  npm --prefix fixtures/ssr-app run typecheck
  npm run test:ssr && npm run test:spa
  npm run test:hydration
  npm --prefix showcase run typecheck && npm run showcase:test
  ```
  Expected: all pass, with every existing spec unchanged. Revert any `npm install` lockfile noise.
- [ ] **Step 6: Commit.** `feat(fixtures,showcase): notifications join the SSR, hydration and keyboard proofs`.

---

### Task 9: Documentation

**Files:**
- Modify: `docs/CONTRIBUTING.md`, `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md`, `docs/adr/0012-cross-cutting-services.md` (only if its provider-stack snippet contradicts what shipped)

- [ ] **Step 1: Add to CONTRIBUTING's Base UI traps,** naming the file and line that causes each:
  1. **The toast provider subscribes in a passive effect** (fact 11), which is why our relay uses a layout effect and does not use `createToastManager`.
  2. **`toast.promise` errors keep the default priority and timeout** (fact 12), and string options become descriptions (fact 13).
  3. **AlertDialog's default initial focus is the first button** (fact 17), which is why `initialFocus` is always explicit.
  4. **Toast motions are physical** (Review Focus 5), and which placements fall back to fade.
- [ ] **Step 2: Add spec §4.6.2, "Verified during the plan".** Record facts 11–17, each Review Focus result, the swipe result, and anything Tasks 1–8 found that contradicts §4.6.1. State the `createToastManager` correction plainly as superseding §4.6.1's first bullet under "One emitter per kind". Every citation points at the causing line, or says "observed" and names the test.
- [ ] **Step 3: Verify and commit.** `npm run typecheck && npm run test:guards`. `docs: record notification traps and verified behaviour`.

---

### Task 10: The CI sweep and the pull request

**Files:** none expected.

- [ ] **Step 1: Run every CI step locally, in `ci.yml`'s order.** This list is `ci.yml` as of `aa732ea`. If `ci.yml` has changed since, re-derive the list from it.
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
- [ ] **Step 2: Stop and ask before pushing.** Once approved, push `feat/phase5f-notifications` and open a PR to `main` titled `Phase 5f: Toast and NotificationProvider`, with a body in the 5e PR's shape.
- [ ] **Step 3: Watch all six jobs to green.**
- [ ] **Step 4: Append "What actually happened"** to this plan, in the 5b–5e format, and commit it on the branch before merging.

---

## Verification plan

| # | Claim | Command | Must fail when… |
|---|---|---|---|
| 1 | Error toasts are high priority and never auto-dismiss, even when a timeout is passed | `npm test` (Tasks 1, 3) | the caller's timeout wins, or `error` takes the default |
| 2 | A rejected `toast.promise` is a persistent, titled `alertdialog` | `npm test` (Tasks 1, 3), `test:stories` | the options reach Base UI unmapped |
| 3 | `toast()` from module scope renders (spec #13) | `npm test` (Task 3) | there is no relay |
| 4 | `toast()` from a child's mount effect renders | `npm test` (Task 3), `test:hydration` | the relay subscribes in `useEffect` |
| 5 | Nested providers render one toast | `npm test` (Task 3) | the context guard is removed |
| 6 | No toast or dialog markup in server HTML; empty live regions and banner wrapper are present | `npm test` SSR (Tasks 3, 5), `test:hydration` | the viewport is rendered outside the portal |
| 7 | Confirm and alert focus, Escape, return focus and FIFO | `npm test` (Task 4), `test:stories`, `test:hydration` | `initialFocus` is omitted, or every request renders |
| 8 | Pending dialogs resolve on unmount | `npm test` (Task 4) | the unmount cleanup is removed |
| 9 | Banner roles, replacement and fallback to a toast | `npm test` (Task 5), `test:stories` | one role is used, or the region check is dropped |
| 10 | Placement is logical, and no toast enters from the wrong edge | `test:stories` (Task 6) | a physical inset is used, or the `:dir(rtl)` override is dropped |
| 11 | Overflow hides limited toasts | `test:stories` (Task 6) | the `[data-limited]` rule is removed |
| 12 | Exit motion runs on `[data-ending-style]` | `test:stories` (Task 6) | it is keyed on another attribute |
| 13 | Repeated announcements re-announce, and regions clear | `npm test` (Task 3), `test:stories` | the text is set without clearing |
| 14 | F6, Escape and a native Tab work | `test:hydration` (Task 8) | (Base UI behaviour; the e2e is the evidence) |
| 15 | Borders survive forced colours | `test:hydration` (Task 8) | the border is removed |
| 16 | Every string is a message key | `npm run test:guards` | a label is hardcoded |
| 17 | Zero axe violations | `test:stories` | a story loses a name |
| 18 | Every CI job is green | Task 10's sweep, then the PR | — |

**Final proof artifact:** a green CI run of all six jobs on the Phase 5f pull request, plus Task 10's local sweep output.

---

## What actually happened

Nine build tasks, then one whole-branch review and a single fix wave: 21 commits in all. Tasks 1, 3, 7 and 9 passed their first review. Tasks 2, 4, 5, 6 and 8 each needed one fix round, and none needed a second. Task 3 stopped once as BLOCKED before its first commit. The local sweep of all six `ci.yml` jobs passed on the final tree: 1834 unit tests plus every gate and `check:lockfiles`, consumer 12, SSR 7 plus SPA plus hydration 31, stories 126 plus the build, and showcase 12. Execution was subagent-driven, with a fresh implementer per task and a task review after each.

The user signed off on all seven spec deviations before execution: the channel relay, the `toast.promise` error mapping, `*-end` LTR-only slide, children-only nested providers, explicit `initialFocus`, false-on-unmount, and two new icons. Eight controller rulings were made (R1–R8), and the user made two contrast decisions. The ledger is gitignored, so the ones that matter for 5g–5h are recorded here. Spec §4.6.2 holds every corrected Base UI fact with its causing line.

### The plan's Review Focus 1 test could not discriminate (R3)

Task 3's implementer stopped because the briefed perturbation did not fail. That perturbation subscribes in `useEffect` instead of the layout effect. `Relay` renders as an earlier sibling of the children, so its passive effect already runs before a child's mount effect. The layout effect is still right, because it is order-independent. But only a page rendered **before** the provider in the same commit tells layout from passive. That test is now the discriminator. The child-of-provider test and the fixture e2e remain as regression pins, and their comments now say so (Task 8 fix round). Fact 11 also cited the wrong lines: the subscription is `ToastProvider.js:39-59`, and it exists only when a `toastManager` is passed. Fact 17's first-tabbable resolution is `FloatingFocusManager.js:381-389`.

**For 5g–5h: before prescribing a perturbation, check that the code under test is the only thing standing between the input and the failure. Here, sibling order was doing the work.**

### Contrast: the plan said "run test:contrast", but the gate never saw these pairs (R5)

The banner and toast pairs were absent from `PAIRINGS`, so the gate passed vacuously. Adding them exposed nine light-mode 3:1 failures, which went to the user:

- **Severity container borders and the toast accent stripe are not asserted.** They are non-essential boundaries, because severity is carried by the title, role and icon. ADR-0008 now states this as a principle.
- **The brand focus ring is now also solved against the status subtle fills.** In `generateRamp`, the `ringBackgrounds` argument moves the light ring from `#5a87e9` to `#5a86e9`. Dark mode is unchanged.

The two snapshot updates this required broke the plan's "never `-u`" rule. They were accepted because each one changed only the approved hex (R6).

**For 5g–5h: a plan step that runs a gate must say which rows of the gate the new code is expected to hit.**

### Answered during execution

- **StrictMode resolved a mount-time `confirm()` as `false` (R4).** The reviewer marked this Minor; it was raised to Important. The unmount cleanup is now deferred with `queueMicrotask` and cancelled by the effect replay.
- **A toast's action did not close the toast** (final review). Base UI's `ToastAction` only renders its props. `Relay` now wraps `onClick` to close the toast afterwards.
- **The banner→toast fallback auto-dismissed** after the default 5 s. It now passes `timeout: 0`.
- **Duplicate mounts.** Development warnings now fire for a second provider tree in a separate root and for a second `BannerRegion`.
- **A `<Button>` render cannot catch a dropped `nativeButton` derivation,** because `Button` derives `true`, which is also Base UI's default. An `<a>` render test pins it.
- **Base UI hides `ToastClose` and unfocused high-priority Roots** from the accessibility tree. Tests and stories query them by label or attribute.
- **Stories found three vacuous assertions in review:** an `svg` query matched the close icon, a swipe wait was unbounded and duplicated, and cleanup was not failure-safe. Plays now scope to the leading glyph, bound waits by the computed animation duration, and clean up in `finally`.
- **Not in any task's Files list:** `components/Toast/index.ts`. Task 3 created it (R2).

### Process notes

- As in 5d and 5e, the final review and fix wave ran before the CI sweep, so the sweep ran once.
- One file picked up a Windows-1252 byte (`0x97`) from a shell write. The final reviewer caught it with `iconv`. Check new files for valid UTF-8.
- No implementer ran prettier.

### What is still open

- **Follow-ups (R8):**
  - Solve the focus ring against `bg-raised` by construction. It passes at a 3.017 worst case over 1008 seeds.
  - Widen the notification option types to `?: T | undefined` for consumers with `exactOptionalPropertyTypes`.
- **Known caveats:**
  - `:dir()` needs Chrome 120+.
  - There is no reduced-motion story, because none has a precedent.
  - The duplicate-subscriber warning fires once per module load.
  - A throwing action `onClick` leaves its toast open.
  - `toast.promise` toasts take no action.
- **Deferred minors the final reviewer triaged as can-wait:**
  - `emit` has no try/catch around listeners.
  - The success branch of `toast.promise` honours a caller's severity untested.
  - `swipeDirectionsFor` has no table test.
  - Banners persist across a region remount.
  - The `Queued` story's observer is not disconnected in `finally`.
  - The F6 e2e relies on Base UI prepending new toasts.
