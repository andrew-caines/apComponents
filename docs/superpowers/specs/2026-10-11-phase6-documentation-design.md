# Phase 6: documentation, design

**Date:** 2026-10-11
**Status:** approved 2026-10-11. Amended the same day while planning: §4.0, §4.1, §4.1a, §4.2 and §5.1 were corrected against the code (`Banner` is imperative; `@ap/vite` does not bundle Base UI; no fixture uses `ApProvider`).
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

`preview.tsx` sets `parameters.options.storySort` to `{ order: ['Guides', ['Getting started', 'SSR rules', 'Colour theory'], 'Foundations', 'Components'] }`. Storybook opens the first entry in that order, so Getting started becomes the landing page.

## 4. Guides

### 4.0 Guides quote real code, never prose copies

Every code sample in Getting started and SSR rules comes from a file that a gate already builds and runs:

- `fixtures/ssr-app/vite.config.ts`, `app/root.tsx`, and a new route `app/routes/start.tsx` (§4.1a);
- `fixtures/consumer/vite.config.ts` and `src/main.tsx`.

The samples are quoted by named region, not as whole files, because the fixtures also carry test-only code such as the `__apRecoverableErrors` recorder.

- A fixture marks a quotable span with `// #region docs:<name>` … `// #endregion docs:<name>`. JSX spans use the `{/* … */}` form of the same markers.
- `storybook/docs/lib/extractRegion.ts` exports `extractRegion(raw: string, name: string): string`. It returns the lines between the markers with their common indentation removed.
- It **throws** when the region is missing, duplicated or unclosed. A guide that cannot find its sample fails the Storybook build; it never renders an empty block.
- MDX imports the file with Vite's `?raw` suffix and renders it with `<Source language="tsx" code={extractRegion(raw, 'name')} />`.

The colour-theory numbers are computed live from `@ap/tokens`, never typed by hand. See §4.3.

### 4.1 Getting started

Sections, in order:

1. **What you get.** One paragraph, plus the package table: `@ap/react`, `@ap/tokens`, `@ap/vite` and `@ap/motion`, each with one line.
2. **Add the submodule.** Shows `git submodule add`, plus the `file:` dependencies in `package.json` (from the consumer fixture's manifest, quoted from the file).
3. **Wire Vite.** The `apComponents()` plugin in `vite.config.ts` (region `vite`). Covers what it sets: vanilla-extract, `ssr.noExternal` for the `@ap/*` packages only, and the CSS floor (`AP_CSS_TARGET`, Chrome 120). Notes when an explicit `build.target` overrides it. When `@ap/react` is consumed through a `file:` path into the submodule (the ADR-0002 route), an SSR app also needs the three Base UI `ssr.noExternal` entries (region `ssr-noexternal`), for the reason CONTRIBUTING's "second React" section gives. `@ap/vite` does **not** add them.
4. **Load the CSS.** The three stylesheet imports in `root.tsx` (region `css`).
5. **Wrap and render.** `ApProvider` around a `Field` with `Input` and a `Button`, from `routes/start.tsx` (region `start`). Links to Theming.
6. **SPA instead of SSR.** The consumer fixture's `main.tsx` (region `spa`).
7. **Next.** Links to SSR rules, Theming, Theme generator and Components.

### 4.1a The `/start` fixture route

`fixtures/ssr-app/app/routes/start.tsx` is new. It is the getting-started sample written as a real route: `ApProvider`, then a `Field` with `Input`, then a `Button`. It has no fixture-only comments inside its `start` region. It has no loader and no action, so it is routed in both SSR and SPA mode. Gate 6 asserts that its label is wired in the server HTML, and `test:hydration` asserts that it hydrates with no recoverable errors and no console output. The sample is therefore proven by the same gates as every other fixture route.

### 4.2 SSR rules

The rules are written for consumers. Each one has a **rule**, a **why**, a **broken looks like** and an **enforced by** line that names its gate, so a reader knows the library proves it. The sources are CONTRIBUTING's trap sections and ADR-0005.

| Rule | Enforced by |
|---|---|
| Never read storage, time, randomness or `window` during render; use the hooks, which defer to an effect | gate 6 (the SSR safety walker) |
| Portalled UI (Dialog, Popover, Tooltip, Select popup, Toast) renders nothing on the server, so do not rely on its markup there | gate 6 |
| Forms work before hydration: uncontrolled values submit natively | `test:hydration` (`/form`, all bundles blocked) |
| A `file:`/submodule SSR app bundles `@base-ui/react`, `@base-ui/utils` and `use-sync-external-store` (`ssr.noExternal`) | `test:ssr` and `test:hydration` (the fixture is exactly this shape); CONTRIBUTING's "second React" trap |
| Content in `hidden="until-found"` (Accordion) is client-only for find-in-page | CONTRIBUTING's `until-found` trap |
| Streaming: stateful components inside `<Suspense>` hydrate without recoverable errors | `test:hydration` (`/streamed`) |
| The production CSS must keep `:dir(rtl)`; a low `build.target` lowers it, and `rtl-check` warns | gate 6 (the RTL CSS test) |

Each "enforced by" line names the gate and its spec section. The page links to the repository file, since GitHub is public now.

### 4.3 Colour theory

1. **Why OKLCH.** Perceptual lightness, with equal steps that look equal. Shows a side-by-side swatch strip of the seed's ramp: OKLCH vs naive HSL lightness steps, computed live.
2. **From one seed to six ramps.** The brand seed, then the status hues and neutral tint derived from it, as rendered swatches. They are read from `generateTheme(DEFAULT_BRAND).ramps`; the internal `deriveSeeds` is not exported, and this phase does not export it.
3. **Twelve steps, each with a job.** A table of steps 1–12 and their semantic roles, taken from `SEMANTIC_MAP` rather than retyped.
4. **Contrast policy.** WCAG AA is the gate and APCA Lc is reported (ADR-0008). Shows a live table of a few headline pairings from `contrastPairings`.
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
| `logic.ts` | Pure helpers: `isValidHex`, `buildSnippet(hex)` and `readBrandParam(search)` |
| `ThemeGenerator.stories.tsx` | Stories, §5.4 |
| `../Generator.mdx` | `Foundations/Theme generator`: a short intro and the component |

### 5.2 Data flow

- The hex string goes into `useMemo(() => generateTheme({ brand }))`, and that theme feeds every panel.
- Only a value that passes `isValidHex` reaches `generateTheme`. `isValidHex` uses the same pattern as `normalizeHex`: `#rgb` or `#rrggbb`, any case.
- Input from the colour picker is debounced (~100 ms) so dragging stays smooth. A typed hex applies once it is valid.
- **Sharing:** the initial seed is read from `?brand=` (`readBrandParam`), and changes are mirrored into it with `history.replaceState`. In Storybook the component runs inside the docs iframe, so the mirror writes to the iframe's URL. If that proves unusable for sharing, the mirror is cut. A link to `…?path=/docs/…&brand=` is a nice-to-have, not a requirement.

### 5.3 Error handling

- **Invalid hex:** `Field` shows the error "Use #rgb or #rrggbb". The last valid theme stays rendered, and nothing blanks or throws.
- **A failing pairing:** the table marks the row, and `Export` shows an inline `role="status"` warning ("N pairings fail WCAG AA in this theme") above the buttons. `Banner` is imperative (`banner()` plus `BannerRegion`), so it is not used inline. Export is not blocked.
- **Clipboard unavailable or rejected:** `useCopyToClipboard` returns `[copied, copy]`, and `copy()` resolves `false` on failure. When it does, `Export` shows "Copy failed; select the text instead". The snippet is always visible in a `<pre>`.

### 5.4 Testing

| Test | Proves | Must fail when… |
|---|---|---|
| `logic.test.ts` (unit) | `isValidHex` accepts and rejects the same inputs as `normalizeHex`; `buildSnippet` normalises the hex; `readBrandParam` ignores invalid values | the regex drifts from `normalizeHex` |
| Story `Default` | Renders with `DEFAULT_BRAND`; play asserts the snippet contains `#2e5fd9` | the snippet is not built from state |
| Story `Pink` (`#c2185b`) | The preview re-themes; play asserts a preview Button's computed background differs from `Default`'s | `ThemeProvider` is dropped from `Preview` |
| Story `InvalidHex` | Play types `#zz`, asserts the field error, and asserts the snippet still shows the previous valid hex | the theme is regenerated from invalid input |
| Story `Download` | Play asserts the download link's Blob text equals `toCssText(generateTheme({ brand }))` | the export is built from a stale or different theme |
| axe (gate 5) | No violations on every generator story | — |
| gate 9 | Light and dark baselines for every generator story, added through the label sequence | — |

`main.ts`'s `stories` gains `'../docs/**/*.stories.@(ts|tsx)'`, so `test:stories`, axe and gate 9 pick these stories up.

### 5.5 Dependencies

`storybook/package.json` gains `"@ap/tokens": "file:../packages/tokens"` for `toCssText`, `contrastPairings`, `SEMANTIC_MAP`, `DEFAULT_BRAND`, `hexToOklch`, `wcagRatio` and `apcaLc`. The root lock is refreshed, and `check:lockfiles` stays green. `@ap/react`'s public API is unchanged.

## 6. Keeping the docs true

- **The `extractRegion` unit test** (`storybook/docs/lib/extractRegion.test.ts`) covers: found, missing (throws), duplicated (throws), unclosed (throws), and the indentation strip.
- **The docs reference check** (`scripts/docs-refs.test.ts`, in the unit project):
  - For every `storybook/docs/**/*.mdx`, every `?raw` import must resolve to an existing file.
  - Every `extractRegion(x, 'name')` call must name a region present in that file.
  - Every relative link must resolve.
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
| Region markers in fixtures get deleted by a later fixture edit | The docs reference check fails, and `extractRegion` throws at build |
| The generator's live preview is slow while dragging | The picker input is debounced; `generateTheme` is already fast enough for a gate that runs it thousands of times |
| Guide prose drifts from behaviour | Every rule names its gate; samples are quoted, not copied |
| Published text leaks private context | §1 rule: no employer, client or product names; the reviewer checks it |
