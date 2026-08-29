# 0014 — Verification and CI gates

**Status:** Accepted — 2026-08-29

## Context

This design makes four claims that are easy to assert and easy to quietly break:

1. Generated themes meet WCAG 2.1 AA.
2. Components are accessible.
3. Components are SSR-safe.
4. The library can be consumed as a vendored git submodule.

Each of those is a property of the whole system, not of any one file, and each degrades silently. A component that reads `window` during render works perfectly in Storybook and in every unit test, and crashes only in a consumer's production SSR build. A theme that fails contrast looks fine to whoever generated it.

**Every claim in this design needs an executable proof, or it is not a claim — it is a hope.**

## Decision

Ten gates, in dependency order. Each has one concrete signal. Gates 1–8 block merge.

| # | Gate | Command | Signal |
|---|---|---|---|
| 1 | **Token engine** | `test:tokens` | `generateTheme(seed)` snapshot is deterministic across runs and platforms |
| 2 | **Contrast** | `test:contrast` | Every Tier 2 semantic pairing, both modes, meets WCAG 2.1 AA. Emits `reports/contrast.md` |
| 3 | **Gamut** | `test:gamut` | Every emitted sRGB value is in gamut; P3 values are valid |
| 4 | **Unit + interaction** | `test:unit` | Vitest + Testing Library; interaction tests via Storybook `play` functions |
| 5 | **Accessibility** | `test:a11y` | axe over every Storybook story, zero violations. See the honesty note below |
| 6 | **SSR smoke** | `test:ssr` | See below |
| 7 | **SPA smoke** | `test:spa` | Same app with `ssr: false` boots and renders every component |
| 8 | **Consumer integration** | `test:consumer` | See below |
| 9 | Visual regression | `test:visual` | Storybook snapshot diffs; reviewed, not blocking |
| 10 | Bundle budget | `size-limit` | Per-entry-point size budgets; warns on regression |

### Gate 6 — the SSR smoke test

A minimal React Router 8 framework-mode application in `fixtures/ssr-app` that server-renders **every** component in the library, tested through **the real RR8 pipeline** — the fixture's server entry (`createRequestHandler`, which streams via `renderToPipeableStream`) is booted and pages are requested over HTTP. `renderToString` assertions remain as fast unit-level checks, but the gate exercises what production actually runs, including one page that places components inside a deliberately slow `<Suspense>` boundary so streamed-late content is covered.

It asserts three things:

- **No browser-global access during server render.** A component touching `window`, `document` or `matchMedia` crashes the server build, and the test fails.
- **Expected markup is present in the streamed response** — not an empty shell, including the content flushed after the Suspense boundary resolves.
- **Zero hydration warnings.** The console is captured during hydration and any React mismatch warning fails the test.

The third assertion is the important one. It is what catches non-deterministic render — dates, random IDs, locale-dependent formatting, media-query-derived state — which is the single most common way an SSR-safe library stops being SSR-safe.

Streaming is worth naming as a non-problem we should keep being a non-problem: static CSS ([ADR-0003](0003-zero-runtime-styling.md)) is what makes it work, because the stylesheet is in the shell and content flushed after a Suspense boundary arrives already styled — there is no style-collection step to race the stream. This gate is what notices if anything ever reintroduces one.

**This test is what makes the SSR claim true.** Without it, [ADR-0005](0005-rendering-targets.md) is a statement of intent.

### Gate 8 — the consumer integration test

A fixture repository in `fixtures/consumer` that consumes the library exactly as a product will:

- Library referenced via `file:` protocol, as in [ADR-0002](0002-distribution-git-submodule.md)
- `apComponents()` Vite plugin applied, and nothing else configured by hand
- `vite build` runs in CI

Asserts: the build succeeds, the emitted CSS contains our tokens (proving `.css.ts` files were actually transformed rather than externalised), and the built app renders.

**This test is what makes the submodule claim true.** The `file:` protocol symlink plus Vite's SSR externalisation is the fragile seam in this whole design, and this is the gate that watches it.

### What gate 5 does and does not prove

axe checks machine-decidable rules — missing labels, invalid ARIA, role misuse, contrast, name/role/value wiring. Automated tooling detects roughly **30–40% of WCAG issue types** (Deque's own figures). No scanner can judge whether focus order makes sense, whether keyboard flows actually complete a task, or whether announcements are meaningful rather than merely present. Gate 5 therefore proves *zero machine-detectable violations*, not *accessible*.

The remainder is covered in layers: Base UI carries the semantic and keyboard burden ([ADR-0004](0004-base-ui-primitives.md)); Storybook `play` tests exercise keyboard flows per component; and every component receives a **manual screen-reader pass** — NVDA on Windows and VoiceOver on macOS against a short per-component checklist (reachable, operable, state announced, focus returned) — once before its first release and re-run at release milestones. Manual passes are recorded in the component's directory, not merely performed.

### Determinism rules

- Colour maths is asserted to a fixed precision, so floating-point drift across platforms cannot produce spurious diffs.
- Snapshot tests cover token *structure* as well as values, so a renamed token is a visible failure rather than a silent one.

### The proof artifact

The definition of "it worked", to be pointed at rather than described:

> **A green CI run on `main` showing gates 1–8 passing, plus the deployed Storybook on GitHub Pages, plus `reports/contrast.md` from that run.**

That is one link and one file. It demonstrates the theme generator produces accessible output, the components are accessible, they render on a server without hydration errors, and a real consumer can build against them.

## Consequences

- The four load-bearing claims have executable proofs, and CI enforces them on every change.
- SSR and submodule breakage is caught in our CI rather than in a product's production build.
- `reports/contrast.md` doubles as an accessibility compliance artifact that can be handed to an auditor.
- **Cost:** two fixture applications to maintain, which will need updating as RR8 and Vite evolve. This is the price of the claims being true, and both fixtures are small.
- **Cost:** CI is slower than a unit-test-only pipeline. Gates 1–5 run on every push; 6–8 run on pull requests and on `main`.
- Visual regression is advisory rather than blocking, because false positives from font rendering would otherwise train people to ignore a red build.

## Alternatives considered

- **Unit tests only.** Fast, and blind to every property that actually matters here.
- **Manual QA for SSR and consumer integration.** Rejected: these fail silently and intermittently, which is exactly the class of problem humans are worst at catching.
- **Blocking visual regression.** Rejected — flakiness that trains people to ignore CI is worse than no gate at all.
