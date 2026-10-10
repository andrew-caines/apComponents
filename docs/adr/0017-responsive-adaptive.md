# 0017 — Responsive and adaptive behaviour: desktop and mobile from one component set

**Status:** Accepted — 2026-08-29

## Context

These components will be used on desktop and mobile. The library previously took no position on breakpoints, touch ergonomics, or whether components adapt their behaviour on small screens — which means every product would answer those questions differently, per call site, mostly by forgetting.

One technical fact constrains the design: **CSS custom properties cannot be used in `@media` queries.** `@media (min-width: var(--ap-bp-sm))` is invalid CSS. So breakpoints cannot be Tier 1 tokens like colours; they need a different delivery mechanism.

A second distinction does real work here: **pointer type and viewport size are different axes.** A tablet is a large viewport with a coarse pointer; a desktop touchscreen is both. Touch ergonomics should key off `pointer: coarse`, not off screen width.

## Decision

### Breakpoints: TypeScript constants, not CSS variables

```ts
// @ap/tokens
export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const
export const media = {
  sm: '(min-width: 640px)', md: '(min-width: 768px)', …
  coarse: '(pointer: coarse)',
} as const
```

Consumed three ways, all from the same source:

- **In library styles** — vanilla-extract interpolates them at build time into real `@media` rules.
- **In consumer styles** — the same constants, importable.
- **In logic** — `useBreakpoint('sm')` / `useMediaQuery(media.coarse, ssrDefault)`, both SSR-safe per [ADR-0005](0005-rendering-targets.md): they return the declared default on the server and reconcile after hydration. **No component's markup structure depends on a JS media query** — structure decided by JS media queries is a hydration mismatch by construction. JS breakpoints are for behaviour (which gesture handler to attach), CSS breakpoints are for appearance.

### Components adapt to their container; apps own the page

Component-internal responsiveness uses **container queries**, not viewport queries — a form in a 320px sidebar should behave like a form on a 320px phone. Components that adapt (Field layouts, Toolbar overflow, future Table) query their own container. Page layout — columns, navigation collapse — belongs to the app, using our exported breakpoints.

The library ships **no grid/layout components in v1** (consistent with the scope in [ADR-0011](0011-component-api-conventions.md)); it ships the constants and hooks that make the app's layout consistent with ours.

### Touch ergonomics: automatic under `pointer: coarse`

Interactive components guarantee a minimum hit target — **24px always (WCAG 2.5.8 AA), 44px under `pointer: coarse`** (Apple HIG / Material guidance). Implemented in pure CSS via a hit-area pseudo-element, so the *visual* size does not change — a compact desktop-dense button stays visually compact on a touchscreen; only its touchable area grows. No JS, no hydration surface, no opt-out needed because nothing visible changes.

```css
--ap-hit-target: 24px;
@media (pointer: coarse) { --ap-hit-target: 44px; }
```

### Morphology adaptation: automatic with opt-out

Components whose *shape* should change on small screens do so by default, each with an explicit escape hatch:

| Component | Below `sm` (viewport — these are portaled surfaces) | Opt-out |
|---|---|---|
| Dialog | bottom sheet: full-width, slides from bottom edge (`enter.slide-up` token) | `layout="dialog"` — `layout="auto"` is the default |

`enter.slide-up` (and its partner `exit.slide-down`) did not exist when this ADR
was written — the row named a token the motion system had never defined. Both
were added in Phase 4d, when Dialog first needed them; see
[ADR-0010](0010-motion-system.md).

Note also that `layout` and `size` are separate axes on Dialog and only `layout`
takes `auto`. The width scale's shrink-to-fit step is called `fit` precisely so
that one component does not carry two different `auto`s meaning different
things.
| Select / Menu / Popover | anchored popup may switch to bottom-sheet presentation where anchoring is unusable | same pattern |
| Toast | full-width at bottom edge instead of corner-stacked | position prop |
| Tooltip | suppressed for touch-only interaction (hover-dependent tooltips are unreachable by touch); the accessible label remains | — |

The Tooltip row is the important accessibility one: information that *only* exists in a hover tooltip is unreachable on touch devices, so component docs require tooltip content to be supplementary, never sole-source.

The switch is CSS-driven (same rendered structure, different styles/motion) wherever possible; where behaviour must genuinely differ (sheet drag-to-dismiss), it keys off `useMediaQuery` with an SSR default of the desktop presentation — chosen because SSR'd surfaces (dialogs) are closed at first paint, so the reconciliation is invisible.

### Density

Spacing tokens are ratio-derived ([ADR-0006](0006-oklch-colour-engine.md)), so a global density mode (compact/comfortable) is achievable later by scaling the space ramp. Deferred from v1; noted so nothing is designed to preclude it.

## Consequences

- Correct mobile ergonomics are the default; products cannot forget them, and desktop density is not compromised to get them.
- One breakpoint source of truth across library styles, consumer styles and logic.
- Container-query components behave correctly in sidebars, split views and embedded contexts, not just full-width pages — which viewport-based responsiveness silently gets wrong.
- **Cost:** breakpoints are compile-time constants, so a product cannot retheme them at runtime the way it does colour. Accepted — runtime-variable breakpoints are rarely coherent anyway.
- **Cost:** auto-adapting morphology means a component can look different in two places for reasons a developer must learn (`layout="auto"` documentation burden). The opt-out prop bounds the surprise.
- Container queries and `@layer` share the same ~2022 browser floor already implied by our React 19 / Base UI baseline.

**Amended 2026-10-10 (Phase 5h).** The "~2022" floor above holds for container queries and `@layer`, but not for all our CSS. For CSS, the floor is now Chrome and Edge 120 (with Safari 16.4, iOS 16.4 and Firefox 114), set by `@ap/vite`'s `AP_CSS_TARGET`. Our right-to-left rules use `:dir(rtl)`, which needs Chrome 120; below it, Vite's lightningcss minifier lowers `:dir()` to `:lang()` and RTL follows the page language instead of its direction. `@ap/vite` applies the target unless the consumer sets `build.cssTarget` or `build.target`, and warns if the built CSS still has `:dir()` lowered. See CONTRIBUTING, "The CSS browser floor".

## Alternatives considered

- **Manual-only adaptation (props at every call site).** Fully predictable, and guarantees most products ship desktop dialogs on phones. Rejected: defaults are where mobile quality actually lives.
- **Separate mobile components (`<MobileDialog>`).** Explicit, but forks the API and pushes the choice to exactly the place it will be made inconsistently.
- **Viewport queries for component internals.** Simpler than container queries, wrong in any embedded or split-pane context — which enterprise HXM screens are full of.
- **JS-driven adaptation throughout.** Rejected on SSR grounds: structure from `matchMedia` is a hydration mismatch machine ([ADR-0005](0005-rendering-targets.md)).
