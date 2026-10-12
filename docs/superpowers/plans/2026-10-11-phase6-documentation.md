# Phase 6: documentation, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three guides (Getting started, SSR rules, Colour theory) and an interactive theme generator on the live Storybook. Every code sample is quoted from a gate-tested fixture, and every colour number is computed live.

**Architecture:**
- Guides are MDX pages in `storybook/docs/`. They quote marked regions of real fixture files through `extractRegion` and Vite `?raw` imports, so a sample cannot drift from code the gates build.
- The theme generator is a React component tree in `storybook/docs/generator/`, built on `@ap/tokens` and `@ap/react`. It has its own stories, so play tests, axe (gate 5) and screenshots (gate 9) cover it.
- A unit test checks every MDX reference: `?raw` targets, region names and relative links.

**Tech stack:** Storybook 10.6.0 (MDX, `@storybook/addon-docs` `<Source>`), Vite 8 `?raw`, React 19, `@ap/react`, `@ap/tokens`, Vitest 4, React Router 7 fixture, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-phase6-documentation-design.md` (amended 2026-10-11 against the code).

## Global constraints

- Every page is public. No employer, client or product names anywhere in published text (spec §1).
- Guides never hand-copy code. Samples come from `extractRegion(raw, name)` over fixture files (spec §4.0).
- Colour theory has no hard-coded hex values, ratios or Lc numbers. Every number is computed at render time (spec §4.3).
- No change to the public API of `@ap/react` or `@ap/tokens` (spec §2).
- Generator files live under `storybook/docs/generator/` and never ship in a package (spec §5.1).
- Fixture region markers: `// #region docs:<name>` / `// #endregion docs:<name>`. Inside JSX use `{/* #region docs:<name> */}` / `{/* #endregion docs:<name> */}` (spec §4.0).
- Node `22.22.0` in CI. Windows dev box: run Bash commands that pass `/apComponents/` with `MSYS_NO_PATHCONV=1`.
- Exact-optional types: public option props are written `?: T | undefined` (repo convention).
- Every behavioural test names its perturbation in a comment. Apply that perturbation once, watch the test fail, then revert (repo convention).

## Review focus

1. **A missing or renamed fixture region.** The Storybook build must fail loudly, and the docs reference check must fail. A blank `<Source>` must never ship. Owner: Task 1 (throws) and Task 8 (check).
2. **A hex typed with surrounding spaces, in uppercase, or as `#abc` shorthand.** It must be accepted, normalised (`#aabbcc`), and produce the same theme as its long lowercase form. Owner: Task 6 (`logic.test.ts` agreement table).
3. **`?brand=` holding junk (`?brand=zz`, `?brand=%23`, or empty).** The generator must fall back to `DEFAULT_BRAND` and never throw. Owner: Task 6 (`readBrandParam` tests).
4. **Dragging the native colour picker quickly.** The page must not regenerate on every input event, and the final colour must win. Owner: Task 7 (story `PickerDebounce`).
5. **The download is built from a stale theme** after a fast edit. The Blob text must equal `toCssText(generateTheme({ brand }))` for the brand shown in the snippet. Owner: Task 7 (story `Download`).

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `storybook/docs/lib/extractRegion.ts` (+ `.test.ts`) | 1 | Pull a named region out of a source string; list region names |
| `vitest.config.ts` | 1 | Unit include gains `storybook/docs/**/*.test.ts` |
| `storybook/.storybook/main.ts` | 1 | `stories` gains `../docs/**/*.stories.@(ts|tsx)` |
| `storybook/.storybook/preview.tsx` | 1 | `storySort` puts Guides first |
| `storybook/package.json`, `package-lock.json` | 1 | `@ap/tokens` dependency |
| `fixtures/ssr-app/app/routes/start.tsx` | 2 | Getting-started sample as a real route |
| `fixtures/ssr-app/app/routes.ts`, `vite.config.ts`, `root.tsx` | 2 | Route `/start`; regions `vite`, `ssr-noexternal`, `css` |
| `fixtures/consumer/vite.config.ts` | 2 | Region `spa-vite` |
| `packages/react/src/gates/ssr-render.gate.test.ts` | 2 | `/start` SSR assertion |
| `fixtures/ssr-app/e2e/hydration.spec.ts` | 2 | `/start` hydration assertion |
| `storybook/docs/GettingStarted.mdx` | 3 | Guide |
| `storybook/docs/SsrRules.mdx` | 4 | Guide |
| `storybook/docs/lib/colour.ts` (+ `.test.ts`) | 5 | HSL comparison ramp for the OKLCH explanation |
| `storybook/docs/ColourTheory.mdx`, `storybook/docs/lib/Swatches.tsx` | 5 | Guide and its swatch components |
| `storybook/docs/generator/logic.ts` (+ `.test.ts`) | 6 | `isValidHex`, `buildSnippet`, `readBrandParam`, `brandParamValue` |
| `storybook/docs/generator/*.tsx`, `ThemeGenerator.stories.tsx`, `storybook/docs/Generator.mdx` | 7 | Generator UI, stories and page |
| `scripts/docs-refs.ts`, `scripts/docs-refs.test.ts` | 8 | Docs reference check |
| `storybook/docs/Theming.mdx`, `docs/CONTRIBUTING.md` | 8 | Generator link; "Writing docs" section |
| Spec §2 table, plan retrospective, memory | 9 | Close-out |

---

### Task 1: Foundations (`extractRegion`, Storybook wiring and the `?raw` spike)

**Files:**
- Create: `storybook/docs/lib/extractRegion.ts`, `storybook/docs/lib/extractRegion.test.ts`
- Modify: `vitest.config.ts` (unit `include`), `storybook/.storybook/main.ts` (`stories`), `storybook/.storybook/preview.tsx` (`parameters.options.storySort`), `storybook/package.json`
- Temporary (deleted in Step 9): `storybook/docs/Spike.mdx`

**Interfaces:**
- Produces:
  - `extractRegion(raw: string, name: string): string`
  - `regionNames(raw: string): string[]`
  - the `../docs/**/*.stories.@(ts|tsx)` glob
  - `@ap/tokens` resolvable from `storybook/`

- [ ] **Step 1: Write the failing test** at `storybook/docs/lib/extractRegion.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { extractRegion, regionNames } from './extractRegion.js'

const SRC = [
  "import x from 'y'",
  '  // #region docs:alpha',
  '  const a = 1',
  '',
  '    nested()',
  '  // #endregion docs:alpha',
  '<div>',
  '  {/* #region docs:beta */}',
  '  <Button />',
  '  {/* #endregion docs:beta */}',
  '</div>',
].join('\n')

describe('extractRegion', () => {
  it('returns the lines between the markers with common indentation removed', () => {
    expect(extractRegion(SRC, 'alpha')).toBe('const a = 1\n\n  nested()')
  })
  it('reads the JSX comment form', () => {
    expect(extractRegion(SRC, 'beta')).toBe('<Button />')
  })
  it('handles CRLF input', () => {
    expect(extractRegion(SRC.replace(/\n/g, '\r\n'), 'beta')).toBe('<Button />')
  })
  it('throws when the region is missing', () => {
    expect(() => extractRegion(SRC, 'gamma')).toThrow(/no region "docs:gamma"/)
  })
  it('does not match a region whose name merely starts with the one asked for', () => {
    // Perturbation: drop the end anchor from the marker pattern, and "alph" matches "alpha".
    expect(() => extractRegion(SRC, 'alph')).toThrow(/no region/)
  })
  it('throws when the region appears twice', () => {
    expect(() => extractRegion(`${SRC}\n// #region docs:alpha\n// #endregion docs:alpha`, 'alpha')).toThrow(
      /appears 2 times/,
    )
  })
  it('throws when the region is not closed', () => {
    expect(() => extractRegion('// #region docs:open\nx', 'open')).toThrow(/not closed/)
  })
  it('throws on an empty region, so a guide never renders a blank block', () => {
    expect(() => extractRegion('// #region docs:e\n// #endregion docs:e', 'e')).toThrow(/is empty/)
  })
})

describe('regionNames', () => {
  it('lists every opened region once, in order', () => {
    expect(regionNames(SRC)).toEqual(['alpha', 'beta'])
  })
})
```

- [ ] **Step 2: Add the unit include, then run and watch it fail**

In `vitest.config.ts`, the unit project's `include` becomes:

```ts
          include: [
            'packages/*/src/**/*.test.{ts,tsx}',
            // Gate 10's pure budget logic lives beside its script, so the
            // unit run covers it without a separate config.
            'scripts/**/*.test.ts',
            // The docs site's pure helpers (extractRegion, generator logic).
            'storybook/docs/**/*.test.ts',
          ],
```

Run: `npx vitest run --project unit storybook/docs/lib`
Expected: FAIL, cannot resolve `./extractRegion.js`.

- [ ] **Step 3: Implement** `storybook/docs/lib/extractRegion.ts`

```ts
// Guides quote fixture code by named region rather than copying it, so a
// sample cannot drift from code the gates build and run (Phase 6 spec §4.0).
// Markers: `// #region docs:<name>` … `// #endregion docs:<name>`, or the JSX
// form `{/* #region docs:<name> */}`.

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const marker = (kind: 'region' | 'endregion', name: string): RegExp =>
  new RegExp(`^\\s*(?:\\/\\/|\\{\\/\\*)\\s*#${kind} docs:${escape(name)}\\s*(?:\\*\\/\\})?\\s*$`)

const ANY_REGION = /^\s*(?:\/\/|\{\/\*)\s*#region docs:([\w-]+)\s*(?:\*\/\})?\s*$/

export function regionNames(raw: string): string[] {
  const names: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const m = ANY_REGION.exec(line)
    if (m && !names.includes(m[1]!)) names.push(m[1]!)
  }
  return names
}

export function extractRegion(raw: string, name: string): string {
  const lines = raw.split(/\r?\n/)
  const open = marker('region', name)
  const starts = lines.flatMap((line, i) => (open.test(line) ? [i] : []))
  if (starts.length === 0) throw new Error(`extractRegion: no region "docs:${name}"`)
  if (starts.length > 1) throw new Error(`extractRegion: region "docs:${name}" appears ${starts.length} times`)
  const start = starts[0]! + 1
  const close = marker('endregion', name)
  const length = lines.slice(start).findIndex((line) => close.test(line))
  if (length === -1) throw new Error(`extractRegion: region "docs:${name}" is not closed`)
  const body = lines.slice(start, start + length)
  const indents = body.filter((l) => l.trim() !== '').map((l) => /^\s*/.exec(l)![0].length)
  if (indents.length === 0) throw new Error(`extractRegion: region "docs:${name}" is empty`)
  const strip = Math.min(...indents)
  return body.map((l) => l.slice(strip)).join('\n')
}
```

- [ ] **Step 4: Run and watch it pass, then apply the perturbation**

Run: `npx vitest run --project unit storybook/docs/lib`. Expected: 9 passed.
Apply the named perturbation once (remove `\\s*(?:\\*\\/\\})?\\s*$` from `marker`). The "merely starts with" test must fail. Revert.

- [ ] **Step 5: Storybook wiring**

`storybook/.storybook/main.ts`, `stories`:

```ts
  stories: [
    '../../packages/react/src/**/*.stories.@(ts|tsx)',
    '../docs/**/*.mdx',
    // The theme generator's stories (Phase 6), so play, axe and gate 9 cover it.
    '../docs/**/*.stories.@(ts|tsx)',
  ],
```

`storybook/.storybook/preview.tsx`: add to `parameters`, beside `a11y`:

```ts
    options: {
      // Getting started is first in this order, so it is the landing page.
      storySort: {
        order: ['Guides', ['Getting started', 'SSR rules', 'Colour theory'], 'Foundations', 'Components'],
      },
    },
```

`storybook/package.json` `dependencies` gains `"@ap/tokens": "file:../packages/tokens"`. Run `npm install` at the root, then `npm run check:lockfiles`. Expected: OK. `git diff package-lock.json` shows only the `@ap/tokens` entry for `storybook`.

- [ ] **Step 6: The `?raw` spike** (spec §8, risk 1)

Create `storybook/docs/Spike.mdx`:

```mdx
import { Meta, Source } from '@storybook/addon-docs/blocks'
import raw from '../../fixtures/consumer/vite.config.ts?raw'
import { extractRegion } from './lib/extractRegion'

<Meta title="Guides/Spike" />

<Source language="ts" code={extractRegion(raw.replace('plugins:', '// #region docs:spike\n  plugins:').replace('],\n', '],\n// #endregion docs:spike\n'), 'spike')} />
```

Run: `MSYS_NO_PATHCONV=1 STORYBOOK_BASE_PATH=/apComponents/ npm --prefix storybook run build`
Expected: exit 0. Then `grep -l "apComponents()" storybook/storybook-static/assets/*.js` names at least one file, so the quoted code reached the bundle.

- If `?raw` fails to resolve for a file outside `storybook/`, check `server.fs.allow` in `main.ts` first. It already allows the repo root.
- If it still fails, STOP and report. The guides' quoting design depends on this working.

- [ ] **Step 7: Prove a missing region fails the build**

Change `'spike'` in the `extractRegion` call to `'nope'`. Re-run `npm --prefix storybook run build`, then `npx vitest run --project storybook --reporter=dot 2>&1 | tail -5`.

Record which of the two surfaces the throw. Expected: the storybook vitest project fails on `Guides/Spike`. If the static build alone stays green, the docs reference check (Task 8) is the build-time net. Write the observation into the task report.

- [ ] **Step 8: Typecheck**

Run: `npm --prefix storybook run typecheck`, then `npm run typecheck`. Expected: clean.

- [ ] **Step 9: Delete the spike and commit**

```bash
rm storybook/docs/Spike.mdx
git add storybook/docs/lib vitest.config.ts storybook/.storybook storybook/package.json package-lock.json
git commit -m "feat(docs): extractRegion, the docs stories glob, Guides-first sort, @ap/tokens in storybook"
```

---

### Task 2: The `/start` fixture route and the quotable regions

**Files:**
- Create: `fixtures/ssr-app/app/routes/start.tsx`
- Modify:
  - `fixtures/ssr-app/app/routes.ts`
  - `fixtures/ssr-app/vite.config.ts` (regions `vite`, `ssr-noexternal`)
  - `fixtures/ssr-app/app/root.tsx` (region `css`)
  - `fixtures/consumer/vite.config.ts` (region `spa-vite`)
  - `packages/react/src/gates/ssr-render.gate.test.ts`
  - `fixtures/ssr-app/e2e/hydration.spec.ts`

**Interfaces:**
- Consumes: none.
- Produces these regions, which Task 3 quotes:
  - `fixtures/ssr-app/vite.config.ts`: `vite`, `ssr-noexternal`
  - `fixtures/ssr-app/app/root.tsx`: `css`
  - `fixtures/ssr-app/app/routes/start.tsx`: `start`
  - `fixtures/consumer/vite.config.ts`: `spa-vite`

- [ ] **Step 1: Write the failing SSR assertion**

In `ssr-render.gate.test.ts`, inside `describe('gate 6: React Router 8 framework-mode SSR', …)` after the form-route test:

```ts
  it('serves the getting-started route: ApProvider, a labelled input and a button, in the markup', async () => {
    // Guides/Getting started quotes this route (Phase 6 spec §4.1a), so the
    // sample a reader copies is proven to server-render.
    // Perturbation: drop `label="Email"` from start.tsx, and the label match fails.
    const res = await fetchAsBrowser(`${base}/start`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/<label[^>]*>Email<\/label>/)
    expect(html).toMatch(/<input[^>]*\sname="email"/)
    expect(html).toMatch(/<button[^>]*>Subscribe<\/button>/)
  })
```

Run: `npm run test:ssr`. Expected: FAIL on the 404 status.

- [ ] **Step 2: Write the route** `fixtures/ssr-app/app/routes/start.tsx`

```tsx
// The Getting started guide quotes the `start` region of this file verbatim
// (storybook/docs/GettingStarted.mdx). Keep fixture-only notes OUTSIDE it.
// #region docs:start
import { ApProvider, Button, Field, Input } from '@ap/react'

export default function Start() {
  return (
    <ApProvider>
      <main>
        <h1>Join the newsletter</h1>
        <form method="post" action="/subscribe">
          <Field label="Email" hint="We send one email a month.">
            <Input name="email" type="email" required />
          </Field>
          <Button type="submit">Subscribe</Button>
        </form>
      </main>
    </ApProvider>
  )
}
// #endregion docs:start
```

`routes.ts`: after the `theme` route, add:

```ts
  // Quoted by the Getting started guide. No loader or action, so routed in both modes.
  route('start', 'routes/start.tsx'),
```

Run: `npm run test:ssr`. Expected: PASS.

- If `<label[^>]*>Email</label>` does not match because `Field` renders extra markup inside the label, loosen it to `/<label[^>]*>[^<]*Email/` and write a comment saying why.
- Perturb as named, then revert.

- [ ] **Step 3: Hydration assertion**

In `hydration.spec.ts`, after the home-route test:

```ts
test('getting-started route hydrates with no React warnings or recoverable errors', async ({ page }) => {
  // ApProvider is mounted on this route only. It writes the scheme to <html>,
  // which is the hydration path the guide's reader will take.
  // Perturbation: render `{String(Date.now())}` inside <main> in start.tsx.
  const messages = collect(page)
  await page.goto('/start')
  await expect(page.getByRole('button', { name: 'Subscribe' })).toBeVisible()
  await waitForHydration(page)
  await page.waitForTimeout(200)
  expect(await recoverableErrors(page), 'onRecoverableError fired').toEqual([])
  expect(messages, `unexpected console output:\n${messages.join('\n')}`).toEqual([])
})
```

Run: `npm run test:hydration`. Expected: PASS.

Apply the perturbation: temporarily add `<p>{String(Date.now())}</p>` inside `<main>` in `start.tsx`. Watch the test fail, then revert the file exactly, with `git diff fixtures/ssr-app/app/routes/start.tsx` empty afterwards.

If ApProvider's `<html>` write produces a console message, that is a real finding. STOP and report it; do not add it to `IGNORED`.

- [ ] **Step 4: Mark the regions**

`fixtures/ssr-app/vite.config.ts`:
- wrap the `plugins:` line in `// #region docs:vite` / `// #endregion docs:vite`;
- wrap the `ssr: { noExternal: … }` line in `// #region docs:ssr-noexternal` / `// #endregion docs:ssr-noexternal`.

Put the markers directly around those lines, and leave the long comments above them outside.

`fixtures/ssr-app/app/root.tsx`: wrap the three CSS imports, and the two comment lines between them, in `// #region docs:css` / `// #endregion docs:css`.

`fixtures/consumer/vite.config.ts`: wrap the `plugins:` line in `// #region docs:spa-vite` / `// #endregion docs:spa-vite`.

- [ ] **Step 5: Re-run the fixture gates**

Run: `npm run test:ssr`, then `npm run test:spa`, then `npm run test:hydration`, then `npm run test:consumer`. Expected: all green. Markers are comments, so behaviour is unchanged.

- [ ] **Step 6: Commit**

```bash
git add fixtures packages/react/src/gates/ssr-render.gate.test.ts
git commit -m "feat(fixtures): /start route for the getting-started guide, and docs regions"
```

---

### Task 3: Guide, Getting started

**Files:**
- Create: `storybook/docs/GettingStarted.mdx`

**Interfaces:**
- Consumes: `extractRegion` (Task 1), and the regions `vite`, `ssr-noexternal`, `css`, `start` and `spa-vite` (Task 2).

- [ ] **Step 1: Write the page**

The header is exact:

```mdx
import { Meta, Source } from '@storybook/addon-docs/blocks'
import { extractRegion } from './lib/extractRegion'
import ssrVite from '../../fixtures/ssr-app/vite.config.ts?raw'
import rootTsx from '../../fixtures/ssr-app/app/root.tsx?raw'
import startTsx from '../../fixtures/ssr-app/app/routes/start.tsx?raw'
import spaVite from '../../fixtures/consumer/vite.config.ts?raw'
import consumerPkg from '../../fixtures/consumer/package.json?raw'
import './docs.css'

<Meta title="Guides/Getting started" />
```

Sections, in order, matching spec §4.1. Each sample is a `<Source>` block. For example:

```mdx
<Source language="ts" code={extractRegion(ssrVite, 'vite')} />
```

1. **What you get:**
   - one paragraph;
   - a table of the four packages: `@ap/react` (components, providers, hooks at `/hooks`, formatters at `/format`), `@ap/tokens` (the colour engine and `generateTheme`), `@ap/vite` (the build preset), `@ap/motion` (the motion tokens, already inside `@ap/react`'s CSS).
2. **Add the submodule:**
   - a fenced shell block, typed by hand because it is a command, not code: `git submodule add https://github.com/andrew-caines/apComponents vendor/apComponents`;
   - then `<Source language="json" code={JSON.stringify({ dependencies: { '@ap/react': JSON.parse(consumerPkg).dependencies['@ap/react'] }, devDependencies: { '@ap/vite': JSON.parse(consumerPkg).devDependencies['@ap/vite'] } }, null, 2)} />`, with prose saying the path is relative to your app.
3. **Wire Vite:**
   - region `vite`;
   - prose on what `apComponents()` sets: vanilla-extract, `ssr.noExternal` for `@ap/*`, and `build.cssTarget` = `AP_CSS_TARGET` (Chrome/Edge 120, Firefox 114, Safari 16.4) unless you set `build.target` or `build.cssTarget`;
   - then a callout paragraph and region `ssr-noexternal` for SSR apps consuming through `file:`. Link to CONTRIBUTING's "second React" section on GitHub: `https://github.com/andrew-caines/apComponents/blob/main/docs/CONTRIBUTING.md`.
4. **Load the CSS:** region `css`. One sentence each on `fonts.css`, `theme.css` and `motion.css`, and why `motion.css` is load-bearing.
5. **Wrap and render:** region `start`. Prose: `ApProvider` composes theme, locale, icons and notifications; `Field` derives the label and description wiring. The form submits before hydration, because the controls are uncontrolled. Link to `?path=/docs/foundations-theming--docs`.
6. **SPA instead of SSR:** region `spa-vite`. The same `start` component works unchanged in a client-only app.
7. **Next:** links to SSR rules (`?path=/docs/guides-ssr-rules--docs`), Theming, Theme generator (`?path=/docs/foundations-theme-generator--docs`) and Components.

Copy rule: no employer, client or product names. Use "your app".

- [ ] **Step 2: Build and inspect**

Run: `npm --prefix storybook run build`. Expected: exit 0.

Run `npx storybook dev` (or `npm --prefix storybook run dev`) and open `Guides/Getting started`. It must be the first sidebar entry and the landing page. Every `<Source>` must be non-empty.

Run: `npx vitest run --project storybook --reporter=dot`. Expected: green.

- [ ] **Step 3: Commit**

```bash
git add storybook/docs/GettingStarted.mdx
git commit -m "docs(storybook): Getting started guide, quoted from the fixtures"
```

---

### Task 4: Guide, SSR rules

**Files:**
- Create: `storybook/docs/SsrRules.mdx`

**Interfaces:**
- Consumes: `extractRegion` and the region `ssr-noexternal`.

- [ ] **Step 1: Write the page**

```mdx
import { Meta, Source } from '@storybook/addon-docs/blocks'
import { extractRegion } from './lib/extractRegion'
import ssrVite from '../../fixtures/ssr-app/vite.config.ts?raw'
import './docs.css'

<Meta title="Guides/SSR rules" />
```

One `##` section per rule in spec §4.2's table, in that order. Each section has four labelled paragraphs:
- **Rule.**
- **Why.**
- **Broken looks like.** The concrete symptom: the hydration warning text, the null-dispatcher `TypeError`, or the missing popup markup.
- **Enforced by.** The gate name plus a GitHub link to the test file on `main`.

Sources:
- `docs/CONTRIBUTING.md` sections: "Rules the gates enforce", "`@base-ui/react` left external…", "`hidden="until-found"` is client-only", and "The CSS browser floor (Chrome 120)";
- `docs/adr/0005-rendering-targets.md`;
- `docs/adr/0012-cross-cutting-services.md` (the hooks that defer to an effect).

The Base UI rule shows region `ssr-noexternal`. Name the hooks that replace render-time reads: `useHydrated`, `useMediaQuery`, `useLocalStorage`/`useSessionStorage` and `useFormatter`.

Copy rule: no employer, client or product names.

- [ ] **Step 2: Build and check**

Run: `npm --prefix storybook run build`, then `npx vitest run --project storybook --reporter=dot`. Expected: green.

- [ ] **Step 3: Commit**

```bash
git add storybook/docs/SsrRules.mdx
git commit -m "docs(storybook): SSR rules guide, each rule tied to its gate"
```

---

### Task 5: Guide, Colour theory

**Files:**
- Create: `storybook/docs/lib/colour.ts`, `storybook/docs/lib/colour.test.ts`, `storybook/docs/lib/Swatches.tsx`, `storybook/docs/ColourTheory.mdx`

**Interfaces:**
- Consumes: from `@ap/tokens`, `generateTheme`, `DEFAULT_BRAND`, `hexToOklch`, `wcagRatio`, `apcaLc`, `contrastPairings`, `SEMANTIC_MAP`, and the types `Ramp` and `RampName`.
- Produces:
  - `hslRamp(hex: string, steps: number): string[]`
  - `oklchLightness(hex: string): number`
  - `<RampStrip hexes={string[]} label={string} />`
  - `<RampTable theme={Theme} mode={'light' | 'dark'} />`

- [ ] **Step 1: Write the failing test** at `storybook/docs/lib/colour.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { hslRamp, oklchLightness } from './colour.js'

describe('hslRamp', () => {
  it('returns `steps` hex colours from light to dark at the seed hue', () => {
    const ramp = hslRamp('#2e5fd9', 5)
    expect(ramp).toHaveLength(5)
    for (const hex of ramp) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    // Perturbation: iterate lightness upwards, and this ordering fails.
    const ls = ramp.map(oklchLightness)
    expect([...ls].sort((a, b) => b - a)).toEqual(ls)
  })
  it('spaces HSL lightness evenly, which OKLCH shows is NOT perceptually even', () => {
    // The guide's whole point: equal HSL steps give unequal perceived steps.
    const ls = hslRamp('#2e5fd9', 6).map(oklchLightness)
    const gaps = ls.slice(1).map((l, i) => ls[i]! - l)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.02)
  })
})
```

Run: `npx vitest run --project unit storybook/docs/lib/colour`. Expected: FAIL, the module is missing.

- [ ] **Step 2: Implement** `storybook/docs/lib/colour.ts`

```ts
import { hexToOklch, normalizeHex } from '@ap/tokens'

// Only for the Colour theory guide's comparison strip: a naive HSL ramp, to
// show why the engine does not build ramps this way.
const toHex = (n: number): string => Math.round(n * 255).toString(16).padStart(2, '0')

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number): number => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

function hexToHs(hex: string): { h: number; s: number } {
  const full = normalizeHex(hex)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0 }
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s }
}

/** `steps` colours at the seed's HSL hue and saturation, lightness evenly spaced 0.95 → 0.15. */
export function hslRamp(hex: string, steps: number): string[] {
  const { h, s } = hexToHs(hex)
  return Array.from({ length: steps }, (_, i) => hslToHex(h, s, 0.95 - (0.8 * i) / (steps - 1)))
}

export function oklchLightness(hex: string): number {
  return hexToOklch(hex).l
}
```

Check the `Oklch` field name first. Read `packages/tokens/src/colour/types.ts`; if the lightness key is not `l`, use the actual key.

Run the test. Expected: PASS. Apply the named perturbation, then revert.

- [ ] **Step 3: Swatch components** `storybook/docs/lib/Swatches.tsx`

```tsx
import type { Theme } from '@ap/tokens'
import { SEMANTIC_MAP } from '@ap/tokens'
import type { RampName } from '@ap/tokens'

const RAMPS: RampName[] = ['brand', 'neutral', 'danger', 'warning', 'success', 'info']

export function RampStrip({ hexes, label }: { hexes: string[]; label: string }) {
  return (
    <figure className="stack" style={{ margin: 0 }}>
      <figcaption className="mono">{label}</figcaption>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${hexes.length}, 1fr)` }}>
        {hexes.map((hex, i) => (
          <div key={i} title={hex} style={{ background: hex, blockSize: '2.5rem' }} />
        ))}
      </div>
    </figure>
  )
}

/** Six ramps × twelve steps for one mode, every value read from the theme. */
export function RampTable({ theme, mode }: { theme: Theme; mode: 'light' | 'dark' }) {
  return (
    <div className="stack">
      {RAMPS.map((name) => (
        <RampStrip key={name} label={`${name} (${mode})`} hexes={theme.ramps[mode][name].steps.map((s) => s.hex)} />
      ))}
    </div>
  )
}

/** Which semantic tokens read each step, from SEMANTIC_MAP, not a retyped list. */
export function StepRoles() {
  const byStep = new Map<string, string[]>()
  for (const e of SEMANTIC_MAP) {
    const key = String(e.step)
    byStep.set(key, [...(byStep.get(key) ?? []), `${e.token} (${e.ramp})`])
  }
  return (
    <table>
      <thead>
        <tr><th>Step</th><th>Read by</th></tr>
      </thead>
      <tbody>
        {[...byStep.entries()].map(([step, tokens]) => (
          <tr key={step}>
            <td className="mono">{step}</td>
            <td className="mono">{tokens.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Write the page** `storybook/docs/ColourTheory.mdx`

```mdx
import { Meta } from '@storybook/addon-docs/blocks'
import { generateTheme, DEFAULT_BRAND, contrastPairings, apcaLc, wcagRatio } from '@ap/tokens'
import { hslRamp } from './lib/colour'
import { RampStrip, RampTable, StepRoles } from './lib/Swatches'
import './docs.css'

export const THEME = generateTheme({ brand: DEFAULT_BRAND })
export const HEADLINE = contrastPairings(THEME).filter((p) => p.mode === 'light').slice(0, 6)

<Meta title="Guides/Colour theory" />
```

Sections per spec §4.3:
1. **Why OKLCH:** `<RampStrip label="HSL, even lightness steps" hexes={hslRamp(DEFAULT_BRAND, 12)} />` above `<RampStrip label="apComponents brand ramp" hexes={THEME.ramps.light.brand.steps.map((s) => s.hex)} />`.
2. **From one seed to six ramps:** `<RampTable theme={THEME} mode="light" />` and `mode="dark"`.
3. **Twelve steps, each with a job:** `<StepRoles />`.
4. **Contrast policy:** a JSX table over `HEADLINE` with columns pairing, fg/bg hex, `ratio.toFixed(2)`, required, `apca.toFixed(1)`, and pass. Prose: AA is the gate (ADR-0008), and APCA is reported.
5. **Gamut:** prose. Each `RampStep` carries `p3`, which is non-null when a step is wider than sRGB; count them live with `THEME.ramps.light.brand.steps.filter((s) => s.p3).length`.
6. **Try it:** link to `?path=/docs/foundations-theme-generator--docs`.

No hex value, ratio or Lc number is typed in prose. Each one comes from an expression.

- [ ] **Step 5: Build, check and commit**

Run: `npm --prefix storybook run typecheck`, then `npm --prefix storybook run build`, then `npx vitest run --project storybook --reporter=dot`, then `npx vitest run --project unit storybook/docs`. Expected: green.

```bash
git add storybook/docs/lib storybook/docs/ColourTheory.mdx
git commit -m "docs(storybook): Colour theory guide, every number computed live"
```

---

### Task 6: Generator logic

**Files:**
- Create: `storybook/docs/generator/logic.ts`, `storybook/docs/generator/logic.test.ts`

**Interfaces:**
- Produces:
  - `HEX_PATTERN: RegExp`
  - `isValidHex(v: string): boolean`
  - `buildSnippet(hex: string): string`
  - `readBrandParam(search: string): string | null` (returns a normalised `#rrggbb` or `null`)
  - `brandParamValue(hex: string): string` (`'#2E5FD9'` → `'2e5fd9'`)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { normalizeHex } from '@ap/tokens'
import { brandParamValue, buildSnippet, isValidHex, readBrandParam } from './logic.js'

const CASES = ['#2e5fd9', '#2E5FD9', '  #2e5fd9 ', '#abc', '#ABC', 'abc', '#abcd', '#gggggg', '', '#', '#2e5fd9ff']

describe('isValidHex', () => {
  it.each(CASES)('agrees with normalizeHex on %j', (input) => {
    // Perturbation: drop the `i` flag from HEX_PATTERN, and the uppercase rows disagree.
    let accepted = true
    try {
      normalizeHex(input)
    } catch {
      accepted = false
    }
    expect(isValidHex(input)).toBe(accepted)
  })
})

describe('buildSnippet', () => {
  it('imports from @ap/react and passes the normalised hex', () => {
    expect(buildSnippet(' #ABC ')).toBe(
      "import { generateTheme } from '@ap/react'\n\nexport const theme = generateTheme({ brand: '#aabbcc' })\n",
    )
  })
})

describe('readBrandParam', () => {
  it('reads a bare hex', () => expect(readBrandParam('?brand=c2185b')).toBe('#c2185b'))
  it('reads an encoded hash', () => expect(readBrandParam('?brand=%23C2185B')).toBe('#c2185b'))
  it.each(['', '?brand=', '?brand=zz', '?brand=%23', '?other=1'])('returns null for %j', (s) => {
    // Perturbation: return the raw value without isValidHex, and "zz" leaks through.
    expect(readBrandParam(s)).toBeNull()
  })
})

describe('brandParamValue', () => {
  it('strips the hash and lowercases', () => expect(brandParamValue('#2E5FD9')).toBe('2e5fd9'))
})
```

Run: `npx vitest run --project unit storybook/docs/generator`. Expected: FAIL, the module is missing.

- [ ] **Step 2: Implement** `storybook/docs/generator/logic.ts`

```ts
import { normalizeHex } from '@ap/tokens'

/** The same shape `normalizeHex` accepts: `#rgb` or `#rrggbb`, any case. */
export const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export function isValidHex(v: string): boolean {
  return HEX_PATTERN.test(v.trim())
}

export function buildSnippet(hex: string): string {
  return `import { generateTheme } from '@ap/react'\n\nexport const theme = generateTheme({ brand: '${normalizeHex(hex)}' })\n`
}

/** `?brand=` with or without the leading `#`. Anything invalid is ignored, never thrown. */
export function readBrandParam(search: string): string | null {
  const v = new URLSearchParams(search).get('brand')
  if (!v) return null
  const hex = v.startsWith('#') ? v : `#${v}`
  return isValidHex(hex) ? normalizeHex(hex) : null
}

export function brandParamValue(hex: string): string {
  return normalizeHex(hex).slice(1)
}
```

- [ ] **Step 3: Pass, perturb, commit**

Run the tests. Expected: all pass. Apply each named perturbation once, then revert.

```bash
git add storybook/docs/generator/logic.ts storybook/docs/generator/logic.test.ts
git commit -m "feat(docs): theme generator logic: hex validation, snippet, ?brand= param"
```

---

### Task 7: Generator UI, stories and page

**Files:**
- Create in `storybook/docs/generator/`: `ThemeGenerator.tsx`, `SeedInput.tsx`, `RampView.tsx`, `ContrastTable.tsx`, `Preview.tsx`, `Export.tsx`, `generator.css`, `ThemeGenerator.stories.tsx`
- Create: `storybook/docs/Generator.mdx`

**Interfaces:**
- Consumes: Task 6's `logic.ts`; Task 5's `RampTable`; from `@ap/react`: `ThemeProvider`, `Button`, `Field`, `Input`, `Checkbox`, `Switch`, `Select`, `Tabs`; from `@ap/react/hooks`: `useCopyToClipboard` and `useDebouncedValue`; from `@ap/tokens`: `generateTheme`, `toCssText`, `contrastPairings`, `DEFAULT_BRAND` and `Theme`.
- Produces: `ThemeGenerator({ initialBrand?: string | undefined; syncUrl?: boolean | undefined })`.

- [ ] **Step 1: Probe nested-scheme scoping** (spec §5.1, Preview)

In a scratch story, render:

```tsx
<ThemeProvider theme={generateTheme({ brand: '#c2185b' })} scheme="dark"><Button>x</Button></ThemeProvider>
```

Inside the page's light scheme, read the button's computed `background-color`. Compare it with the dark brand step 9 hex from `generateTheme({ brand: '#c2185b' }).ramps.dark.brand.steps[8].hex`.

- **They match:** `Preview` renders light and dark side by side.
- **They don't:** `Preview` renders once and follows the page scheme. Record that in the task report.

Delete the scratch story either way.

- [ ] **Step 2: Write the stories first** (`ThemeGenerator.stories.tsx`)

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { generateTheme, toCssText } from '@ap/tokens'
import { ThemeGenerator } from './ThemeGenerator.js'

const meta = {
  title: 'Foundations/Theme generator/Stories',
  component: ThemeGenerator,
  args: { syncUrl: false },
} satisfies Meta<typeof ThemeGenerator>
export default meta
type Story = StoryObj<typeof meta>

const snippet = (root: HTMLElement) => within(root).getByTestId('snippet')

/** Perturbation: build the snippet from DEFAULT_BRAND instead of state, and Pink fails. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(snippet(canvasElement)).toHaveTextContent("brand: '#2e5fd9'")
  },
}

/** Perturbation: render Preview's children without ThemeProvider, and the backgrounds match. */
export const Pink: Story = {
  args: { initialBrand: '#c2185b' },
  play: async ({ canvasElement }) => {
    await expect(snippet(canvasElement)).toHaveTextContent("brand: '#c2185b'")
    const btn = within(within(canvasElement).getByTestId('preview')).getAllByRole('button', { name: 'Primary' })[0]!
    const expected = generateTheme({ brand: '#c2185b' }).ramps.light.brand.steps[8]!.hex
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(expected.slice(i, i + 2), 16))
    await expect(getComputedStyle(btn).backgroundColor).toBe(`rgb(${r}, ${g}, ${b})`)
  },
}

/** Perturbation: pass the draft hex to generateTheme unvalidated, and this throws or blanks. */
export const InvalidHex: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement)
    const hex = c.getByLabelText('Brand colour (hex)')
    await userEvent.clear(hex)
    await userEvent.type(hex, '#zz')
    await expect(await c.findByText('Use #rgb or #rrggbb')).toBeVisible()
    await expect(snippet(canvasElement)).toHaveTextContent("brand: '#2e5fd9'")
  },
}

/** Perturbation: build the Blob from a theme memoised once on mount, and the text differs after the edit. */
export const Download: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement)
    const hex = c.getByLabelText('Brand colour (hex)')
    await userEvent.clear(hex)
    await userEvent.type(hex, '#00897b')
    await waitFor(() => expect(snippet(canvasElement)).toHaveTextContent("brand: '#00897b'"))
    const link = c.getByRole('link', { name: 'Download theme.css' }) as HTMLAnchorElement
    await expect(link).toHaveAttribute('download', 'theme.css')
    // The Blob URL is replaced in an effect one commit after the snippet, and the
    // old URL is revoked, so a fetch of a stale href throws. waitFor retries until
    // the link serves the theme for the brand the snippet shows.
    const expected = toCssText(generateTheme({ brand: '#00897b' }))
    await waitFor(async () => expect(await (await fetch(link.href)).text()).toBe(expected))
  },
}

/** Review focus 4. Perturbation: drop useDebouncedValue, and the theme regenerates per event (the counter exceeds 2). */
export const PickerDebounce: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement)
    const picker = c.getByLabelText('Brand colour (picker)') as HTMLInputElement
    const before = Number(c.getByTestId('generations').dataset.count)
    for (const v of ['#111111', '#222222', '#333333', '#444444', '#c2185b']) {
      picker.value = v
      picker.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await waitFor(() => expect(snippet(canvasElement)).toHaveTextContent("brand: '#c2185b'"))
    await expect(Number(c.getByTestId('generations').dataset.count) - before).toBeLessThanOrEqual(2)
  },
}
```

Run: `npx vitest run --project storybook storybook/docs/generator`. Expected: FAIL, `ThemeGenerator` is missing.

- [ ] **Step 3: Implement the components**

`ThemeGenerator.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_BRAND, generateTheme, normalizeHex } from '@ap/tokens'
import { useDebouncedValue } from '@ap/react/hooks'
import { brandParamValue, readBrandParam } from './logic.js'
import { SeedInput } from './SeedInput.js'
import { RampView } from './RampView.js'
import { ContrastTable } from './ContrastTable.js'
import { Preview } from './Preview.js'
import { Export } from './Export.js'
import './generator.css'

export interface ThemeGeneratorProps {
  /** Starting brand. Overrides `?brand=`. Defaults to the house brand. */
  initialBrand?: string | undefined
  /** Read `?brand=` on mount and mirror changes into it. Stories turn this off. */
  syncUrl?: boolean | undefined
}

export function ThemeGenerator({ initialBrand, syncUrl = true }: ThemeGeneratorProps) {
  const [brand, setBrand] = useState(() =>
    normalizeHex(initialBrand ?? (syncUrl ? readBrandParam(window.location.search) : null) ?? DEFAULT_BRAND),
  )
  const settled = useDebouncedValue(brand, 100)
  const generations = useRef(0)
  const theme = useMemo(() => {
    generations.current += 1
    return generateTheme({ brand: settled })
  }, [settled])

  useEffect(() => {
    if (!syncUrl) return
    const url = new URL(window.location.href)
    url.searchParams.set('brand', brandParamValue(settled))
    window.history.replaceState(null, '', url)
  }, [settled, syncUrl])

  return (
    <div className="gen">
      <SeedInput value={brand} onChange={setBrand} />
      <span hidden data-testid="generations" data-count={generations.current} />
      <Preview theme={theme} />
      <RampView theme={theme} />
      <ContrastTable theme={theme} />
      <Export theme={theme} brand={settled} />
    </div>
  )
}
```

Check `useDebouncedValue`'s signature first: `grep -n "export function useDebouncedValue" -A4 packages/react/src/hooks/useDebouncedValue.ts`. If the argument order differs, use the real one.

`SeedInput.tsx`:

```tsx
import { useState } from 'react'
import { Field, Input } from '@ap/react'
import { isValidHex } from './logic.js'

export function SeedInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    // The picker moved the value; follow it unless the user is mid-edit on an invalid draft.
    setLastValue(value)
    if (isValidHex(draft)) setDraft(value)
  }
  const invalid = !isValidHex(draft)
  return (
    <div className="gen-seed">
      <label className="gen-picker">
        <span>Brand colour (picker)</span>
        <input type="color" aria-label="Brand colour (picker)" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
      <Field label="Brand colour (hex)" {...(invalid ? { error: 'Use #rgb or #rrggbb' } : {})}>
        <Input
          value={draft}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value)
            if (isValidHex(e.target.value)) onChange(e.target.value.trim())
          }}
        />
      </Field>
    </div>
  )
}
```

The picker has both a visible `<span>` and an `aria-label`. If axe flags `label-content-name-mismatch`, drop the `aria-label`, since the wrapping `<label>` names the input.

`RampView.tsx`:

```tsx
import type { Theme } from '@ap/tokens'
import { RampTable } from '../lib/Swatches.js'

export function RampView({ theme }: { theme: Theme }) {
  return (
    <section aria-labelledby="gen-ramps">
      <h2 id="gen-ramps">Ramps</h2>
      <div className="gen-two">
        <RampTable theme={theme} mode="light" />
        <RampTable theme={theme} mode="dark" />
      </div>
    </section>
  )
}
```

`ContrastTable.tsx`:

```tsx
import { contrastPairings, type Theme } from '@ap/tokens'

export function ContrastTable({ theme }: { theme: Theme }) {
  const rows = contrastPairings(theme)
  return (
    <section aria-labelledby="gen-contrast">
      <h2 id="gen-contrast">Contrast</h2>
      <table>
        <thead>
          <tr>
            <th>Mode</th><th>Text</th><th>On</th><th>WCAG</th><th>Needs</th><th>APCA Lc</th><th>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={`${p.mode}-${p.fg}-${p.bg}`} data-pass={p.pass}>
              <td>{p.mode}</td>
              <td className="mono">{p.fg}</td>
              <td className="mono">{p.bg}</td>
              <td>{p.ratio.toFixed(2)}:1</td>
              <td>{p.required}:1</td>
              <td>{p.apca.toFixed(1)}</td>
              <td>{p.pass ? 'Pass' : 'Fail'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
```

`Preview.tsx` (shown for the side-by-side case; for the single case, render `<Panel />` once with no `scheme`):

```tsx
import { Button, Checkbox, Field, Input, Select, Switch, Tabs, ThemeProvider } from '@ap/react'
import type { Theme } from '@ap/tokens'

function Panel() {
  return (
    <div className="stack">
      <div className="row">
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button tone="danger">Delete</Button>
      </div>
      <Field label="Name"><Input defaultValue="Ada Lovelace" /></Field>
      <Field label="Email" error="That is not an email address."><Input defaultValue="ada" /></Field>
      <Checkbox label="Subscribe" defaultChecked />
      <Switch label="Notifications" defaultChecked />
      <Field label="Country">
        <Select options={[{ value: 'ca', label: 'Canada' }, { value: 'fr', label: 'France' }]} defaultValue="ca" />
      </Field>
      <Tabs aria-label="Sections" items={[
        { value: 'a', label: 'Overview', content: <p>Overview</p> },
        { value: 'b', label: 'Details', content: <p>Details</p> },
      ]} />
    </div>
  )
}

export function Preview({ theme }: { theme: Theme }) {
  return (
    <section aria-labelledby="gen-preview" data-testid="preview">
      <h2 id="gen-preview">Preview</h2>
      <div className="gen-two">
        <ThemeProvider theme={theme} scheme="light"><Panel /></ThemeProvider>
        <ThemeProvider theme={theme} scheme="dark"><Panel /></ThemeProvider>
      </div>
    </section>
  )
}
```

Before relying on them, check the Button `variant`/`tone` and Tabs `items` prop names against `Button.tsx` and `Tabs.tsx`. Check `ThemeProvider` is exported from `@ap/react`'s index.

The two panels repeat field labels. If axe flags duplicate ids or landmarks, add `aria-label="Light"`/`"Dark"` groups (`role="group"`).

`Export.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@ap/react'
import { useCopyToClipboard } from '@ap/react/hooks'
import { contrastPairings, toCssText, type Theme } from '@ap/tokens'
import { buildSnippet } from './logic.js'

export function Export({ theme, brand }: { theme: Theme; brand: string }) {
  const snippet = buildSnippet(brand)
  const failing = useMemo(() => contrastPairings(theme).filter((p) => !p.pass).length, [theme])
  const [copied, copy] = useCopyToClipboard()
  const [copyFailed, setCopyFailed] = useState(false)
  const [href, setHref] = useState<string>('')
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([toCssText(theme)], { type: 'text/css' }))
    setHref(url)
    return () => URL.revokeObjectURL(url)
  }, [theme])

  return (
    <section aria-labelledby="gen-export">
      <h2 id="gen-export">Use it</h2>
      {failing > 0 && (
        <p role="status" className="gen-warn">
          {failing} pairing{failing === 1 ? '' : 's'} fail WCAG AA in this theme.
        </p>
      )}
      <pre data-testid="snippet"><code>{snippet}</code></pre>
      <div className="row">
        <Button onClick={async () => setCopyFailed(!(await copy(snippet)))}>{copied ? 'Copied' : 'Copy code'}</Button>
        {href && (
          <a href={href} download="theme.css">Download theme.css</a>
        )}
      </div>
      {copyFailed && <p role="status">Copy failed; select the text instead.</p>}
    </section>
  )
}
```

`generator.css`: layout only, using existing tokens:

```css
.gen { display: grid; gap: 2rem; }
.gen-seed { display: flex; gap: 1rem; align-items: end; flex-wrap: wrap; }
.gen-picker { display: grid; gap: 0.25rem; }
.gen-picker input { inline-size: 3rem; block-size: 2.5rem; border: 1px solid var(--ap-color-border-normal); }
.gen-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 1rem; }
.gen-warn { color: var(--ap-color-danger-text); }
.gen table td[data-pass='false'], .gen tr[data-pass='false'] td { color: var(--ap-color-danger-text); }
```

- [ ] **Step 4: Run the stories, then perturb each**

Run: `npx vitest run --project storybook storybook/docs/generator`. Expected: 5 passed, with axe clean.

Apply each story's named perturbation once. Watch that story fail, then revert.

- [ ] **Step 5: The page** `storybook/docs/Generator.mdx`

```mdx
import { Meta } from '@storybook/addon-docs/blocks'
import { ThemeGenerator } from './generator/ThemeGenerator'
import './docs.css'

<Meta title="Foundations/Theme generator" />

# Theme generator

Pick a brand colour. Everything below is generated by the same engine your build uses.
```

After the intro:
- `<ThemeGenerator />`;
- a closing paragraph linking to Theming for the runtime and build-time paths, and saying that `?brand=` in the address bar sets the starting colour.

- [ ] **Step 6: Build, typecheck and commit**

Run: `npm --prefix storybook run typecheck`, then `npm --prefix storybook run build`, then `npx vitest run --project storybook --reporter=dot`. Expected: green.

```bash
git add storybook/docs/generator storybook/docs/Generator.mdx
git commit -m "feat(docs): interactive theme generator, with stories under play, axe and gate 9"
```

---

### Task 8: Docs reference check, Theming link and CONTRIBUTING

**Files:**
- Create: `scripts/docs-refs.ts`, `scripts/docs-refs.test.ts`
- Modify: `storybook/docs/Theming.mdx`, `docs/CONTRIBUTING.md`

**Interfaces:**
- Consumes: `regionNames` (Task 1).
- Produces: `checkDocsRefs(docsDir: string): string[]` (a list of problems; empty means clean).

- [ ] **Step 1: Write the failing test** at `scripts/docs-refs.test.ts`

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkDocsRefs } from './docs-refs.js'

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'docs-refs-'))
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), body)
  }
  return join(root, 'docs')
}

describe('checkDocsRefs', () => {
  it('passes the real docs tree', () => {
    // Perturbation: rename `docs:start` in fixtures/ssr-app/app/routes/start.tsx, and this fails.
    expect(checkDocsRefs('storybook/docs')).toEqual([])
  })
  it('reports a ?raw import of a missing file', () => {
    const dir = fixture({ 'docs/A.mdx': "import x from '../src/gone.ts?raw'\n" })
    expect(checkDocsRefs(dir)).toEqual([expect.stringContaining('gone.ts')])
  })
  it('reports a region name the file does not have', () => {
    const dir = fixture({
      'src/a.ts': '// #region docs:real\nx\n// #endregion docs:real\n',
      'docs/A.mdx': "import a from '../src/a.ts?raw'\n\n{extractRegion(a, 'fake')}\n",
    })
    expect(checkDocsRefs(dir)).toEqual([expect.stringContaining('docs:fake')])
  })
  it('reports a relative markdown link to a missing file', () => {
    const dir = fixture({ 'docs/A.mdx': 'See [x](./Nope.mdx).\n' })
    expect(checkDocsRefs(dir)).toEqual([expect.stringContaining('Nope.mdx')])
  })
})
```

Run: `npx vitest run --project unit scripts/docs-refs`. Expected: FAIL, the module is missing.

- [ ] **Step 2: Implement** `scripts/docs-refs.ts`

```ts
// Docs reference check (Phase 6 spec §6). Every `?raw` import in a docs MDX
// file must resolve, every extractRegion(x, 'name') must name a region that
// file has, and every relative link must resolve. A renamed fixture region
// would otherwise reach the published site as a broken page.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { regionNames } from '../storybook/docs/lib/extractRegion.js'

function mdxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? mdxFiles(p) : p.endsWith('.mdx') ? [p] : []
  })
}

export function checkDocsRefs(docsDir: string): string[] {
  const problems: string[] = []
  for (const file of mdxFiles(docsDir)) {
    const src = readFileSync(file, 'utf8')
    const raws = new Map<string, string>()
    for (const m of src.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+)\?raw['"]/g)) {
      const target = resolve(dirname(file), m[2]!)
      if (!existsSync(target)) problems.push(`${file}: ?raw import of missing file ${m[2]}`)
      else raws.set(m[1]!, target)
    }
    for (const m of src.matchAll(/extractRegion\(\s*(\w+)\s*,\s*['"]([^'"]+)['"]\s*\)/g)) {
      const target = raws.get(m[1]!)
      if (!target) continue
      if (!regionNames(readFileSync(target, 'utf8')).includes(m[2]!)) {
        problems.push(`${file}: ${target} has no region docs:${m[2]}`)
      }
    }
    for (const m of src.matchAll(/\]\((\.{1,2}\/[^)#\s]+)/g)) {
      if (!existsSync(resolve(dirname(file), m[1]!))) problems.push(`${file}: relative link to missing ${m[1]}`)
    }
  }
  return problems
}
```

- [ ] **Step 3: Pass and perturb**

Run the tests. Expected: 4 passed.

Apply the named perturbation (rename `docs:start` to `docs:begin` in `start.tsx`). The real-tree test must fail, naming `docs:start`. Revert.

- [ ] **Step 4: Theming link and CONTRIBUTING**

In `storybook/docs/Theming.mdx`, after the "Two delivery paths" table, add one paragraph:

> To pick a brand and get the code, use the [Theme generator](?path=/docs/foundations-theme-generator--docs).

In `docs/CONTRIBUTING.md`, add a section `## Writing docs pages`, placed before `## The CSS browser floor (Chrome 120)`. It says:
- quote code with `extractRegion` over a `?raw` import, never a pasted copy;
- the marker forms;
- keep fixture-only comments outside a region;
- `scripts/docs-refs.test.ts` fails on a missing file, region or relative link;
- colour numbers are computed, never typed;
- every page is public.

Add a row to "Everyday commands": `npm --prefix storybook run dev`, "Storybook at http://localhost:6006, including the guides and the theme generator".

- [ ] **Step 5: Commit**

```bash
git add scripts/docs-refs.ts scripts/docs-refs.test.ts storybook/docs/Theming.mdx docs/CONTRIBUTING.md
git commit -m "feat(docs): docs reference check; Theming links the generator; CONTRIBUTING on writing docs"
```

---

### Task 9: Sweep, PR, baselines and publish

- [ ] **Step 1: Local sweep**

Run, in order. All must pass:
- `npm run typecheck`
- `npm test`
- `npm run test:gates`
- `npm run check:lockfiles`
- `npm run test:ssr`, then `npm run test:spa`, then `npm run test:hydration`
- `npm run test:consumer`
- `npm --prefix storybook run typecheck`, then `npm --prefix storybook run build`
- `npm run test:stories`
- `npm run size`

Also run `git status --short`; it must be clean apart from ignored outputs.

- [ ] **Step 2: Public-copy check**

Run `grep -rniE "atlas|hxm|client|employer" storybook/docs fixtures/ssr-app/app/routes/start.tsx`. Every hit must be reviewed. Expected: none, or only generic uses of the word "client" in the sense of client-side.

- [ ] **Step 3: PR sequence** (each push needs the user's go-ahead)
  1. Push the branch and open a PR against `main`.
  2. CI must go 7/7 green. Gate 9 reports missing baselines for the new generator stories.
  3. Add the label `update-visual-baselines`. The bot commits the new PNGs.
  4. `git pull`, then `git commit --allow-empty -m "ci: run gate 9 against committed baselines"`, then push.
  5. Expect gate 9: 0 diffs, 0 missing, 0 play errors.

- [ ] **Step 4: Merge and verify live** (merge with the user's go-ahead)

After merge, the Pages workflow deploys. Then:

```bash
for p in guides-getting-started--docs guides-ssr-rules--docs guides-colour-theory--docs foundations-theme-generator--docs; do
  node -e "fetch('https://andrew-caines.github.io/apComponents/index.json').then(r=>r.json()).then(j=>{if(!j.entries['$p'])process.exit(1)})" && echo "$p listed"
done
curl -s -o /dev/null -w "%{http_code}\n" https://andrew-caines.github.io/apComponents/
```

Expected: four "listed" lines and `200`.

- [ ] **Step 5: Close-out**
  - Append "What actually happened" to this plan.
  - Mark Phase 6 done in the master spec §5 (`2026-08-29-component-library-design.md`) with the merge commit.
  - Update the project memory.

---

## Verification plan

| # | Claim | Command | Must fail when… |
|---|---|---|---|
| 1 | Regions extract exactly, and bad regions throw | `npx vitest run --project unit storybook/docs/lib` | the end anchor is dropped |
| 2 | `?raw` quoting survives `storybook build` | Task 1, Step 6 | — (spike: STOP if it fails) |
| 3 | The getting-started sample server-renders and hydrates | `npm run test:ssr`, `npm run test:hydration` | the label is dropped; `Date.now()` is rendered |
| 4 | The guides build and render | `npm --prefix storybook run build`; storybook vitest project | a region is renamed |
| 5 | Generator logic agrees with `normalizeHex` and survives a junk `?brand=` | `npx vitest run --project unit storybook/docs/generator` | the `i` flag is dropped; validation is skipped |
| 6 | The generator re-themes, rejects bad hex, exports the shown theme, and debounces | storybook vitest project, generator stories | each story's named perturbation |
| 7 | A broken docs reference is caught | `npx vitest run --project unit scripts/docs-refs` | `docs:start` is renamed |
| 8 | Generator stories are screenshot-stable | gate 9 on the PR after the label sequence | — |
| 9 | Everything is live | Task 9, Step 4 | — |

**Final proof artifact:** the PR's CI run (7/7, gate 9 clean against the new baselines) and the `main` Pages deploy run, plus Task 9 Step 4's output showing the four new docs entries listed and the site returning 200.

## What actually happened

PR #10 merged to `main` at `ac83e46` on 2026-10-11, by fast-forward.

### Proof
- **Locally:** all 12 sweep commands passed, with 2466 unit tests. The public-copy grep was clean.
- **First CI run:** 7/7 green. Gate 9 reported exactly the expected 10 missing baselines (5 generator stories × 2 schemes) and no diffs on any existing story.
- **Baselines:** the `update-visual-baselines` bot committed them as `3506bf8`.
- **CI on the empty commit:** 7/7 green. Gate 9: 264 passed, 2 skipped, 0 failed.
- **Pages deploy on `main`:** green. The live `index.json` lists `guides-getting-started--docs`, `guides-ssr-rules--docs`, `guides-colour-theory--docs` and `foundations-theme-generator--docs`, and the site returns 200.

### Departures from the plan
- **Missing regions.** `storybook build` and the storybook vitest project do not render MDX pages, so neither catches a missing region. `scripts/docs-refs.ts` in the unit job is the only build-time net, and spec §4.0 says so.
- **Story title.** The generator stories are titled `Foundations/Theme generator stories`, because a docs page and a story group cannot share a sidebar path.
- **`vite-imports` regions.** These were added to both vite configs, so the guides have no hand-typed code around quoted samples.
- **SSR rules table.** The page states what each gate actually enforces. Five rows of the spec table overstated this, and the spec is amended.
- **Base UI `ssr.noExternal`.** This is scoped to the fixture's place in this workspace. No gate tests an external submodule consumer, so the guides say to add the entries if a null hook dispatcher error appears.
- **`?brand=` mirror.** It writes to `window.top` when that is same-origin, and only after the first edit.
- **docs-refs scope.** It also checks `?path=/docs/<id>--docs` links, and it fails on duplicate, unclosed and empty regions.

### Still open
- Swatch hex values are reachable only by hover, not by keyboard.
- The 110-row contrast table is long.
- A whitespace-padded `?brand=` is not handled.
- Marker-comment forms are not checked strictly.
- The docs-link regex also scans code fences.
- docs-refs test temp dirs are not removed.
- The generation counter is updated inside `useMemo`.
- `docsIdOf` only approximates Storybook's title sanitizer.
- The `META_TITLE` regex mishandles a title containing an apostrophe.
- The `/start` test skips the `HYDRATION_MARKERS` filter.
- `/subscribe` is illustrative only.
