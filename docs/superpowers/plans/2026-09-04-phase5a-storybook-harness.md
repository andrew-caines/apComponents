# Phase 5a — Storybook harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up Storybook as test infrastructure, move gates 4 and 5 onto it, backfill stories and docs pages for the six components Phase 4 shipped, and shrink the showcase to SSR smoke.

**Architecture:** A new `storybook/` npm workspace holds Storybook's config; stories live beside their components in `packages/react/src/components/`. `@storybook/addon-vitest` turns every story into a headless Chromium test, and `@storybook/addon-a11y` runs axe inside that same run — one mechanism for both gates. The five prose pages in the showcase become MDX docs pages; the five component pages shrink to SSR smoke with no prose.

**Tech Stack:** Storybook 10.6.0 (react-vite, addon-docs, addon-a11y, addon-vitest), Vitest 4.1.11, `@vitest/browser-playwright` 4.1.11, Playwright 1.62.1, Vite 8.2.2, React 19.2.8, vanilla-extract.

**Spec:** `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md` — §3 in full, plus §2's 5a row.

## Global Constraints

- **Node 22.22.0.** CI pins it; `engines.node` is `>=22.22.0`.
- **Exact pins, no carets, for the new tooling.** `storybook`, `@storybook/react-vite`, `@storybook/addon-docs`, `@storybook/addon-a11y`, `@storybook/addon-vitest` all at `10.6.0`. `vitest`, `@vitest/browser-playwright` both at `4.1.11`. Vitest 5.0.0 is already published and is outside `addon-vitest`'s peer range; a caret invites a broken install.
- **Do not install `@vitest/browser` directly.** It arrives as a dependency of `@vitest/browser-playwright`.
- **`'use client'` is the first line of every module under `packages/react/src`**, except `index.ts` barrels, `*.css.ts`, `*.tokens.ts` and the files named in the `use-client` gate's exemption list. Story files are skipped by the gate walker and do not need it.
- **Every user-facing string in a component comes from the message registry.** Stories are exempt from that gate but must not model bad practice.
- **Never run `vitest -u` during this plan.** Two snapshots exist (`packages/tokens/src/emit/cssText.test.ts`, `packages/tokens/src/gates/determinism.gate.test.ts`) and they are gate evidence, not fixtures.
- **The npm workspace directory is `storybook/` but its package name is `ap-storybook`.** npm links workspaces by package name; naming the workspace `storybook` would collide with the real `storybook` package in `node_modules`.
- **Commit after every task.** Conventional commit prefixes, as the repo already uses.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Add `storybook` to `workspaces`; pin `vitest@4.1.11`; add the Storybook devDeps; rework the test scripts |
| `vitest.config.ts` | Becomes a two-project config (`unit`, `storybook`) |
| `vitest.gates.config.ts` | Unchanged — stays a separate `--config` target |
| `storybook/package.json` | Workspace manifest, name `ap-storybook` |
| `storybook/tsconfig.json` | Typechecks the Storybook config and the colocated story files |
| `storybook/.storybook/main.ts` | Framework, story globs, addons, `viteFinal` (vanilla-extract plugin + base path) |
| `storybook/.storybook/preview.tsx` | CSS imports, `ApProvider` decorator, axe parameters |
| `storybook/.storybook/vitest.setup.ts` | Wires preview annotations into the browser test run |
| `storybook/docs/*.mdx` | Five docs pages migrated from showcase prose |
| `packages/react/src/components/*/*.stories.tsx` | One story file per component, six in total |
| `packages/react/tsconfig.json` | Exclude `**/*.stories.tsx` from the package's composite build |
| `showcase/app/sections.ts` | Drop the five prose sections |
| `showcase/app/routes/*.tsx` | Delete five prose routes; strip prose from five component routes |
| `showcase/app/routes.ts` | Follows `sections.ts` |
| `showcase/e2e/a11y.spec.ts` | Deleted — gate 5 moves to Storybook |
| `showcase/package.json` | Drop the `test:a11y` script and the axe dependency |
| `.github/workflows/ci.yml` | New `storybook` job; the `showcase` job narrows to smoke |
| `docs/adr/0011-component-api-conventions.md` | §7 amended |
| `docs/adr/0014-verification-gates.md` | Gates 4 and 5 amended |
| `docs/CONTRIBUTING.md` | "Adding a component" and the showcase section |

---

### Task 1: Upgrade to Vitest 4

Research established that **no config edit is required** — this repo uses none of the removed options. The task is the pin plus the evidence that nothing moved.

**Files:**
- Modify: `package.json` (devDependencies)

**Interfaces:**
- Consumes: nothing.
- Produces: a Vitest 4 toolchain. Task 3 depends on it for browser mode.

- [ ] **Step 1: Record the current baseline**

Run and save the output somewhere you can compare against:

```bash
npm test 2>&1 | tail -5
npm ls vite
```

Expected now: 59 test files pass, and `npm ls vite` shows root `vite@8.2.2` **plus a nested `vite@7.3.6`** under `vitest`.

- [ ] **Step 2: Pin Vitest 4**

```bash
npm install --save-dev --save-exact vitest@4.1.11
```

- [ ] **Step 3: Confirm the nested Vite is gone**

Run: `npm ls vite`
Expected: a single `vite@8.2.2`, no `vite@7.x`, no `vite-node`. Vitest 4 accepts Vite 8, so the private copy collapses. This is the change most likely to shift plugin behaviour, which is why the next two steps matter.

- [ ] **Step 4: Run the full unit suite**

Run: `npm test`
Expected: PASS, **59 test files**, same count as Step 1. A lower count means the default exclude list shrank and something stopped matching — investigate rather than accept.

- [ ] **Step 5: Prove no snapshot silently rewrote**

Run: `git diff --exit-code -- "**/__snapshots__"`
Expected: exit 0, no output. If a snapshot changed, the serialiser changed; read the diff and decide deliberately. Do not run with `-u`.

- [ ] **Step 6: Run every gate**

```bash
npm run test:gates
npm run test:ssr && npm run test:consumer && npm run test:spa
npm run typecheck
```

Expected: all pass. `test:gates` runs nine sub-scripts that pass paths as CLI filters; confirm each reports a non-zero test count rather than silently matching nothing.

- [ ] **Step 7: Note the watch-mode behaviour change in CONTRIBUTING**

Vitest 4 changes `watch` to default off when stdin is not a TTY or when an agent is detected. `npm run test:watch` will run once and exit in those environments rather than watching. Add a line to `docs/CONTRIBUTING.md` under its testing section:

```markdown
`npm run test:watch` only watches in an interactive terminal. Vitest 4 defaults
`watch` to off when stdin is not a TTY or when it detects an agent, so in CI or
an agent shell the same command runs once and exits.
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json docs/CONTRIBUTING.md
git commit -m "build: pin vitest 4.1.11

Required by @storybook/addon-vitest, whose peer range excludes the already-
published vitest 5. No config edit was needed: this repo uses none of Vitest
4's removed options (no workspace file, no deps/pool/poolOptions, no
environmentMatchGlobs, no coverage, no reporters, no fake timers).

The nested vite 7 that vitest 3 carried is gone, so tests now run through the
same Vite 8 as the builds. 59 files pass, snapshots byte-identical, gates green."
```

---

### Task 2: Scaffold the Storybook workspace

**Files:**
- Modify: `package.json` (workspaces, devDependencies)
- Create: `storybook/package.json`, `storybook/tsconfig.json`, `storybook/.storybook/main.ts`, `storybook/.storybook/preview.tsx`
- Modify: `packages/react/tsconfig.json`

**Interfaces:**
- Consumes: Vitest 4 from Task 1.
- Produces: `storybook/.storybook/main.ts` (default export, a `StorybookConfig`) and `storybook/.storybook/preview.tsx` (default export, a `Preview`). Task 3 imports the preview module by path in its setup file.

- [ ] **Step 1: Add the workspace and install**

In root `package.json`, change `"workspaces": ["packages/*"]` to:

```json
"workspaces": ["packages/*", "storybook"]
```

Then create `storybook/package.json`:

```json
{
  "name": "ap-storybook",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.22.0" },
  "scripts": {
    "dev": "storybook dev -p 6006 --no-open",
    "build": "storybook build -o storybook-static",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ap/react": "file:../packages/react"
  }
}
```

The package name is `ap-storybook`, not `storybook`: npm links workspaces by package name and `storybook` is a real dependency.

- [ ] **Step 2: Install Storybook at the root**

```bash
npm install --save-dev --save-exact \
  storybook@10.6.0 \
  @storybook/react-vite@10.6.0 \
  @storybook/addon-docs@10.6.0 \
  @storybook/addon-a11y@10.6.0 \
  @storybook/addon-vitest@10.6.0 \
  @vitest/browser-playwright@4.1.11
npm install --save-dev playwright@1.62.1
```

They go at the root, not in the workspace, so the addon resolves `vitest`, `vite`, `react` and `@ap/react` from one module graph. §3.2 of the spec explains why this is not an island like `showcase/`.

- [ ] **Step 3: Write `storybook/.storybook/main.ts`**

```ts
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-vite'

// fileURLToPath, not new URL(...).pathname: on Windows the latter yields
// "/D:/dev/..." with a leading slash, and every fs.allow check then misses.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: [
    '../../packages/react/src/**/*.stories.@(ts|tsx)',
    '../docs/**/*.mdx',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  // forwardRef + Omit<> props are invisible to the default react-docgen, which
  // would leave every component's Controls panel empty.
  typescript: { reactDocgen: 'react-docgen-typescript' },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite')
    const { vanillaExtractPlugin } = await import('@vanilla-extract/vite-plugin')
    return mergeConfig(config, {
      // A GitHub Pages project site is served from /<repo>/, not the domain
      // root, and Storybook's Vite builder does not fully rewrite asset URLs
      // for a subpath on its own. This is read from the environment rather
      // than hardcoded because gate 9 serves the same static build from a
      // local server at the domain root: hardcoding the subpath would break
      // every screenshot while the deployed site worked, or the reverse.
      base: process.env.STORYBOOK_BASE_PATH ?? '/',
      plugins: [vanillaExtractPlugin()],
      // Stories live outside this workspace, in packages/react/src.
      server: { fs: { allow: [repoRoot] } },
    })
  },
}
export default config
```

- [ ] **Step 4: Write `storybook/.storybook/preview.tsx`**

```tsx
import type { Preview } from '@storybook/react-vite'
import { ApProvider } from '@ap/react'
import '@ap/react/fonts.css'
import '@ap/react/theme.css'
import '@ap/react/motion.css'

const preview: Preview = {
  // Every story renders inside the provider stack. This is not decoration:
  // Dialog.Dismiss reads its aria-label from the message registry via
  // useMessages(), and throws outside a LocaleProvider.
  decorators: [(Story) => <ApProvider><Story /></ApProvider>],
  parameters: {
    a11y: {
      // 'error' fails the test run on a violation. 'todo' only warns in the
      // UI, which would make gate 5 a suggestion.
      test: 'error',
      // The same tag set the retired showcase spec used, so the guarantee
      // does not quietly narrow in the move.
      options: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } },
    },
  },
}
export default preview
```

`motion.css` is not optional. Without it every `animation: var(--ap-motion-*)` resolves to nothing and every motion assertion in a story is vacuous.

- [ ] **Step 5: Write `storybook/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"],
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "paths": {
      "react": ["../node_modules/@types/react"],
      "react/jsx-runtime": ["../node_modules/@types/react/jsx-runtime"]
    }
  },
  "include": [".storybook", "docs", "../packages/react/src/**/*.stories.tsx"]
}
```

The `paths` mapping is the same one the three other downstream tsconfigs carry. See CONTRIBUTING, "The same nesting put two copies of `@types/react` into every downstream typecheck".

- [ ] **Step 6: Keep stories out of the package's composite build**

In `packages/react/tsconfig.json`, add alongside `"include": ["src"]`:

```json
"exclude": ["src/**/*.stories.tsx"]
```

Without this, `tsc -b packages/react` pulls Storybook's types into the published package's declaration build.

- [ ] **Step 7: Verify Storybook builds**

```bash
npm install
npm --prefix storybook run build
```

Expected: a `storybook/storybook-static/` directory. There are no stories yet, so Storybook will warn about an empty index — that is fine at this step; the build succeeding is the signal. If it fails on resolving `../../packages/react/src`, the `server.fs.allow` entry is the first suspect.

- [ ] **Step 8: Ignore the build output**

Add to `.gitignore`:

```
storybook/storybook-static/
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore storybook packages/react/tsconfig.json
git commit -m "build(storybook): scaffold the storybook workspace

A real npm workspace, not a --prefix island like showcase/ and fixtures/*.
Those simulate consumers; this is our own harness, and addon-vitest needs
storybook/vitest/vite/react/@ap/react resolved from one module graph. An
island would reintroduce the duplicate-@types/react failure this repo hit on
its first CI run.

The workspace directory is storybook/ but the package is named ap-storybook,
because npm links workspaces by package name and storybook is a real dep.

The Vite base path is read from STORYBOOK_BASE_PATH, defaulting to root. A
Pages project site is served from a subpath; gate 9 will serve the same build
from a local root. Hardcoding either one breaks the other."
```

---

### Task 3: One story, running as a test in the browser

The first story exists to prove the pipeline, so it is written and verified before five more are added.

**Files:**
- Modify: `vitest.config.ts`
- Create: `storybook/.storybook/vitest.setup.ts`, `packages/react/src/components/Button/Button.stories.tsx`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `main.ts` and `preview.tsx` from Task 2.
- Produces: the `unit` and `storybook` Vitest project names, and the scripts `test`, `test:stories`, `test:unit`, `test:a11y`. Tasks 4–8 all use these names.

- [ ] **Step 1: Convert `vitest.config.ts` to two projects**

Replace the file with:

```ts
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { playwright } from '@vitest/browser-playwright'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vanillaExtractPlugin()],
  test: {
    projects: [
      {
        // `extends: true` inherits the root `plugins` array. Without it the
        // vanilla-extract transform does not run and every .css.ts import
        // fails.
        extends: true,
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.{ts,tsx}'],
          setupFiles: ['./vitest.setup.ts'],
          // These two gates build fixture apps and boot a server. They run
          // under vitest.gates.config.ts via test:ssr / test:consumer, and
          // CI's unit job never installs fixture dependencies.
          exclude: [
            ...configDefaults.exclude,
            '**/ssr-render.gate.test.ts',
            '**/consumer-build.gate.test.ts',
          ],
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: './storybook/.storybook' })],
        test: {
          name: 'storybook',
          setupFiles: ['./storybook/.storybook/vitest.setup.ts'],
          browser: {
            enabled: true,
            headless: true,
            // An object from @vitest/browser-playwright, not the string
            // 'playwright' — Vitest 4 changed this.
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
```

Once `projects` exists, root-level `test.include` and `test.setupFiles` stop applying, which is why both move inside the `unit` project.

`vitest.gates.config.ts` is **not** converted to a project. Its purpose is to be run *instead of* the default config by `test:ssr`, `test:consumer` and `test:spa`; as a project it would join `npm test` and demand fixture installs that CI's unit job deliberately skips.

- [ ] **Step 2: Write `storybook/.storybook/vitest.setup.ts`**

```ts
import { beforeAll } from 'vitest'
import { setProjectAnnotations } from '@storybook/react-vite'
import * as a11yAnnotations from '@storybook/addon-a11y/preview'
import * as preview from './preview'

// Feeds the preview's decorators and parameters into the browser test run.
// Without the a11y annotations, axe never runs and gate 5 is vacuous.
const annotations = setProjectAnnotations([preview, a11yAnnotations])
beforeAll(annotations.beforeAll)
```

- [ ] **Step 3: Rework the test scripts**

In root `package.json`:

```json
"test": "vitest run --project unit",
"test:stories": "vitest run --project storybook",
"test:unit": "npm run test && npm run test:stories",
"test:a11y": "npm run test:stories",
"test:watch": "vitest --project unit",
```

`test` stays browser-free so CI's unit job needs no Playwright install. `test:unit` is gate 4's command per ADR-0014 and now composes both projects. `test:a11y` is gate 5's command and points at the same run, because axe runs inside it — one mechanism, two gate names, as the spec's §3.6 says.

- [ ] **Step 4: Write the failing story**

Create `packages/react/src/components/Button/Button.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Button } from './Button.js'

const meta = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'inline-radio', options: ['solid', 'outline', 'ghost'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    tone: { control: 'inline-radio', options: ['action', 'danger'] },
    disabled: { control: 'boolean' },
  },
  args: { children: 'Save changes' },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Clickable: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Save changes' })
    await step('the button is reachable and activates', async () => {
      await userEvent.click(button)
      await expect(button).toHaveFocus()
    })
  },
}
```

- [ ] **Step 5: Install the browser and run it**

```bash
npx playwright install --with-deps chromium
npm run test:stories
```

Expected: **PASS**, two tests (`Default` renders, `Clickable` runs its `play`). If it fails resolving `@ap/react`, check that `npm install` linked the workspace. If it fails on `.css.ts`, `extends: true` is missing from the storybook project.

- [ ] **Step 6: Prove the browser run is real, not vacuous**

Temporarily change the `Clickable` play step's expected name to `'Save changez'` and re-run.
Expected: **FAIL**, naming the Button story. Revert the typo and confirm green again. A run that finds no stories reports success exactly like a run that passed.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts package.json storybook/.storybook/vitest.setup.ts packages/react/src/components/Button/Button.stories.tsx
git commit -m "test(storybook): stories run as headless browser tests

vitest.config.ts becomes two projects. `test` stays browser-free so CI's unit
job needs no Playwright; `test:stories` runs the browser project; `test:unit`
composes both, because ADR-0014 names test:unit as gate 4's command and a
renamed gate is a changed ADR.

vitest.gates.config.ts stays a separate --config target: as a project it would
join npm test and demand the fixture installs the unit job deliberately skips.

Proven non-vacuous: perturbing the expected accessible name fails the run and
names the story."
```

---

### Task 4: Axe fails the build on a real violation

Gate 5's whole value is that it can fail. This task proves it before any component depends on it.

**Files:**
- Create then delete: `packages/react/src/components/Button/A11yProof.stories.tsx`
- Possibly modify: `package.json` (if the matcher package is undeclared)

**Interfaces:**
- Consumes: the `storybook` project and the a11y parameters from Tasks 2 and 3.
- Produces: confidence, and possibly a `vitest-axe` devDependency.

- [ ] **Step 1: Write a story with a deliberate violation**

Create `packages/react/src/components/Button/A11yProof.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'

// TEMPORARY. This story exists to prove the axe run can fail, and is deleted
// in the same task. A button with no accessible name is a `button-name`
// violation at critical severity.
const meta = {
  title: 'Proof/A11y',
  render: () => <button type="button" />,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const UnlabelledButton: Story = {}
```

- [ ] **Step 2: Run and require a failure**

Run: `npm run test:a11y`
Expected: **FAIL**, naming `Proof/A11y` and the `button-name` rule. Every other story still passes.

If instead you see `Cannot find module 'vitest-axe'`, the addon imports its matcher without declaring it. Install it and re-run:

```bash
npm install --save-dev --save-exact vitest-axe@0.1.0
```

If the run passes with the violation present, axe is not wired: check that `@storybook/addon-a11y/preview` is in `setProjectAnnotations` and that `parameters.a11y.test` is `'error'`.

- [ ] **Step 3: Delete the proof story**

```bash
rm packages/react/src/components/Button/A11yProof.stories.tsx
```

- [ ] **Step 4: Confirm green**

Run: `npm run test:a11y`
Expected: PASS.

- [ ] **Step 5: Record what was proven**

Add to `docs/CONTRIBUTING.md`, under a new heading `### Gate 5 runs inside the story run`:

```markdown
Axe runs as part of `test:stories` via `@storybook/addon-a11y`, configured with
`parameters.a11y.test: 'error'` so a violation fails the run rather than
warning in the UI. The tag set is `wcag2a, wcag2aa, wcag21a, wcag21aa`, the
same set the retired showcase spec used.

This was proven to fail, not assumed: a story rendering `<button type="button" />`
with no accessible name produces `button-name (critical)` and fails the run.
A mechanism that checks nothing reports success exactly like a clean run, so
re-prove it the same way if the wiring is ever touched.
```

- [ ] **Step 6: Commit**

```bash
git add docs/CONTRIBUTING.md package.json package-lock.json
git commit -m "test(storybook): prove the axe run can fail

parameters.a11y.test: 'error' turns a violation into a failed test rather
than a UI warning. Verified with a throwaway story rendering an unlabelled
button: button-name (critical), failing the run and naming the story. Story
deleted in the same commit; CONTRIBUTING records how to re-prove it."
```

---

### Task 5: Stories for the remaining five components

One story file per component. Cross-products get a single grid story rather than one story per combination: eighteen Button stories would be eighteen screenshots for gate 9 to diff and eighteen entries in a failure report, for no extra signal.

**Files:**
- Create: `packages/react/src/components/Surface/Surface.stories.tsx`, `.../Input/Input.stories.tsx`, `.../Spinner/Spinner.stories.tsx`, `.../Field/Field.stories.tsx`, `.../Dialog/Dialog.stories.tsx`
- Modify: `packages/react/src/components/Button/Button.stories.tsx` (add the grid story)

**Interfaces:**
- Consumes: the `storybook` project from Task 3.
- Produces: story ids of the form `components-<name>--<story>`, which Task 8 relies on for the CI job and a later plan relies on for gate 9.

- [ ] **Step 1: Add Button's grid story**

Append to `packages/react/src/components/Button/Button.stories.tsx`:

```tsx
const VARIANTS = ['solid', 'outline', 'ghost'] as const
const TONES = ['action', 'danger'] as const
const SIZES = ['sm', 'md', 'lg'] as const

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {TONES.map((tone) => (
        <div key={tone} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} tone={tone}>
              {variant} {tone}
            </Button>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {SIZES.map((size) => (
          <Button key={size} size={size}>{size}</Button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button disabled>Disabled</Button>
        <Button variant="outline" disabled>Disabled outline</Button>
      </div>
    </div>
  ),
}

export const AsLink: Story = {
  render: () => <Button render={<a href="#top" />}>A real anchor</Button>,
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'A real anchor' })
    // Button derives nativeButton from the render element, so an anchor keeps
    // its link role and gains no tabindex. See CONTRIBUTING, "Base UI's render
    // prop and the nativeButton/anchor-role trap".
    await expect(link).not.toHaveAttribute('tabindex')
    await expect(link).not.toHaveAttribute('role', 'button')
  },
}
```

- [ ] **Step 2: Write `Surface.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Surface } from './Surface.js'

const meta = {
  title: 'Components/Surface',
  component: Surface,
  argTypes: {
    tone: { control: 'inline-radio', options: ['canvas', 'surface', 'raised'] },
    pad: { control: 'inline-radio', options: ['none', 'sm', 'md', 'lg'] },
  },
  args: { children: 'Surface content' },
} satisfies Meta<typeof Surface>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Tones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <Surface tone="canvas">canvas</Surface>
      <Surface tone="surface">surface</Surface>
      <Surface tone="raised">raised</Surface>
    </div>
  ),
}

export const Padding: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      <Surface pad="none">none</Surface>
      <Surface pad="sm">sm</Surface>
      <Surface pad="md">md</Surface>
      <Surface pad="lg">lg</Surface>
    </div>
  ),
}

export const Nested: Story = {
  render: () => (
    <Surface tone="canvas">
      <Surface tone="surface">
        <Surface tone="raised">Three deep</Surface>
      </Surface>
    </Surface>
  ),
}
```

- [ ] **Step 3: Write `Spinner.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Spinner } from './Spinner.js'

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] },
  },
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      {(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const).map((size) => (
        <Spinner key={size} size={size} />
      ))}
      <Spinner size={48} />
    </div>
  ),
}

export const Labelled: Story = {
  args: { label: 'Loading results' },
  play: async ({ canvasElement }) => {
    // Decorative by default; a label makes it an img with a name. Never both.
    const spinner = within(canvasElement).getByRole('img', { name: 'Loading results' })
    await expect(spinner).not.toHaveAttribute('aria-hidden')
  },
}

export const InheritsColour: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', color: 'crimson' }}>
      <Spinner size="lg" />
      <span style={{ color: 'rebeccapurple' }}><Spinner size="lg" /></span>
    </div>
  ),
}
```

- [ ] **Step 4: Write `Input.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Icon } from '../../icons/Icon.js'
import { Input } from './Input.js'

const meta = {
  title: 'Components/Input',
  component: Input,
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { placeholder: 'you@example.com' },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 320 }}>
      <Input size="sm" placeholder="sm" />
      <Input size="md" placeholder="md" />
      <Input size="lg" placeholder="lg" />
    </div>
  ),
}

export const DecorativeIcon: Story = {
  args: { startIcon: { icon: <Icon name="info" />, color: 'info' } },
}

export const ActionableIcon: Story = {
  // The union requires `label` whenever `onClick` is present: an interactive
  // adornment carries its accessible name in the type (ADR-0011 §6.2).
  args: { endIcon: { icon: <Icon name="close" />, onClick: () => {}, label: 'Clear' } },
  play: async ({ canvasElement }) => {
    const clear = within(canvasElement).getByRole('button', { name: 'Clear' })
    await expect(clear).toHaveAttribute('type', 'button')
  },
}

export const Loading: Story = {
  args: { loading: true, defaultValue: 'checking@example.com' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox')
    // A pending control stays submittable: read-only and busy, never disabled.
    await expect(input).toHaveAttribute('aria-busy', 'true')
    await expect(input).toHaveAttribute('readonly')
    await expect(input).not.toBeDisabled()
  },
}

export const Disabled: Story = { args: { disabled: true } }
```

- [ ] **Step 5: Write `Field.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Input } from '../Input/Input.js'
import { Field } from './Field.js'

const meta = {
  title: 'Components/Field',
  component: Field,
  args: { label: 'Email address', children: <Input placeholder="you@example.com" /> },
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithHint: Story = {
  args: { hint: 'We only use this to send receipts.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Email address' })
    // The relationship is derived by Base UI, never hand-passed.
    await expect(input).toHaveAccessibleDescription('We only use this to send receipts.')
  },
}

export const WithError: Story = {
  args: { error: 'That address is already in use.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Email address' })
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    // An error is an icon and text, never colour alone (ADR-0011 §5).
    await expect(within(canvasElement).getByText('That address is already in use.')).toBeVisible()
  },
}

export const HintAndError: Story = {
  args: { hint: 'Work addresses only.', error: 'That address is already in use.' },
}

export const Compound: Story = {
  render: () => (
    <Field.Root>
      <Field.Label>Email address</Field.Label>
      <Field.Control render={<Input placeholder="you@example.com" />} />
      <Field.Description>Assembled from the compound parts.</Field.Description>
      <Field.Error />
    </Field.Root>
  ),
}
```

- [ ] **Step 6: Write `Dialog.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Button } from '../Button/Button.js'
import { Dialog } from './Dialog.js'

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'xl', 'fit'] },
    layout: { control: 'inline-radio', options: ['auto', 'dialog'] },
    dismissible: { control: 'boolean' },
  },
  args: {
    title: 'Delete employee',
    description: 'This removes their profile and all associated records.',
    trigger: <Button tone="danger">Delete…</Button>,
    children: <p>This cannot be undone.</p>,
  },
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}

export const Opened: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Delete…' })
    await step('opens, names itself, and returns focus on dismiss', async () => {
      await userEvent.click(trigger)
      // The popup is portalled to the body, so query the document, not the canvas.
      const dialog = await within(document.body).findByRole('dialog')
      await expect(dialog).toHaveAccessibleName('Delete employee')
      await userEvent.keyboard('{Escape}')
      await expect(trigger).toHaveFocus()
    })
  },
}

export const WithFooter: Story = {
  args: {
    footer: (
      <>
        <Dialog.Close render={<Button variant="ghost">Cancel</Button>} />
        <Dialog.Close render={<Button tone="danger">Delete</Button>} />
      </>
    ),
  },
}

export const NotDismissible: Story = { args: { dismissible: false } }

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {(['sm', 'md', 'lg', 'xl', 'fit'] as const).map((size) => (
        <Dialog key={size} size={size} title={`Size ${size}`} trigger={<Button>{size}</Button>}>
          <p>A {size} dialog.</p>
        </Dialog>
      ))}
    </div>
  ),
}
```

- [ ] **Step 7: Run the whole story suite**

Run: `npm run test:stories`
Expected: PASS, every story rendering and every `play` passing, with zero axe violations. If a Dialog story throws about a missing message registry, the `ApProvider` decorator in `preview.tsx` is not being applied — check `setProjectAnnotations`.

- [ ] **Step 8: Typecheck the stories**

Run: `npm --prefix storybook run typecheck`
Expected: PASS. Then `npm run typecheck` (the package build) and confirm it still passes with stories excluded.

- [ ] **Step 9: Commit**

```bash
git add packages/react/src/components
git commit -m "test(storybook): stories for all six Phase 4 components

One file per component. Cross-products are a single grid story rather than
one story per combination: eighteen Button stories would be eighteen
screenshots for gate 9 and eighteen failure-report rows for no extra signal.

play functions assert the contracts the components were built for, not just
that they render: Button's anchor keeps its link role and gains no tabindex,
Input's loading state stays submittable (read-only and busy, never disabled),
Field's description is derived by Base UI rather than hand-passed, and
Dialog returns focus to its trigger on Escape."
```

---

### Task 6: MDX docs pages

The five prose pages in the showcase become Storybook docs pages. Their content is prose plus live token-driven renders; neither needs the showcase's own CSS, but both need replacements for its helper classes.

**Files:**
- Create: `storybook/docs/Foundations.mdx`, `storybook/docs/Colour.mdx`, `storybook/docs/Typography.mdx`, `storybook/docs/Theming.mdx`, `storybook/docs/Icons.mdx`, `storybook/docs/docs.css`

**Interfaces:**
- Consumes: the `stories` glob from Task 2's `main.ts`, which already includes `../docs/**/*.mdx`.
- Produces: docs entries with ids of the form `foundations--docs`. Neither the Vitest run nor axe touches them: MDX is not a test file and the a11y check is gated on story view mode.

- [ ] **Step 1: Write the shared docs stylesheet**

The showcase pages depend on `.stack`, `.row`, `.grid`, `.swatch`, `.chip` and `.mono` from `showcase/app/showcase.css`, which does not exist in Storybook. Create `storybook/docs/docs.css` with just those six:

```css
.stack { display: grid; gap: 0.75rem; }
.row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.75rem; }
.swatch { border-radius: 6px; padding: 0.75rem; border: 1px solid var(--ap-color-border-subtle); }
.chip { display: inline-flex; align-items: center; justify-content: center; border: 1px dashed var(--ap-color-border-normal); }
.mono { font-family: var(--ap-font-mono); font-size: var(--ap-text-fine-print); color: var(--ap-color-text-secondary); }
```

Import it once, at the top of each MDX file: `import './docs.css'`.

- [ ] **Step 2: Write `Foundations.mdx`**

Port `showcase/app/routes/foundations.tsx`. Keep its four sections and its arrays.

```mdx
import { Meta } from '@storybook/addon-docs/blocks'
import { vars } from '@ap/react'
import './docs.css'

<Meta title="Foundations/Scales" />

# Foundations

The scales everything else is built from: space, radius, icon sizes and elevation.

## Space

A ratio-derived ramp. Every gap, pad and offset in the library is one of these
ten steps, so a density change later is a scale change rather than an audit.

<div className="stack">
  {[0,1,2,3,4,5,6,7,8,9].map((step) => (
    <div key={step} className="row">
      <div className="mono">{step}</div>
      <div style={{ height: 12, width: vars.space[step], background: 'var(--ap-color-action-bg)' }} />
    </div>
  ))}
</div>

## Radius

<div className="grid">
  {['sm','md','lg','xl','full'].map((r) => (
    <div key={r} className="swatch" style={{ borderRadius: vars.radius[r] }}>
      <div className="mono">{r}</div>
    </div>
  ))}
</div>

## Icon sizes

Icon sizes are in `em`, so an icon inside a control scales with that control's
text rather than needing its own size prop.

<div className="row">
  {['xs','sm','md','lg','xl','2xl'].map((s) => (
    <div key={s} className="stack">
      <div className="chip" style={{ width: vars.icon[s], height: vars.icon[s] }} />
      <div className="mono">{s}</div>
    </div>
  ))}
</div>

## Elevation

<div className="grid">
  {['1','2','3'].map((s) => (
    <div key={s} className="swatch" style={{ boxShadow: vars.shadow[s] }}>
      <div className="mono">shadow {s}</div>
    </div>
  ))}
</div>
```

- [ ] **Step 3: Write `Colour.mdx`**

Port `showcase/app/routes/colour.tsx` with its four arrays (`SURFACES`, `BORDERS`, `TEXT`, `TONES`) and its five sections: Surfaces, Borders, Text, Action, Status tones.

**Rewrite the intro.** The showcase version says "Use the scheme switch in the nav", which does not exist in Storybook. Replace with:

```mdx
Every pairing here is checked for contrast in CI (gate 2) in both schemes. Use
the toolbar's theme control to switch between them.
```

- [ ] **Step 4: Write `Typography.mdx`**

Port `showcase/app/routes/typography.tsx`: the scale (`finePrint`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`), the three font stacks (`body`, `heading`, `mono`), the three weights (`weightRegular`, `weightMedium`, `weightSemibold`), and the pure-prose section on the metric-matched fallback, which migrates verbatim.

- [ ] **Step 5: Write `Theming.mdx`**

Port `showcase/app/routes/theming.tsx`, the most prose-heavy page. Keep:
- The "Two delivery paths" comparison table, which becomes a native MDX table.
- The default-path section with its live `Surface` and `Button` sample.
- The runtime override section, with its code sample as a fenced block and its live `ThemeProvider theme={PINK}` sample.
- The nesting section with the nested pink-then-teal samples.
- The "Getting it right on the server" prose, verbatim.

Two things do not migrate. The `CurrentScheme` component reads the showcase's own scheme switcher, so drop it and describe the three-state `data-ap-scheme` contract in prose instead. The `Sample` helper is showcase-only, so inline its markup.

Declare the two themes at the top of the file, as the showcase did at module scope:

```mdx
import { generateTheme, ThemeProvider, Surface, Button } from '@ap/react'

export const PINK = generateTheme({ brand: '#c2185b' })
export const TEAL = generateTheme({ brand: '#00897b' })
```

- [ ] **Step 6: Write `Icons.mdx`**

Port `showcase/app/routes/icons.tsx`: the full set from `ICON_PATHS`, the six sizes, and the decorative-versus-labelled contract with its live pair.

- [ ] **Step 7: Build and eyeball**

```bash
npm --prefix storybook run build
npm --prefix storybook run dev
```

Open each of the five docs pages. Expected: no missing styles, no console errors, and the theming page's live samples visibly differ from each other.

- [ ] **Step 8: Confirm the docs pages did not join the test run**

Run: `npm run test:stories`
Expected: the same test count as after Task 5. MDX pages are not test files, so the count must not change. If it did, the story glob is matching MDX.

- [ ] **Step 9: Commit**

```bash
git add storybook/docs
git commit -m "docs(storybook): the five foundation pages as MDX

Ported from the showcase routes they replace. Two things could not travel:
CurrentScheme read the showcase's own scheme switcher, so the three-state
data-ap-scheme contract is described in prose instead, and the Sample helper
was showcase-only, so its markup is inlined.

docs.css carries the six layout classes the pages borrowed from showcase.css.
The colour page's intro no longer points at a nav that does not exist here."
```

---

### Task 7: Shrink the showcase

Only now, with Storybook's a11y run green, does the showcase's version retire.

**Files:**
- Delete: `showcase/app/routes/foundations.tsx`, `colour.tsx`, `typography.tsx`, `theming.tsx`, `icons.tsx`, `showcase/e2e/a11y.spec.ts`
- Modify: `showcase/app/sections.ts`, `showcase/app/routes/button.tsx`, `surface.tsx`, `field-input.tsx`, `spinner.tsx`, `dialog.tsx`, `showcase/package.json`

**Interfaces:**
- Consumes: a green `test:a11y` from Tasks 4 and 5.
- Produces: a showcase whose only job is SSR smoke. `showcase/e2e/smoke.spec.ts` is untouched and must still pass.

- [ ] **Step 1: Check what the smoke spec actually requires**

Read `showcase/e2e/smoke.spec.ts`. It asserts, per section: HTTP 200, the escaped section title in the raw server response, `data-ap-hydrated="true"`, a visible `<h1>` matching the title, the nav link carrying `aria-current="page"`, and zero console errors. It asserts **nothing** about page body content. So a shrunk page needs only `Page` plus enough rendering to catch a component that throws.

- [ ] **Step 2: Drop the five prose sections**

In `showcase/app/sections.ts`, delete the `foundations`, `typography`, `colour`, `theming` and `icons` entries. `SECTIONS` keeps five: `button`, `surface`, `field-input`, `spinner`, `dialog`. `routes.ts` and the nav both derive from this array, so they follow automatically.

- [ ] **Step 3: Delete the five prose routes**

```bash
rm showcase/app/routes/foundations.tsx showcase/app/routes/colour.tsx \
   showcase/app/routes/typography.tsx showcase/app/routes/theming.tsx \
   showcase/app/routes/icons.tsx
```

- [ ] **Step 4: Strip prose from the five component routes**

Each keeps its `Page` wrapper and its component renders; every `<h2>` and every explanatory paragraph goes. What each must still render:

| Route | Keeps |
|---|---|
| `button.tsx` | One `Button` per variant, one disabled, one `render={<a href="#top" />}` |
| `surface.tsx` | One `Surface` per tone |
| `field-input.tsx` | A `Field` with a label, hint and error wrapping an `Input`; one adorned `Input`; one `loading` `Input` |
| `spinner.tsx` | Two `Spinner`s at different sizes |
| `dialog.tsx` | The "Delete employee" dialog with its `Button tone="danger"` trigger, footer, and `Field`+`Input` body |

The `dialog.tsx` and `field-input.tsx` content is no longer pinned by the a11y spec once it is deleted, but keeping it costs nothing and keeps the SSR proof meaningful: the dialog route is what proves a portal is absent from the server response in a real browser.

- [ ] **Step 5: Delete the a11y spec and its dependency**

```bash
rm showcase/e2e/a11y.spec.ts
```

In `showcase/package.json`, remove the `"test:a11y"` script and the `"@axe-core/playwright"` devDependency. Then:

```bash
npm --prefix showcase install
```

- [ ] **Step 6: Fix the root script that pointed at it**

Root `package.json` currently has `"test:a11y": "npm --prefix showcase run test:a11y"`. Task 3 already repointed it at `test:stories`. Confirm it reads:

```json
"test:a11y": "npm run test:stories",
```

- [ ] **Step 7: Verify the showcase still passes**

```bash
npm --prefix showcase run typecheck
npm run showcase:test
```

Expected: PASS. The smoke spec now loops five sections instead of ten. Confirm the count dropped to five and did not drop to zero — a spec that iterates an empty array passes trivially.

- [ ] **Step 8: Commit**

```bash
git add showcase package.json
git commit -m "refactor(showcase): narrow it to SSR smoke

Its job is now the one thing Storybook cannot do: prove a component renders
under real SSR in a real browser. The five prose sections moved to MDX docs
pages in the previous commit, so their routes and their entries in SECTIONS
go; the five component routes keep their renders and lose their prose.

e2e/a11y.spec.ts is deleted and @axe-core/playwright with it. Gate 5 now runs
inside the story run, which was proven able to fail before this deletion, not
after."
```

---

### Task 8: CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the scripts defined in Task 3.
- Produces: a `storybook` job that CI treats as gates 4 and 5.

- [ ] **Step 1: Add the storybook job**

Insert after the `ssr` job:

```yaml
  storybook:
    name: Stories and accessibility (gates 4 and 5)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm --prefix storybook run typecheck
      - run: npx playwright install --with-deps chromium
      - run: npm run test:stories
      - name: Build the static Storybook
        run: npm --prefix storybook run build
```

The build step is not decoration: it is the earliest place a broken MDX page or a bad `viteFinal` shows up, and a later plan needs that build for gate 9.

**Gate 4 runs as its two halves, in two jobs.** ADR-0014 names `test:unit` as its command, and `test:unit` is `npm run test && npm run test:stories`. CI runs `npm test` in the `unit` job and `npm run test:stories` here, so the two halves run in parallel instead of in series. That is the same coverage, not less of it; a developer running gate 4 locally still uses the single composite.

- [ ] **Step 2: Narrow the showcase job**

Rename it and drop the axe half:

```yaml
  showcase:
    name: Showcase SSR smoke
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run showcase:install
      - run: npm --prefix showcase run typecheck
      - run: npx --prefix showcase playwright install --with-deps chromium
      - run: npm run showcase:test
```

Note the `node-version` also changes from the literal `22` it currently uses to `${{ env.NODE_VERSION }}`, matching every other job.

- [ ] **Step 3: Verify the workflow parses**

Run: `npx --yes yaml-lint .github/workflows/ci.yml` or open it in an editor with YAML validation. Expected: no syntax errors, six jobs.

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: a storybook job for gates 4 and 5

The showcase job narrows to SSR smoke and picks up NODE_VERSION, which it
alone was not using. The new job typechecks the stories, runs them headlessly
with axe inside the same run, and builds the static Storybook — the earliest
place a broken MDX page or viteFinal surfaces, and the artifact gate 9 will
need."
git push
```

- [ ] **Step 5: Watch the run**

```bash
gh run watch "$(gh run list --branch feat/phase5-remaining-components --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Expected: six jobs, all green. This is the first time the story run has executed on Linux; font rendering and timing differ from Windows, so a `play` timeout here is a real finding, not flake.

---

### Task 9: Documentation

**Files:**
- Modify: `docs/adr/0011-component-api-conventions.md`, `docs/adr/0014-verification-gates.md`, `docs/CONTRIBUTING.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing code depends on.

- [ ] **Step 1: Amend ADR-0011 §7**

Replace the first bullet of "Every component ships with":

```markdown
- A `.stories.tsx` beside the component — gallery entry, controls, `play`
  interactions, and the axe run (gates 4 and 5)
- A section in the showcase app — the SSR smoke proof, in a real browser,
  with no prose (gate 6's browser-level counterpart)
```

Add a dated note below the list:

```markdown
**Amended 2026-09-04 (Phase 5a).** The two jobs are named separately because
they are now separate artifacts. Phase 4e briefly hosted the axe run in the
showcase, which is why the showcase section used to carry prose; that prose
now lives in Storybook's MDX docs pages and the showcase section is smoke only.
```

- [ ] **Step 2: Amend ADR-0014 gates 4 and 5**

Update the two rows:

```markdown
| 4 | **Unit + interaction** | `test:unit` | Vitest, two projects: node/jsdom component tests, and stories with their `play` functions in headless Chromium |
| 5 | **Accessibility** | `test:a11y` | axe over every story, inside the same browser run, `parameters.a11y.test: 'error'`. Zero violations. See the honesty note below |
```

Add below the table:

```markdown
**Amended 2026-09-04 (Phase 5a).** Gates 4 and 5 are one mechanism: axe runs
inside the story run, so `test:a11y` and `test:stories` are the same command.
Phase 4e's deviation — hosting gate 5 in the showcase because Storybook did not
exist yet — is closed. The honesty note is unchanged and still applies: this
proves zero machine-detectable violations, not accessibility.
```

- [ ] **Step 3: Update CONTRIBUTING's "Adding a component"**

Add the story step and narrow the showcase step:

```markdown
4. **A story file**, `<Name>.stories.tsx`, beside the component. Controls for
   every union prop, one story per meaningful state, and a grid story rather
   than one story per cross-product combination. `play` functions assert the
   contract the component was built for, not merely that it rendered.
5. **A showcase section** — renders only, no prose. It exists to prove the
   component server-renders in a real browser. Prose belongs in a Storybook
   MDX docs page.
```

- [ ] **Step 4: Update CONTRIBUTING's showcase section**

Replace the description of what the showcase is for with:

```markdown
The showcase is an SSR smoke harness, not a gallery. It server-renders each
component through a real React Router 8 pipeline and Playwright checks the
response, hydration and console. Storybook is the gallery: stories, controls,
interaction tests, axe, and the MDX docs pages.
```

- [ ] **Step 5: Verify the docs are honest**

Grep for stale references:

```bash
grep -rn "storybook" docs/ --include=*.md -i | grep -iv "phase 5\|phase 6\|amended"
```

Expected: every remaining hit describes the state as it now is. Fix any that still describe Storybook as absent or as Phase 6's alone.

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs: amend ADR-0011 and ADR-0014 for the Storybook harness

ADR-0011 §7 now names both artifacts and their separate jobs: a story for the
gallery and the gates, a showcase section for the SSR proof. ADR-0014 records
that gates 4 and 5 are one mechanism, closing Phase 4e's deviation.

Both are additive clarifications, not reversals — ADRs are immutable once
accepted, and neither decision changed, only what satisfies it."
```

---

## Verification plan

Ordered; each is a command whose output is the evidence. Success signals name the perturbation that must make the check fail.

| # | Claim | Command | Success signal |
|---|---|---|---|
| 1 | Vitest 4 changed nothing | `npm test` | 59 files, same as before the pin. Perturb by widening `include` to `**/*.test.ts` → must pull in fixture files and fail |
| 2 | No snapshot silently rewrote | `git diff --exit-code -- "**/__snapshots__"` | Empty |
| 3 | Every gate still green | `npm run test:gates && npm run test:ssr && npm run test:consumer && npm run test:spa` | Pass |
| 4 | Stories run headlessly | `npm run test:stories` | Every story and `play` passes in Chromium. Perturb an expected accessible name → must fail and name the story |
| 5 | Axe can fail | temporary unlabelled-button story | `button-name (critical)`, failing the run. Deleting the story → green |
| 6 | Docs pages are not tests | `npm run test:stories` | Test count unchanged by Task 6's five MDX files |
| 7 | The package build excludes stories | `npm run typecheck` | Pass with `src/**/*.stories.tsx` excluded. Perturb by removing the exclude → Storybook types enter the declaration build |
| 8 | The showcase still smokes | `npm run showcase:test` | Five sections pass. Perturb by emptying `SECTIONS` → the existing guard at `showcase/e2e/smoke.spec.ts:47` (`expect(SECTIONS.length).toBeGreaterThan(0)`) must fail rather than the suite trivially passing |
| 9 | Storybook builds static | `npm --prefix storybook run build` | `storybook-static/index.json` exists and lists every story |
| 10 | The base path is honoured | `STORYBOOK_BASE_PATH=/apComponents/ npm --prefix storybook run build` | Built asset URLs carry the prefix; an unset variable produces root-relative URLs |

**Final proof artifact:** a green CI run on `feat/phase5-remaining-components` with six jobs — `unit`, `generated-artifacts-are-fresh`, `consumer`, `ssr`, `storybook`, `showcase` — plus `npm run typecheck && npm test && npm run test:stories && npm run test:gates` green locally.

---

## What actually happened

*(Written during execution. Record deviations, unfalsifiable checks, harness bugs, and anything the plan got wrong.)*
