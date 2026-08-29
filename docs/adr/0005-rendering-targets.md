# 0005 — Rendering targets: SPA and React Router 8; RSC out of scope

**Status:** Accepted — 2026-08-29

## Context

"Works with SPA and SSR" needs a precise definition, because the three rendering models impose very different constraints and the cost of supporting all three is not linear.

**SPA (client-rendered).** The server sends a near-empty HTML shell; React renders entirely in the browser. `window`, `document`, `localStorage` and `matchMedia` are always available by the time components render. There is one render pass.

**SSR (server-rendered + hydrated).** React renders to an HTML string on the server, the browser receives real markup, then React "hydrates" it by attaching event handlers to the existing DOM. This imposes rules that do not exist in an SPA:

- No browser globals during render. There is no `window`, `document`, `localStorage`, `matchMedia` or `IntersectionObserver` on the server. Touching one at module scope crashes the server build outright.
- `useLayoutEffect` does not run on the server and warns if used. Every layout effect must go through an isomorphic wrapper.
- IDs must be stable across both passes, or ARIA relationships break. `useId` exists for this.
- **The server render and the first client render must produce identical markup.** Anything that differs — a random value, a timestamp, a locale-dependent format, a media query result — is a hydration mismatch. React will warn, and in the worst case discard and re-render the tree.
- Portals must not render server-side.

**RSC (React Server Components).** Components execute only on the server and ship zero JavaScript, with `'use client'` marking the boundary where interactivity begins. This is the strictest model: styles must be fully static rather than computed in the browser, and every Base UI component is a client component.

## Decision

**In scope, tested:**

- **SPA** — Vite-built client-rendered apps, including React Router 8 in `ssr: false` mode.
- **React Router 8 framework mode** — the SSR configuration we actually build and test against. RR8 shipped 2026-06-17: ESM-only, `react-router-dom` removed, middleware on by default, Node 22.22+, React 19.2.7+, Vite 7+.

**Out of scope:** React Server Components. We do not build for it, test it, or claim it.

**SSR-safety is a hard rule for every component regardless of target**, enforced mechanically rather than by review:

| Rule | Enforcement |
|---|---|
| No browser globals at module scope or during render | ESLint rule + SSR smoke test |
| `useLayoutEffect` only via `useIsomorphicLayoutEffect` | ESLint rule |
| IDs from `useId`, never from a counter or random source | ESLint rule + SSR smoke test |
| No `Date.now()`, `Math.random()` or locale-dependent formatting during render | SSR smoke test asserting zero hydration warnings |
| Browser-only state resolves after hydration, never during render | `useHydrated` / `useMediaQuery(query, ssrDefault)` |

Every component module carries `'use client'`. It costs nothing today and preserves the RSC option without our having to claim support for it.

The package is **ESM-only**, matching React Router 8's baseline. Node 22+ and React 19.2+ are the floor.

## Consequences

- The SSR discipline applies universally, so a product can switch from SPA to SSR without auditing component internals. That is the point.
- Some conveniences are unavailable: no reading `matchMedia` during render, no `localStorage` reads during render, no ambient-timezone date formatting (see [ADR-0012](0012-cross-cutting-services.md)).
- The SSR smoke test ([ADR-0014](0014-verification-gates.md)) is the artifact that makes the SSR claim true. Without it the claim is aspiration.
- ESM-only will break any consumer still on CommonJS. Given the RR8 baseline this is already a settled question for the primary target.
- Ruling RSC out is what makes the rest of the design affordable. If it is ever ruled back in, [ADR-0003](0003-zero-runtime-styling.md) already satisfies its hardest constraint, so the revisit is scoped rather than structural.

## Alternatives considered

- **Support RSC from day one.** Rejected: no current consumer needs it, and it constrains every subsequent decision.
- **SPA only.** Rejected: React Router 8 framework mode is a live target, and retrofitting SSR-safety after the fact means auditing every component.
- **Framework-agnostic SSR (test against Next, Remix, RR8 and bare `renderToString`).** Rejected as a testing-surface multiplier for no current benefit. The SSR-safety rules above are framework-independent, so adding another target later is additive.
