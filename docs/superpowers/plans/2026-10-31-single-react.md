# One React copy, owned by `apComponents()` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** an app configured with only `apComponents()` gets exactly one React copy in dev SSR, the SSR build and the client build. This holds in both install layouts, and no app carries a workaround.

**Architecture:**
- `@ap/vite` gains a list of `@ap/react`'s React-importing dependencies, which it bundles in SSR.
- It also gets ESM replacements for `use-sync-external-store`, applied through aliases, and `resolve.dedupe` for React.
- A completeness unit test guards the list.
- A script builds a throwaway React Router app outside the checkout, in layout A and layout B, under build and dev. It is the end-to-end proof, and CI runs it.

**Tech Stack:** Vite 8, React Router 8, vanilla-extract, Vitest, Playwright, npm 11, Node 22.22.

**Spec:** `docs/superpowers/specs/2026-10-31-single-react-design.md`

**Branch:** `feat/single-react`, one PR. Write files with LF line endings. Run `npm --prefix storybook run typecheck` locally, because the root `typecheck` skips story files.

## Global Constraints

- **Apps add nothing.** The app's footprint is `@ap/react` and `@ap/vite` as dependencies, plus `plugins: [reactRouter(), apComponents()]`. It has no `ssr.noExternal`, `resolve.dedupe`, alias, `.npmrc`, `overrides` or direct Base UI dependency.
- `react` and `react-dom` stay **peer** dependencies of `@ap/react` at `>=19.2.7`. The app owns its React.
- **Layout A:** the vendored checkout has no `node_modules`. **Layout B:** `npm install` has also been run inside the vendored checkout.
- **Bundling scope.** Only `@ap/react`'s own non-peer runtime tree may be bundled. Never use `ssr.noExternal: true`, and never bundle the app's dependencies.
- **Dev SSR** must work for every component, not only some.
- **Windows.** The external-consumer script must pass locally on Windows. If a Windows-only line is needed, the plugin absorbs it. If it cannot do so safely, **stop and report**.
- **Anything else.** If a layout needs anything else the library cannot supply through its manifests or the plugin, **stop and report**. Do not add it to the app.

## Verification plan

| # | Check | Success signal |
|---|---|---|
| 1 | `npx tsx scripts/external-consumer/run.ts --layout a --mode build`, run before any plugin change | Fails, and the failure is recorded in the retrospective. This is the red baseline. |
| 2 | `npx vitest run --project unit packages/vite` | The completeness, shim and preset tests pass. Each failed before its change. |
| 3 | `npm run typecheck && npm test && npm run test:gates` | Green. |
| 4 | `run.ts` for each of `--layout a` and `--layout b`, each with `--mode build` and `--mode dev` | All four exit 0. Each typechecks, and `/form`, `/dialog` and `/overlays` return 200 with their markers. |
| 5 | `npm run test:ssr && npm run test:spa && npm run test:hydration && npm run test:consumer` | Green, with the workaround lists removed from both in-repo apps. |
| 6 | `npm run showcase:test` and `npm --prefix showcase run test:smoke:dev` | Green under build and under `react-router dev`. |
| 7 | `npx vitest run --project unit scripts` | The docs-refs test is green after the `ssr-noexternal` region is deleted. |
| 8 | Steps 4 and 6 again on Windows | Green with no app-side line. |
| 9 | The PR's CI | All jobs green, including the new `external-consumer` matrix (a×b, build×dev) and the showcase dev smoke. |

**Proof artifact:** a green PR CI run whose `external-consumer` job shows all four cells passing, and whose app config is the two-line plugin array.

## Review Focus

1. **Layout B typecheck.** In layout B, `@types/react` resolves twice: once from `vendor/apComponents/node_modules` and once from the app. Today's in-repo apps pin this with `tsconfig` `paths`. The expected behaviour is that the external app typechecks with a plain tsconfig. This is pinned in Task 1's script, which runs `tsc --noEmit` in every cell. If only an app-side `paths` entry can fix it, stop and report.
2. **Base UI's non-React externals are not resolvable from the app**, for example `reselect`, `@floating-ui/dom` or `@babel/runtime` after Base UI is bundled. The expected behaviour is that `/dialog` and `/overlays` still return 200. This is pinned in Task 1's routes and Task 4's run. If it fails, extend the bundled list to that package. This is allowed by the bundling-scope constraint.
3. **A Base UI store or Floating UI hook running on the server.** The expected behaviour is that `/overlays`, with Select, Popover and Tooltip, returns 200 in dev and build. This is pinned by the `/overlays` route in Task 1.
4. **The dev client pre-bundle reaches the CommonJS `use-sync-external-store`.** The expected behaviour is that `/dialog` hydrates without a console error in dev. This is pinned in Task 1's dev mode, which loads each page in Chromium and fails on `pageerror` or a console error.
5. **A React-importing dependency added later.** The expected behaviour is that the completeness test fails and names the package. This is pinned in Task 2's perturbation step.

---

### Task 0: Branch and commit the spec

- [ ] **Step 1:** `git switch -c feat/single-react`
- [ ] **Step 2:** `git add docs/superpowers/specs/2026-10-31-single-react-design.md docs/superpowers/plans/2026-10-31-single-react.md && git commit -m "docs: single React design and plan"`

### Task 1: External-consumer harness (red baseline)

**Files:**
- Create: `scripts/external-consumer/run.ts`.
- Create: `scripts/external-consumer/template/`. It holds `package.json`, `tsconfig.json`, `vite.config.ts`, `react-router.config.ts` and `app/{root.tsx,routes.ts,routes/form.tsx,routes/dialog.tsx,routes/overlays.tsx}`.
- Modify: root `package.json`, adding the script `"test:external": "tsx scripts/external-consumer/run.ts"`.
- Modify: `scripts/tsconfig.json`. If it would include `template/`, exclude it, because the template typechecks inside the temporary app.

**Interfaces:**
- Produces: the CLI `tsx scripts/external-consumer/run.ts --layout <a|b> --mode <build|dev> [--keep]`. It exits 0 on success. It prints the temp dir and the first failing check.

**Template (exact constraints):**
- `vite.config.ts` is exactly:

  ```ts
  import { reactRouter } from '@react-router/dev/vite'
  import { apComponents } from '@ap/vite'
  import { defineConfig } from 'vite'
  export default defineConfig({ plugins: [reactRouter(), apComponents()] })
  ```

- `package.json` dependencies:
  - `"@ap/react": "file:./vendor/apComponents/packages/react"`
  - `"@ap/vite": "file:./vendor/apComponents/packages/vite"`
  - `react`, `react-dom`, `react-router` and `isbot`, at the same ranges as `fixtures/ssr-app/package.json`
  - devDependencies: `@react-router/dev`, `@react-router/node`, `@react-router/serve`, `@playwright/test`, `typescript`, `vite`, `@types/react` and `@types/react-dom`, at the same ranges as `fixtures/ssr-app`.
  - Nothing else.
- `tsconfig.json` is a plain RR8 config with **no `paths`**.
- Routes:
  - `form` renders `Field` + `Input` + `Button`, with marker `id="ext-form"`.
  - `dialog` renders a `Dialog` with a trigger, with marker `id="ext-dialog"`.
  - `overlays` renders `Select`, `Popover` and `Tooltip`, with marker `id="ext-overlays"`.
  - Each is wrapped in `ApProvider`.
  - `root.tsx` imports the three stylesheets the way `fixtures/ssr-app/app/root.tsx` does.

**What `run.ts` does, in order:**
1. `mkdtemp` under `os.tmpdir()`, which is outside the checkout.
2. Copy the template in.
3. Copy the working tree, meaning the files from `git ls-files -co --exclude-standard`, into `vendor/apComponents`. Copying uncommitted edits keeps local runs honest.
4. For layout `b`, run `npm install` inside `vendor/apComponents` first.
5. Run `npm install` in the app.
6. Run `npx tsc --noEmit`.
7. For `build`, run `react-router build` then `react-router-serve`. For `dev`, run `react-router dev --port <free>`.
8. Wait for the port. Open each route in Playwright Chromium. Assert status 200 and that the marker is visible. Fail on any `pageerror` or console error, using the showcase smoke test's `IGNORED` list. For `/dialog`, click the trigger and assert the dialog opens, which proves hydration.
9. Kill the server. Remove the temp dir unless `--keep` was passed.

Spawn with `shell: true` on Windows, as `consumer-build.gate.test.ts` does.

- [ ] **Step 1:** Write the template and `run.ts`.
- [ ] **Step 2:** Run `npx tsx scripts/external-consumer/run.ts --layout a --mode build`, then the other three cells. Expected: at least one cell fails. Record in the plan's retrospective, per cell:
  - the exact failure;
  - where npm put `@base-ui/react` and any second `react`. Use `--keep` and `npm ls react @base-ui/react --all` to find out.

  This settles the spec's "open fact".
- [ ] **Step 3:** Commit: `test(external): out-of-repo consumer harness, layouts A/B, build/dev`.

### Task 2: The bundled-dependency list and its completeness test

**Files:**
- Create: `packages/vite/src/deps.ts`.
- Test: `packages/vite/src/deps.test.ts`.
- Modify: `packages/vite/src/index.ts`, to re-export.

**Interfaces:**
- Produces:
  - `export const AP_BUNDLED_DEPS: readonly string[]`. This is the packages bundled in SSR so their React import is the app's.
  - `export const AP_ALIASED_DEPS: readonly string[]`, initially `['use-sync-external-store']`. These packages are replaced in Task 3.
- Test-only helper in `deps.test.ts`: `reactImporters(fromPkgDir: string): string[]`. It walks `dependencies`, recursively and excluding `peerDependencies`, resolving each from its parent's real directory, starting at `packages/react`. It returns the sorted names of packages whose `peerDependencies` or `dependencies` name `react` or `react-dom`. It skips `@ap/*`, which are already bundled through `AP_PACKAGES`.

- [ ] **Step 1:** Write the tests.

  ```ts
  it('handles every React-importing package in @ap/react\'s tree', () => {
    const handled = new Set([...AP_BUNDLED_DEPS, ...AP_ALIASED_DEPS])
    expect(reactImporters(REACT_PKG).filter((n) => !handled.has(n))).toEqual([])
  })

  it('finds the known importers', () => {
    expect(reactImporters(REACT_PKG)).toEqual(expect.arrayContaining(
      ['@base-ui/react', '@base-ui/utils', '@floating-ui/react-dom', 'use-sync-external-store']))
  })
  ```

- [ ] **Step 2:** Run `npx vitest run --project unit packages/vite/src/deps.test.ts`. Expected: FAIL, because `deps.ts` does not exist.
- [ ] **Step 3:** Create `deps.ts`:
  - `AP_BUNDLED_DEPS = ['@base-ui/react', '@base-ui/utils', '@floating-ui/react-dom']`
  - `AP_ALIASED_DEPS = ['use-sync-external-store']`

  Write a doc comment giving the rule: every React importer in the chain must be in the same SSR bundle, or a second React loads. Point to CONTRIBUTING's "second React" section.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5 (named perturbation):** Copy `deps.ts` aside. Delete `@floating-ui/react-dom` from the list. Run the test and expect a FAIL naming it. Restore from the copy. Do **not** use `git checkout`.
- [ ] **Step 6:** Commit: `feat(vite): AP_BUNDLED_DEPS with a completeness test over @ap/react's tree`.

### Task 3: ESM replacements for `use-sync-external-store`

**Files:**
- Create: `packages/vite/src/shims/use-sync-external-store-shim.ts`. It is `export { useSyncExternalStore } from 'react'`.
- Create: `packages/vite/src/shims/with-selector.ts`. It is an ESM port of `useSyncExternalStoreWithSelector(subscribe, getSnapshot, getServerSnapshot, selector, isEqual?)`, with the upstream signature and memoisation semantics, written against React 19's `useSyncExternalStore`, `useRef`, `useMemo` and `useDebugValue`.
- Modify: `packages/vite/package.json`. Add `"./shims/*": "./src/shims/*.ts"` to `exports` and add `react` as an optional peer (`>=19.2.7`).
- Test: `packages/vite/src/shims/with-selector.test.ts`.

**Interfaces:**
- Produces: `SHIM_ALIASES: { find: RegExp, replacement: string }[]` in `packages/vite/src/deps.ts`, giving absolute file paths for:
  - `/^use-sync-external-store\/shim\/with-selector(\.js)?$/` → `with-selector.ts`
  - `/^use-sync-external-store\/(shim|shim\/index)(\.js)?$/` → `use-sync-external-store-shim.ts`
  - `/^use-sync-external-store\/with-selector(\.js)?$/` → `with-selector.ts`

  Use exact-match regexes, so `with-selector` is not swallowed by the `shim` rule.

- [ ] **Step 1:** Write the tests. Each one renders the upstream hook and our port side by side, using `react-dom/server` `renderToString` plus a client `act` render, against the same store.
  - `'returns the selected slice on server and client'`.
  - `'does not re-render when isEqual says the selection is unchanged'`. Count renders, and assert equal counts for upstream and port.
  - `'re-renders when the selection changes'`.
  - `'uses getServerSnapshot during server render'`.
- [ ] **Step 2:** Run `npx vitest run --project unit packages/vite/src/shims`. Expected: FAIL, because the module is missing.
- [ ] **Step 3:** Implement both shims and `SHIM_ALIASES`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(vite): ESM replacements for use-sync-external-store`.

### Task 4: Wire the preset, then turn the harness green

**Files:**
- Modify: `packages/vite/src/index.ts`, in the `ap-components:config` hook.
- Test: `packages/vite/src/index.test.ts`.

**Interfaces:**
- Consumes: `AP_BUNDLED_DEPS` and `SHIM_ALIASES` from Tasks 2 and 3.
- Produces: a preset config containing:
  - `ssr.noExternal`: `[...AP_PACKAGES, ...AP_BUNDLED_DEPS]`
  - `resolve.dedupe`: `['react', 'react-dom']`
  - `resolve.alias`: `SHIM_ALIASES`
  - `optimizeDeps.exclude` stays `AP_PACKAGES`

- [ ] **Step 1:** Write the tests.
  - `'bundles AP_BUNDLED_DEPS in SSR'`: `presetConfig().ssr.noExternal` contains every entry.
  - `'dedupes react and react-dom'`.
  - `'aliases use-sync-external-store/shim and shim/with-selector to the shims'`: assert that each regex matches its specifier and that each replacement file exists.
  - `'never bundles react'`: `noExternal` contains neither `react` nor `react-dom`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run --project unit packages/vite`. Expected: PASS.
- [ ] **Step 5:** Run all four harness cells from Task 1. Expected: all exit 0. If a cell fails:
  - **A non-React package is unresolvable** (Review Focus 2): add it to `AP_BUNDLED_DEPS`, and update the completeness test's expectation to say why.
  - **Layout B still loads a second React in dev:** strengthen the plugin. For example, add a `resolveId` hook that resolves bare `react`, `react-dom` and their subpaths from `config.root`. Add a preset test for it.
  - **Layout B typecheck fails on duplicate `@types/react`:** stop and report (Review Focus 1).
  - **Anything that would need an app-side line:** stop and report.
- [ ] **Step 6:** Commit: `feat(vite): apComponents() owns the single React copy`.

### Task 5: Remove the in-repo workarounds

**Files:**
- Modify: `fixtures/ssr-app/vite.config.ts`. Delete `ssr.noExternal`, its long comment and the `docs:ssr-noexternal` region. Keep `preserveSymlinks` and `build.manifest`.
- Modify: `showcase/vite.config.ts`. Delete `ssr.noExternal`, `resolve.dedupe` and their comments. Keep the win32 `preserveSymlinks`.
- Leave the in-repo `tsconfig` `paths` pins in place. They exist because of this repo's root `node_modules` in type space, not because of the runtime. Update their comments only if they claim otherwise.

- [ ] **Step 1:** Make the edits.
- [ ] **Step 2:** Run `npm run test:ssr && npm run test:spa && npm run test:hydration && npm run test:consumer`. Expected: PASS.
- [ ] **Step 3:** Run `npm run showcase:test`. Expected: PASS.
- [ ] **Step 4:** Commit: `chore: drop per-app React workarounds now owned by @ap/vite`.

### Task 6: Showcase smoke under `react-router dev`

**Files:**
- Modify: `showcase/playwright.config.ts`. When `AP_DEV=1`, `webServer.command` is `react-router dev --port 3130 --strictPort`, with the matching `baseURL`. Otherwise it is unchanged.
- Modify: `showcase/package.json`, adding `"test:smoke:dev": "cross-env AP_DEV=1 playwright test e2e/smoke.spec.ts"`. If you would rather not add `cross-env`, a small node wrapper is fine. The script must work on Windows.

- [ ] **Step 1:** Run `npm --prefix showcase run test:smoke:dev`. Expected: PASS on every section. Before Task 4 this failed with `module is not defined`, which was confirmed and recorded in Task 1's notes if checked.
- [ ] **Step 2:** Update CONTRIBUTING's "The showcase" section. `npm --prefix showcase run dev` now works, so add a `dev` script. Remove the sentence that says it must be served from a build.
- [ ] **Step 3:** Commit: `test(showcase): smoke every section under react-router dev`.

### Task 7: CI

**Files:**
- Modify: `.github/workflows/ci.yml`.

- [ ] **Step 1:** Add a job `external-consumer`:
  - `strategy.matrix: { layout: [a, b], mode: [build, dev] }` and `fail-fast: false`.
  - Steps: checkout, setup-node, `npm ci`, `npx playwright install --with-deps chromium`, then `npm run test:external -- --layout ${{ matrix.layout }} --mode ${{ matrix.mode }}`.
- [ ] **Step 2:** In the `showcase` job, add `npm --prefix showcase run test:smoke:dev` after `showcase:test`.
- [ ] **Step 3:** Commit: `ci: external consumer matrix and showcase dev smoke`.

### Task 8: Docs and ADR

**Files:**
- Modify: `storybook/docs/GettingStarted.mdx`.
  - Delete the "SSR apps that consume through a `file:` path" callout and its `ssr-noexternal` `Source`.
  - Add these bullets to the list of what `apComponents()` sets: it bundles Base UI's React-importing packages in SSR, replaces `use-sync-external-store` with ESM, and dedupes React. The guide says the app adds nothing else.
- Modify: `storybook/docs/SsrRules.mdx`. Replace the null-dispatcher rule with: "If you see `Cannot read properties of null (reading 'use…')`, it is a library bug: file it." Link to the completeness test. Remove the `ssr-noexternal` source and the `ssrVite` import if it is now unused.
- Modify: `docs/CONTRIBUTING.md`, in the "second React" section. Keep the history table. Change the **Fix** to "owned by `@ap/vite` (`AP_BUNDLED_DEPS`, `SHIM_ALIASES`)", and say how to add an entry when the completeness test fails.
- Modify: `docs/adr/0002-distribution-git-submodule.md`. Add an amendment, dated 2026-10-31, to the plugin's responsibilities, and state that an app adds nothing.
- Modify: `fixtures/ssr-app/tsconfig.json` and `showcase/tsconfig.json`, but only if their comments contradict Task 1's findings about layout B.

- [ ] **Step 1:** Make the edits.
- [ ] **Step 2:** Run `npx vitest run --project unit scripts` and `npm --prefix storybook run typecheck`. Expected: PASS, with no dangling region references.
- [ ] **Step 3:** Commit: `docs: apComponents() owns the single React copy`.

### Task 9: Verify, retrospective, PR

- [ ] **Step 1:** Run verification rows 3–8 in full. On Windows, row 8 covers all four harness cells and both showcase smokes.
- [ ] **Step 2:** Append a retrospective to this plan, with these headings:
  - What shipped, with commits.
  - npm's layout facts from Task 1.
  - Found while building.
  - Still open.
- [ ] **Step 3:** Push and open the PR. Watch CI until all jobs are green (verification row 9).

## Retrospective

### Baseline (Task 1, before any plugin change, Windows)

| Cell | Result |
|---|---|
| A, build | PASS. Typecheck clean. |
| A, dev | SSR 200 on every route, but the first page load logs 504 "Outdated Optimize Dep": Vite discovers `@base-ui/*` and `@vanilla-extract/recipes/createRuntimeFn` only at runtime, because `@ap/*` is in `optimizeDeps.exclude`, and reloads the page. |
| B, build | PASS. Typecheck clean: no duplicate `@types/react` with a plain tsconfig. |
| B, dev | 500 on every route: `Cannot read properties of null (reading 'useRef')` in `ToastProvider` → `@base-ui/utils/useRefWithInit.mjs`, resolving `react` from `vendor/apComponents/node_modules/react` while `react-dom/server` is the app's. |

**npm's layout facts.** npm 11 installs a linked `file:` package's dependencies, including `@base-ui/*` and their React peer (deduped), into the **app's** `node_modules`. Layout A therefore has one React and one Base UI. In layout B, Node resolution from `@ap/react`'s real path finds `vendor/apComponents/node_modules` first.

_(rest filled in at Task 9)_
