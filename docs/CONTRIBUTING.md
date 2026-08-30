# Contributing

## Requirements

Node 22.22.0 or later (React Router 8's floor). npm 10+.

## Setup

    npm install
    npm --prefix fixtures/ssr-app install
    npm --prefix fixtures/consumer install
    npx --prefix fixtures/ssr-app playwright install chromium

## Everyday commands

| Command | What it does |
|---|---|
| `npm test` | Full Vitest suite |
| `npm run typecheck` | `tsc -b` across all packages |
| `npm run test:gates` | Token, contrast, gamut, sweep, freshness, guard and contract gates |
| `npm run test:ssr` | Builds and serves the RR8 fixture, asserts SSR markup and streaming |
| `npm run test:hydration` | Playwright: zero hydration warnings, tokens resolve, no third-party requests |
| `npm run test:consumer` | Builds the `file:`-protocol consumer fixture |
| `npm run report:contrast` | Writes `reports/contrast.md` (the WCAG compliance artifact) |

## Generated files

These are generated and **committed**. Never edit them by hand; CI fails if they drift.

| File | Regenerate with |
|---|---|
| `packages/tokens/src/typography/metrics.generated.ts` | `npm run gen:font-metrics` |
| `packages/react/src/theme/contract.css.ts` | `npm run gen:theme-contract` |
| `packages/react/src/theme/theme.css` | `npm run gen:theme-css` |
| `packages/react/src/theme/fonts.css` + `packages/react/fonts/*.woff2` | `npm run gen:fonts` |

## Rules the gates enforce

- Every component module starts with `'use client'`.
- No browser globals, `useLayoutEffect`, `Date.now()`, `Math.random()` or `react-router`
  imports in `@ap/react` runtime source.
- Component styles reference Tier 2/3 tokens only — never a Tier 1 ramp step.
- Logical properties only (`marginInlineStart`, not `marginLeft`).
- No literal `zIndex`; use `vars.z.*`.
- Never `outline: 'none'` — style `:focus-visible` instead.

## Adding a component

Copy the shape of `packages/react/src/components/Surface/`: a `.tsx` module with
`'use client'`, a `.css.ts` recipe, a `.tokens.ts` file declaring the Tier 3 override
surface, a test, and an `index.ts`. Nothing else in the tree needs to change.

## Known gaps in Phase 2's gates

Phase 2's fixture gates (`test:ssr`, `test:hydration`, `test:consumer`) prove a
real thing: a `file:`-protocol consumer and an RR8 SSR/SPA app build against
our source and ship real compiled component CSS and token custom properties,
not an empty or externalised package.

They do **not** prove the transitive `file:` resolution ADR-0002 relies on —
that an external product vendoring us as a submodule, and declaring only
`@ap/react` as a `file:` dependency, gets `@ap/react`'s own
`"@ap/tokens": "file:../tokens"` dependency installed for it, so it never
has to hand-maintain our dependency list. Both fixtures (`fixtures/ssr-app`,
`fixtures/consumer`) live inside this repository, so npm and Node's module
resolution can and do walk up to the root `node_modules` regardless of what
gets installed under the fixture itself. In this tree,
`fixtures/consumer/node_modules/@ap` contains only `react` and `vite` — no
`@ap/tokens`, and no `@vanilla-extract/*` anywhere in the fixture's
lockfile — yet the build still succeeds, because the root `node_modules`
satisfies everything. A real external consumer, installed outside this
repository tree, would not have that safety net.

This is a known gap, not a defect in the gates: verifying real transitive
resolution would require installing a fixture outside this repository, which
Phase 2 does not do. Until that exists, treat ADR-0002's transitive-resolution
claim as architecturally intended and exercised manually, not as CI-enforced.

## Known caveats

### Windows drive-letter casing breaks vanilla-extract silently

Both fixtures set a `win32`-only `resolve: { preserveSymlinks: true }` in
their `vite.config.ts`. This works around a drive-letter casing artifact seen
on some Windows checkouts: when the OS-reported real path of a symlink
differs in drive-letter casing from the path other tools use (for example
`D:\DEV` vs `D:\dev`), `@vanilla-extract/vite-plugin` silently loses track of
the `.css.ts` modules it compiled.

The symptom is not a build failure. The build succeeds, hashed vanilla-extract
classnames appear correctly in the JS, but the component CSS behind those
classnames never reaches the stylesheet — the app ships unstyled. Both
fixtures hit this independently on at least one development machine. The
gates in this repo are designed to fail loudly on it (they assert the actual
compiled CSS rules exist in the served/bundled output, not just that a
build produced *some* CSS file), so if you see a fixture gate fail on a rule
like `--ap-surface-bg-canvas` being missing from otherwise-successful output,
suspect this before suspecting the gate.

### `vitest.gates.config.ts`

`npm test` (via `vitest.config.ts`) deliberately excludes
`ssr-render.gate.test.ts` and `consumer-build.gate.test.ts`. Those two gates
build entire fixture applications and, for the SSR gate, boot a real server —
minutes of work each — and CI's `unit` job never installs fixture
dependencies, so those files would fail there for the wrong reason. They run
instead through `vitest.gates.config.ts`, a separate config with no such
exclusion, via `npm run test:ssr` and `npm run test:consumer`. The `consumer`
and `ssr` CI jobs install their fixtures first and then run these scripts
directly. Keep both config files in sync if the gate filenames ever change.
