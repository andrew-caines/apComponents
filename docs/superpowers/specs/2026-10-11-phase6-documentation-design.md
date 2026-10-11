# Phase 6: documentation, design

**Date:** 2026-10-11
**Status:** approved 2026-10-11. Amended the same day while planning: §4.0, §4.1, §4.1a, §4.2 and §5.1 were corrected against the code (`Banner` is imperative; `@ap/vite` does not bundle Base UI; no fixture uses `ApProvider`). Amended again 2026-10-11 after the final review: §3, §4.0, §4.1, §4.1a, §4.2, §4.3, §5.2, §5.4, §6 and §8 now describe what shipped.
**Parent:** [component-library-design.md §5, Phase 6](2026-08-29-component-library-design.md)

## 1. Intent

The Phase 6 roadmap entry reads: "Storybook build and Pages deployment, MDX guides (theming, SSR rules, colour theory, migration), the interactive theme-generator page." The deployment shipped early, on 2026-10-11 in `08098d1`. Since then the site has been live at https://andrew-caines.github.io/apComponents/ and redeploys on every push to `main`. This spec covers the rest.

The audience is a developer who has never used apComponents and is deciding whether to adopt it, or who is adopting it now. The repository is public, so every page is published to the open internet. No page names an employer, a client or a product.

### Decisions made in conversation

| Question | Answer |
|---|---|
| Who is the "migration" guide for? | People **adopting the library at all**. It becomes **Getting started**: submodule, `@ap/vite`, `ApProvider`, SSR setup, first component. |
| What does a visitor leave the generator with? | **Pick a brand and copy the code.** They choose a seed, see the ramps, contrast and live components, then copy a `generateTheme({ brand })` snippet or download `theme.css`. |
| Where does the generator live? | **Approach A:** a React component in `storybook/docs/generator/`, embedded in an MDX page, with its own stories so the existing gates cover it. |
| Delivery shape | One spec, one plan, one PR, as in 5h. |

## 2. Scope

| Piece | Contents | Status |
|---|---|---|
| Deploy | `.github/workflows/pages.yml` | ✅ `08098d1` |
| **Getting started** | New MDX, §4.1 | new |
| **SSR rules** | New MDX, §4.2 | new |
| **Colour theory** | New MDX, §4.3 | new |
| **Theme generator** | New MDX page and component, §5 | new |
| Theming (existing) | Gains a link to the generator; otherwise unchanged | small edit |

**Out of scope:**
- per-ramp overrides;
- a font picker (`ThemeSeed.font` exists, but there is no caller);
- a Docusaurus site (master spec §7);
- any change to the public API of `@ap/react` or `@ap/tokens`.

## 3. Page tree and sidebar

```
Guides/
  Getting started      ← the landing page
  SSR rules
  Colour theory
Foundations/
  Theming              (existing)
  Theme generator      ← new
  Colour, Scales, Typography, Icons   (existing)
Components/...         (existing)
```

`preview.tsx` sets `parameters.options.storySort` to `{ order: ['Guides', ['Getting started', 'SSR rules', 'Colour theory'], 'Foundations', 'Components'] }`. The order covers only the top level and the pages under Guides; Foundations and Components keep Storybook's default order inside them. Storybook opens the first entry in that order, so Getting started becomes the landing page.

## 4. Guides

### 4.0 Guides quote real code, never prose copies

Every code sample in Getting started and SSR rules comes from a file that a gate already builds and runs:

- `fixtures/ssr-app/vite.config.ts`, `app/root.tsx`, and a new route `app/routes/start.tsx` (§4.1a);
- `fixtures/consumer/vite.config.ts` (regions `vite-imports` and `spa-vite`) and `fixtures/consumer/package.json`. Both Vite configs carry a `vite-imports` region. The manifest has no regions: the `package.json` sample is built from it with `JSON.parse`.

The samples are quoted by named region, not as whole files, because the fixtures also carry test-only code such as the `__apRecoverableErrors` recorder.

- A fixture marks a quotable span with `// #region docs:<name>` … `// #endregion docs:<name>`. JSX spans use the `{/* … */}` form of the same markers.
- `storybook/docs/lib/extractRegion.ts` exports `extractRegion(raw: string, name: string): string`. It returns the lines between the markers with their common indentation removed.
- It **throws** when the region is missing, duplicated, unclosed or empty, so a guide never renders an empty block. The throw happens when the page renders. `storybook build` and the storybook vitest project do not render MDX, so CI catches a broken region only through `scripts/docs-refs.test.ts` in the unit job (§6).
- MDX imports the file with Vite's `?raw` suffix and renders it with `<Source language="tsx" code={extractRegion(raw, 'name')} />`.

The colour-theory numbers are computed live from `@ap/tokens`, never typed by hand. See §4.3.

### 4.1 Getting started

Sections, in order:

1. **What you get.** One paragraph, plus the package table: `@ap/react`, `@ap/tokens`, `@ap/vite` and `@ap/motion`, each with one line.
2. **Add the submodule.** Shows `git submodule add`, plus the `file:` dependencies in `package.json`, built from the consumer fixture's manifest with `JSON.parse`, and the concrete paths for a submodule at `vendor/apComponents`.
3. **Wire Vite.** The `apComponents()` plugin in `vite.config.ts` (regions `vite-imports` and `vite`). Covers what it sets: vanilla-extract, `ssr.noExternal` and `optimizeDeps.exclude` for the `@ap/*` packages only, the CSS floor (`AP_CSS_TARGET`, Chrome 120), and the `ap-components:rtl-check` warning. Notes when an explicit `build.target` overrides it. The SSR fixture needs the three Base UI `ssr.noExternal` entries (region `ssr-noexternal`) because it sits inside this repository's workspace. An external consumer of the submodule through `file:` is not gate-tested; if its SSR build fails at request time with a null hook dispatcher (`TypeError: Cannot read properties of null (reading 'useId')`), it adds the entries shown. `@ap/vite` does **not** add them.
4. **Load the CSS.** The three stylesheet imports in `root.tsx` (region `css`).
5. **Wrap and render.** `ApProvider` around a `Field` with `Input` and a `Button`, from `routes/start.tsx` (region `start`). Links to Theming.
6. **SPA instead of SSR.** The consumer fixture's `vite.config.ts` (regions `vite-imports` and `spa-vite`).
7. **Next.** Links to SSR rules, Theming, Theme generator and Components.

### 4.1a The `/start` fixture route

`fixtures/ssr-app/app/routes/start.tsx` is new. It is the getting-started sample written as a real route: `ApProvider`, then a `Field` with `Input`, then a `Button`. It has no fixture-only comments inside its `start` region. It has no loader and no action, so it is routed in both SSR and SPA mode. Gate 6 asserts that its label, input and button are in the server HTML and that the label's `for` names the `<input>`'s `id`, and `test:hydration` asserts that it hydrates with no recoverable errors and no console output. The sample is therefore proven by the same gates as every other fixture route.

### 4.2 SSR rules

The rules are written for consumers. Each one has a **rule**, a **why**, a **broken looks like** and an **enforced by** line that names its gate, so a reader knows the library proves it. The sources are CONTRIBUTING's trap sections and ADR-0005.

| Rule | Enforced by |
|---|---|
| Never read storage, time, randomness or `window` during render; use the hooks. Only `useHydrated` defers to an effect; `useMediaQuery`, the storage hooks and `useFormatter` render a server snapshot through `useSyncExternalStore` | `test:guards` (the SSR-safety walker, [`ssr-safety.gate.test.ts`](https://github.com/andrew-caines/apComponents/blob/main/packages/react/src/gates/ssr-safety.gate.test.ts)), which scans library source only; `test:hydration` ([`hydration.spec.ts`](https://github.com/andrew-caines/apComponents/blob/main/fixtures/ssr-app/e2e/hydration.spec.ts)) for hydration errors on the routes it loads |
| Portalled UI (Dialog, Popover, Tooltip, Select popup, Toast) renders nothing on the server, so do not rely on its markup there | `test:hydration` ([`dialog.spec.ts`](https://github.com/andrew-caines/apComponents/blob/main/fixtures/ssr-app/e2e/dialog.spec.ts), [`overlays.spec.ts`](https://github.com/andrew-caines/apComponents/blob/main/fixtures/ssr-app/e2e/overlays.spec.ts), [`notifications.spec.ts`](https://github.com/andrew-caines/apComponents/blob/main/fixtures/ssr-app/e2e/notifications.spec.ts)), plus gate 6's listbox check ([`ssr-render.gate.test.ts`](https://github.com/andrew-caines/apComponents/blob/main/packages/react/src/gates/ssr-render.gate.test.ts)) |
| Forms work before hydration: uncontrolled values submit natively. Only Input and Textarea are editable before hydration; Checkbox, Switch, RadioGroup and Select submit their defaults | `test:hydration` ([`progressive-enhancement.spec.ts`](https://github.com/andrew-caines/apComponents/blob/main/fixtures/ssr-app/e2e/progressive-enhancement.spec.ts), `/form`, all bundles blocked) and gate 6's default-values post ([`ssr-render.gate.test.ts`](https://github.com/andrew-caines/apComponents/blob/main/packages/react/src/gates/ssr-render.gate.test.ts)) |
| The SSR fixture bundles `@base-ui/react`, `@base-ui/utils` and `use-sync-external-store` (`ssr.noExternal`) because it sits inside this repository's workspace. An external `file:` consumer of the submodule is not gate-tested; if its SSR build fails at request time with a null hook dispatcher (`TypeError: Cannot read properties of null (reading 'useId')`), it adds the entries shown | The gates prove the fixture renders and hydrates with these entries: `test:ssr` ([`ssr-render.gate.test.ts`](https://github.com/andrew-caines/apComponents/blob/main/packages/react/src/gates/ssr-render.gate.test.ts)) and `test:hydration` ([`dialog.spec.ts`](https://github.com/andrew-caines/apComponents/blob/main/fixtures/ssr-app/e2e/dialog.spec.ts)); CONTRIBUTING's "second React" trap |
| Content in `hidden="until-found"` (Accordion) is client-only for find-in-page | `test:hydration` ([`disclosure.spec.ts`](https://github.com/andrew-caines/apComponents/blob/main/fixtures/ssr-app/e2e/disclosure.spec.ts)), which dispatches `beforematch`; CONTRIBUTING's `until-found` trap |
| Streaming: stateful components inside `<Suspense>` hydrate without recoverable errors | gate 6's shell-then-content ordering check ([`ssr-render.gate.test.ts`](https://github.com/andrew-caines/apComponents/blob/main/packages/react/src/gates/ssr-render.gate.test.ts)) plus `test:hydration` ([`hydration.spec.ts`](https://github.com/andrew-caines/apComponents/blob/main/fixtures/ssr-app/e2e/hydration.spec.ts), `/streamed`) |
| The production CSS must keep `:dir(rtl)`; a low `build.target` lowers it, and `rtl-check` warns | gate 6, the RTL CSS test ([`ssr-render.gate.test.ts`](https://github.com/andrew-caines/apComponents/blob/main/packages/react/src/gates/ssr-render.gate.test.ts)) |

Each "enforced by" line names the gate and links the test file in the repository, since GitHub is public now.

### 4.3 Colour theory

1. **Why OKLCH.** Perceptual lightness, with equal steps that look equal. Shows a side-by-side swatch strip of the seed's ramp: OKLCH vs naive HSL lightness steps, computed live.
2. **From one seed to six ramps.** The brand seed, then the status hues and neutral tint derived from it, as rendered swatches. They are read from `generateTheme(DEFAULT_BRAND).ramps`; the internal `deriveSeeds` is not exported, and this phase does not export it.
3. **Twelve steps, each with a job.** A table of steps 1–12. Each step's role comes from a list taken from ADR-0006 (`STEP_ROLES`). The "read by" column, the semantic tokens that map to each step, comes from `SEMANTIC_MAP` rather than being retyped. Steps that no token reads are shown and marked as such, and an `onSolid` row lists the tokens drawn on a solid step.
4. **Contrast policy.** WCAG AA is the gate and APCA Lc is reported (ADR-0008). Shows a live table of the headline pairings: the first six light pairings from `contrastPairings`.
5. **Gamut.** sRGB mapping, and why a vivid seed comes back slightly muted.
6. **Try it.** Links to the Theme generator.

Every number on the page comes from a call at render time. The guide has no hard-coded hex values, ratios or Lc numbers.

## 5. Theme generator

### 5.1 Files

All files are under `storybook/docs/generator/`. They ship to the docs site, never to the library.

| File | Responsibility |
|---|---|
| `ThemeGenerator.tsx` | Page component. Owns the seed state. Composes the panels. |
| `SeedInput.tsx` | Native `<input type="color">` plus `Field` and `Input` for the hex, two-way synced |
| `RampView.tsx` | Six ramps × twelve steps, light and dark |
| `ContrastTable.tsx` | `contrastPairings(theme)`: mode, pairing, ratio, required, APCA Lc, pass/fail |
| `Preview.tsx` | `ThemeProvider theme={theme}` around real components: Button (solid, outline and ghost; action and danger tones), Field with Input (plus one with an error), Checkbox, Switch, Select and Tabs. It shows light and dark side by side if a nested `ThemeProvider scheme="dark"` scopes the generated theme; otherwise it follows the page's scheme (the plan probes this). |
| `Export.tsx` | Copy the snippet (`useCopyToClipboard`) and download `theme.css` (a Blob of `toCssText(theme)`) |
| `logic.ts` | Helpers: `isValidHex`, `buildSnippet(hex)`, `readBrandParam(search)`, `brandParamValue(hex)` and `mirrorBrand(value, win)` |
| `ThemeGenerator.stories.tsx` | Stories, §5.4 |
| `../Generator.mdx` | `Foundations/Theme generator`: a short intro and the component |

### 5.2 Data flow

- The hex string goes into `useMemo(() => generateTheme({ brand }))`, and that theme feeds every panel.
- Only a value that passes `isValidHex` reaches `generateTheme`. `isValidHex` uses the same pattern as `normalizeHex`: `#rgb` or `#rrggbb`, any case.
- The seed is debounced (`SEED_DEBOUNCE_MS`, 100 ms) so dragging the picker stays smooth. The debounce applies to a typed hex too: it applies once it is valid and has settled.
- **Sharing:** the initial seed is read from `?brand=` (`readBrandParam`), and changes are mirrored into it with `history.replaceState` (`mirrorBrand`). In Storybook the component runs inside the docs iframe, so the mirror writes the top window's URL when it is same-origin, keeping its other params, and falls back to the iframe's own URL otherwise; a refused write is ignored. The mirror does not write on mount: it waits until the settled brand differs from the first one, so loading a `&brand=` link leaves the address bar alone.

### 5.3 Error handling

- **Invalid hex:** `Field` shows the error "Use #rgb or #rrggbb". The last valid theme stays rendered, and nothing blanks or throws.
- **A failing pairing:** the table marks the row, and `Export` shows an inline `role="status"` warning ("N pairings fail WCAG AA in this theme") above the buttons. `Banner` is imperative (`banner()` plus `BannerRegion`), so it is not used inline. Export is not blocked.
- **Clipboard unavailable or rejected:** `useCopyToClipboard` returns `[copied, copy]`, and `copy()` resolves `false` on failure. When it does, `Export` shows "Copy failed; select the text instead". The snippet is always visible in a `<pre>`.

### 5.4 Testing

| Test | Proves | Must fail when… |
|---|---|---|
| `logic.test.ts` (unit) | `isValidHex` accepts and rejects the same inputs as `normalizeHex`; `buildSnippet` normalises the hex; `readBrandParam` ignores invalid values | the regex drifts from `normalizeHex` |
| Story `Default` | Renders with `DEFAULT_BRAND`; play asserts the snippet contains `#2e5fd9` | the snippet is not built from state |
| Story `Pink` (`#c2185b`) | The preview re-themes; play asserts a preview Button's computed background equals the generated theme's light brand step 9 | `ThemeProvider` is dropped from `Preview` |
| Story `InvalidHex` | Play types `#zz`, asserts the field error, and asserts the snippet still shows the previous valid hex | the theme is regenerated from invalid input |
| Story `Download` | Play asserts the download link's Blob text equals `toCssText(generateTheme({ brand }))` | the export is built from a stale or different theme |
| Story `PickerDebounce` | Play fires five picker `input` events and asserts the theme regenerates at most twice | `useDebouncedValue` is dropped |
| axe (gate 5) | No violations on every generator story | — |
| gate 9 | Light and dark baselines for every generator story, added through the label sequence | — |

The stories' title is `Foundations/Theme generator stories`, because the MDX page owns `Foundations/Theme generator`. `main.ts`'s `stories` gains `'../docs/**/*.stories.@(ts|tsx)'`, so `test:stories`, axe and gate 9 pick these stories up.

### 5.5 Dependencies

`storybook/package.json` gains `"@ap/tokens": "file:../packages/tokens"` for `toCssText`, `contrastPairings`, `SEMANTIC_MAP`, `DEFAULT_BRAND`, `hexToOklch`, `wcagRatio` and `apcaLc`. The root lock is refreshed, and `check:lockfiles` stays green. `@ap/react`'s public API is unchanged.

## 6. Keeping the docs true

- **The `extractRegion` unit test** (`storybook/docs/lib/extractRegion.test.ts`) covers: found, missing (throws), duplicated (throws), unclosed (throws), empty (throws), and the indentation strip.
- **The docs reference check** (`scripts/docs-refs.test.ts`, in the unit project):
  - For every `storybook/docs/**/*.mdx`, every `?raw` import must resolve to an existing file.
  - Every `extractRegion(x, 'name')` call must name a region present in that file.
  - Every relative link must resolve.
  - A duplicate, unclosed or empty region fails, as it would throw at render (the check runs `extractRegion` itself).
  - An `extractRegion` call it cannot read statically, or whose first argument is not a `?raw` import, fails.
  - Every `?path=/docs/<id>--docs` link, in Markdown or a JSX `href`, must name an MDX page; the id is derived from the page's `<Meta title>` as Storybook does.
  - It must fail when a fixture region is renamed or a fixture file is moved.
- **The fixtures' own gates** (8, SSR, SPA, hydration) keep proving that the quoted code works.

## 7. Done when

1. Getting started, SSR rules, Colour theory and Theme generator are live on Pages after merge, and Getting started is the landing page.
2. The generator stories pass play, axe and gate 9, with baselines committed through the label sequence.
3. The docs reference check and `extractRegion` tests are green.
4. All 7 CI jobs are green on the PR and on `main`, and the Pages deploy of the merge commit succeeds.

**Proof artifact:** the PR's CI run, plus the four live page URLs checked with `curl`. Each returns 200, and `index.json` lists the four new docs entries.

## 8. Risks

| Risk | Mitigation |
|---|---|
| `?raw` imports in MDX resolve differently in `storybook build` than in dev | Task 1 spikes one `?raw` + `extractRegion` page through `storybook build` before the guides are written |
| Region markers in fixtures get deleted by a later fixture edit | `extractRegion` throws when the page renders, which `storybook build` and the storybook vitest project never do; CI catches it only through the docs reference check (`scripts/docs-refs.test.ts`) in the unit job |
| The generator's live preview is slow while dragging | The picker input is debounced; `generateTheme` is already fast enough for a gate that runs it thousands of times |
| Guide prose drifts from behaviour | Every rule names its gate; samples are quoted, not copied |
| Published text leaks private context | §1 rule: no employer, client or product names; the reviewer checks it |
