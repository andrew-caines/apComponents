# Phase 4d — Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or
> superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship `Dialog` — the component that proves portals, focus management, motion and SSR
together — and close the two token-layer gaps its own ADRs left open.

**Architecture:** A thin compound wrapper over Base UI's Dialog parts plus a convenience
component, following the `Field`/`FieldParts` split from 4c. Base UI owns modality, the focus
trap, nesting and scroll-lock ref-counting; we own presentation, the token bindings and the
message registry wiring. Sizing is a recipe variant capping inline size; motion comes from
`@ap/motion` composites bound through `var()`, never local keyframes.

**Tech Stack:** Base UI `1.7.0`, vanilla-extract, `@ap/motion`, React Router 8 fixture,
Playwright.

**Spec:** `docs/superpowers/specs/2026-09-02-phase4-vertical-slice-design.md` §6.3, §7, §8

## Global Constraints

- Logical properties only — `inlineSize`, `insetInlineStart`, never `width`/`left`.
- No hardcoded user-facing string; the close control's name comes from `useMessages().close`.
- No hardcoded `z-index`; the `Z` scale in `packages/tokens/src/scales/scales.ts` is the source.
- Motion is `animation: var(--ap-motion-<name>)`; declaring `@keyframes` in a component is a defect.
- `exactOptionalPropertyTypes` — conditional spreads, never `prop={undefined}`.
- Every assertion is perturbation-proven before it is trusted.

## Decisions taken before implementation

| Decision | Why |
|---|---|
| `size`: `sm` 20rem, `md` 30rem (default), `lg` 40rem, `xl` 50rem, `fit` | Width caps, not heights. `fit` is `fit-content` floored at `sm` and capped at `lg` |
| `md` is the default, not `fit` | `fit-content` resolves against max-content, and a percentage-width child contributes nothing to max-content — so a `fit` dialog wrapping a `Field`+`Input` collapses to the width of the longest label. `fit` is for alerts; `md` is for the common case |
| The size name is `fit`, not `auto` | ADR-0017 already gives Dialog `layout="auto"`, meaning "adapt to viewport". Two different `auto`s on one component is an API defect |
| Block size is not a prop | Always: grow to content, cap at `calc(100dvh - 2×margin)`, body scrolls with header/footer pinned. A tall dialog must never push its own close control off-screen |
| `keepMounted` stays `false` | Base UI holds `mounted` true while an exit animation runs, so exit motion works without it — and with it the popup would render server-side, breaking ADR-0005 |

## File Structure

| File | Responsibility |
|---|---|
| `packages/motion/src/motions.ts` | Add `enter.slide-up`, `exit.slide-down` — ADR-0017's sheet cites a token that does not exist |
| `packages/react/src/components/Dialog/Dialog.tokens.ts` | Tier 3 overrides, including one per size |
| `packages/react/src/components/Dialog/Dialog.css.ts` | Popup recipe (size, layout), backdrop, header/body/footer |
| `packages/react/src/components/Dialog/DialogParts.tsx` | Compound parts over Base UI |
| `packages/react/src/components/Dialog/Dialog.tsx` | Convenience component |
| `packages/react/src/gates/no-hardcoded-z-index.gate.test.ts` | New guard |
| `fixtures/ssr-app/app/routes/dialog.tsx` | The surface gates 1/2/3/5 assert against |
| `scripts/gen-dialog-demo.ts` + `scripts/dialog-demo/examples.tsx` | `examples/Dialogs.html` |

## Verification plan

Ordered; each is a command whose output is the evidence.

| # | Claim | Command | Success signal |
|---|---|---|---|
| 1 | Portal content absent from server HTML (ADR-0005) | `test:ssr` | `/dialog` response has the trigger, no popup/title/backdrop. Perturb with `keepMounted` → must fail |
| 2 | Popup reaches the DOM after hydration, outside the trigger's subtree | `test:hydration` | Click opens; popup's ancestor chain reaches `<body>`, not the trigger |
| 3 | Focus trapped while open, returned to trigger on close | `test:hydration` | Tab cycles inside; after Escape `document.activeElement` is the trigger |
| 4 | Motion comes from `@ap/motion`, not local keyframes | `test:consumer` + unit | Computed animation resolves through `var(--ap-motion-enter-fade-rise)`; hardcoding the keyframes name fails |
| 5 | Reduced motion degrades with no component change (spec gate 14) | `test:hydration` | `getKeyframes()` on the popup: default animates `translate`; under `reducedMotion: 'reduce'` animates `opacity` and NOT `translate` |
| 6 | Close control's name comes from the registry | `test:guards` + unit | `no-hardcoded-strings` green; `messages={{ close: 'Fermer' }}` changes the rendered `aria-label` |
| 7 | No component hardcodes a z-index | `test:gates` | New guard passes; fails naming file + value when one is added |
| 8 | Size caps hold and `fit` never collapses | unit + `gen:dialog-demo` | Each size's computed `max-inline-size` matches its token; a `fit` dialog wrapping a `Field`+`Input` is at least the `sm` floor |

**Final proof artifact:** `npm test && npm run test:gates && npm run test:ssr && npm run test:consumer && npm run test:hydration && npm run typecheck` green, plus `examples/Dialogs.html` regenerated with its own browser checks passing.

## Tasks

1. **Motion tokens** — `enter.slide-up`, `exit.slide-down`; regenerate `motion.css`; `test:motion` green.
2. **z-index guard** — new gate + perturbation.
3. **Tokens and CSS** — Tier 3 tokens, popup recipe, backdrop, motion bindings.
4. **Component** — parts + convenience, close label from `useMessages`.
5. **Unit + SSR tests** — checks 6, 8, and the SSR-absence unit half.
6. **Fixture route + Playwright** — checks 1, 2, 3, 5.
7. **Examples page** — `examples/Dialogs.html` with its own browser checks.
8. **Docs** — ADR-0011 (what `size` means where), ADR-0017 (amend the sheet row), CONTRIBUTING (stacking-context trap), spec §9 and the stale "only component that consumes @ap/motion" line.

## What actually happened

Recorded against the plan above, because four things changed on contact.

**Check 7 did not need writing.** `style-rules.gate.test.ts` already had "uses no
literal z-index (ADR-0016)". It was perturbation-proven instead (a literal
`zIndex: 1400` in `Surface.css.ts` fails it, naming file and value) rather than
duplicated.

**Check 1 turned out to be unfalsifiable at the unit level.** "Portal content is
absent from server HTML" is guaranteed twice over by mechanisms outside our
code: `react-dom/server` cannot emit portal children at all, and Base UI throws
`<Dialog.Portal> is missing` if the popup is rendered outside one. Both
perturbations were run and left every assertion green. `Dialog.ssr.test.tsx` now
says so at the top and is labelled a regression guard; the real proof is the raw
HTTP response assertion in `e2e/dialog.spec.ts`.

**Check 8 moved from the examples page into Playwright**, and the examples page
is deferred (see below).

**A test-harness bug masqueraded as a component defect.**
`test.use({ reducedMotion: 'reduce' })` silently did not apply —
`matchMedia('(prefers-reduced-motion: reduce)')` stayed `false` inside the test
while the identical option on a hand-built context worked. The symptom was "the
popup still animates translate under reduced motion", i.e. it looked exactly
like the library failing ADR-0010. The test now builds its own context and
asserts the emulation is active *before* reading any keyframes.

### Deferred: `examples/Dialogs.html`

The examples pipeline renders static SSR pages with no JavaScript. Base UI
requires a `Dialog.Portal`, and a portal renders nothing under `renderToString`
— so a static page structurally cannot show an open dialog. The options were a
hand-written imitation of the popup markup (which would drift from the component
it documents, the one thing `InputFields.html` was built to make impossible) or
converting the examples pipeline to ship a client bundle. The second is the
right answer and is its own piece of work.

Nothing is lost in the meantime: every claim the page would have illustrated is
asserted in `e2e/dialog.spec.ts` against a real browser, including the size caps
and the `fit` floor.

### Found along the way

- **`use-sync-external-store` needed bundling** — the third package in Base UI's
  chain to cause a duplicate React, found because Dialog is the first component
  with a Base UI store. `/dialog` 500'd while every other route served 200. See
  CONTRIBUTING, "left external in an SSR build".
- **`Dialog.Close` shipped unattached.** The portal hid it from SSR and no unit
  test used it, so it surfaced three layers out as React error #130 in the
  fixture. A namespace-completeness test now covers every documented part.
- **A previously shipped assertion could not fail.** `consumer-build.gate`'s
  reduced-motion check used `[\s\S]*?`, which spanned the whole stylesheet and
  matched theme.css's unrelated duration block. Replaced with a structural check
  on the two `@keyframes` definitions, and perturbation-proven by deleting
  motion.css's reduced section.
- **A third raw-text-scan false positive**, this time in `ssr-safety`, from a
  comment mentioning a browser global.
