# One React copy, owned by `apComponents()` — design

**Date:** 2026-10-31
**Status:** Draft for review
**Scope:** `packages/vite`, `fixtures/ssr-app`, `showcase`, a new out-of-repo consumer check in CI,
`storybook/docs/GettingStarted.mdx`, `storybook/docs/SsrRules.mdx`, `docs/CONTRIBUTING.md`, ADR-0002.

## 1. Intent

**Goal.** An app that uses apComponents configures Vite with `apComponents()` and nothing else.
Every React import in its server build, its dev server and its client bundle resolves to the
app's own single copy of React, whatever the install layout.

**Why.** Today the library leaves Base UI as a plain external import in SSR builds. Node then
resolves it at runtime from wherever the built server file sits. In this repo's layout, that
loads a second copy of React, and every hook reads a null dispatcher. Two in-repo apps work around
this with a hand-kept `ssr.noExternal` list of three packages. The guides tell real consumers to
add the same list "if you see the error", because no check covers an app outside the repo. Each
new Base UI dependency that imports React has added an entry, and the last one surfaced as a 500
on one route only. The library should own this, not each app.

**Decisions taken with the user (2026-10-31):**
1. `apComponents()` handles it, and apps add nothing. No `ssr.noExternal`, `resolve.dedupe` or
   alias in an app's config for apComponents' sake.
2. The dev server works too. `react-router dev` on an SSR app that renders every component must
   not fail. Today it does: `use-sync-external-store` is CommonJS, and Vite's dev module runner
   cannot evaluate it once it is inlined. That is why the showcase is served from a build.
3. **"Nothing" means nothing anywhere in the app.** An app's whole footprint is two dependencies,
   `@ap/react` and `@ap/vite`, plus `apComponents()` in its Vite plugins. It has no
   `.npmrc` setting such as `install-links`, no `overrides`, no direct Base UI dependency and no
   alias or dedupe line. Anything else needed is the library's job, through its own manifests or
   the plugin.
4. **Both install layouts are supported.** Layout A: the vendored checkout is never installed
   itself, and npm runs only in the app. Layout B: the vendored checkout also has its own
   `node_modules`, with its own `react`, because a developer ran `npm install` there, for example
   for Storybook. In B, a React import from `@ap/react`'s real path must still reach the app's
   React, in dev SSR, the SSR build and the client build. CI covers both layouts.

**Success criteria:**
- `fixtures/ssr-app` and `showcase` have no `ssr.noExternal` and no `resolve.dedupe` in their
  `vite.config.ts`, and every existing gate stays green. The showcase keeps
  `preserveSymlinks` on Windows, which is a separate drive-letter workaround.
- A new CI job builds an app that lives **outside** the repository and consumes apComponents
  the way a product does. Its config is `plugins: [reactRouter(), apComponents()]` and nothing
  more, and its `package.json` lists only `@ap/react`, `@ap/vite` and the app's own framework
  deps. That job runs in layout A and layout B, and passes for both `react-router build` and
  `react-router dev`. Its server renders a form route and a dialog route with status 200.
- The showcase smoke test passes against `react-router dev` as well as against a build.
- A unit test fails if `@ap/react`'s dependency tree gains a React-importing package that
  `apComponents()` does not handle. The failure happens here, not as a 500 in an app.

## 2. Approach (my call, presented to the user, not yet built)

**2.1 Bundle Base UI's React-importing chain.** `@ap/vite` exports a second list next to
`AP_PACKAGES`, for example `AP_BUNDLED_DEPS`. It holds every package in `@ap/react`'s runtime
dependency tree that imports `react` or `react-dom`. Today that is `@base-ui/react`,
`@base-ui/utils` and `@floating-ui/react-dom`.

`@floating-ui/react-dom` is new. It imports React, and neither in-repo list has it. It is likely
a latent copy of the same bug that today's routes do not reach on the server. The builder should
confirm this with a failing check before adding it.

The plugin's `config` hook adds this list to `ssr.noExternal`. React and react-dom stay external.
They are `@ap/react` peers, so every React import left in the server bundle is a bare `react`
that Node resolves from the app.

**2.2 Replace `use-sync-external-store` rather than bundle it.** Base UI imports
`use-sync-external-store/shim` and `use-sync-external-store/shim/with-selector`. On React 19 the
shim only re-exports React's own `useSyncExternalStore`, and `@ap/react` requires
`react >=19.2.7`. The plugin aliases both specifiers to two small ESM modules that ship in
`@ap/vite`:
- `shim` re-exports `useSyncExternalStore` from `react`.
- `with-selector` is an ESM port of `useSyncExternalStoreWithSelector`.

This removes the only CommonJS module that dev SSR must inline, which is what makes decision 2
achievable. It also removes a dependency that imports React. The port of `with-selector` must
behave like the upstream one, and the builder decides how to show that. One way is to run
upstream's own tests, or a selector-equality test, against both.

**2.3 `resolve.dedupe: ['react', 'react-dom']`** comes from the plugin. It covers the dev server
and the client build, where a nested install can otherwise also resolve two copies.

**2.4 The completeness test.** A unit test in `packages/vite` walks `@ap/react`'s installed
`dependencies`, recursively and excluding peers. It finds every package whose published entry
points import `react` or `react-dom`. It asserts that each one is in the bundled list or the
alias set. The builder chooses the detection method, for example a package's `peerDependencies`
naming React, or a scan of its ESM entries. The test must catch `@floating-ui/react-dom`, and it
must fail when an entry is removed from the list. That is the named perturbation.

## 3. The out-of-repo consumer check

This is a new CI job, and a script that can also run locally. It:
1. Creates a temporary directory **outside** the checkout.
2. Lays out a minimal React Router 8 SSR app there. It vendors apComponents at
   `vendor/apComponents` and depends on `@ap/react` and `@ap/vite` through `file:` paths. This is
   the layout the Getting started guide documents. Using a copy of the checkout or a real
   `git submodule add` is the builder's call. What matters is that the app's `node_modules` is
   not inside the repo and the repo root's `node_modules` is not on its resolution path.
3. Runs `npm install` in the app only.
4. Runs `react-router build`, serves the result, and requests a form route and a dialog route.
   Both must return 200 with the expected markup.
5. Runs `react-router dev` and makes the same two requests.

The routes render `Field`, `Input`, `Button` and `Dialog` at least, which covers the `useId` path
and the store path. The builder may add a Select or Popover route to reach `@floating-ui/react-dom`
on the server, if that is how 2.1's latent case is shown.

**Layouts.** The job runs twice. In layout A, the vendored checkout has no `node_modules`. In
layout B, `npm install` has also been run inside it first (decision 4).

**Open fact the job settles:** whether npm installs a linked `file:` package's dependencies into
the app's `node_modules`. If it does not, the app cannot resolve `@base-ui/react` at all. The
bundling in 2.1 still makes the server build work, but dev or the client build may not. The
builder records what npm does. If an extra step is needed for some layout, the requirement
stands: **apps add nothing**. Any such step belongs in `@ap/vite` or in the library's manifests,
not in the consumer's config.

## 4. Cleanup and docs

- Remove the `ssr.noExternal` and `resolve.dedupe` workarounds and their long comments from
  `fixtures/ssr-app/vite.config.ts` and `showcase/vite.config.ts`. Remove the
  `docs:ssr-noexternal` region and everything that quotes it.
- The showcase can move to `react-router dev` for local work. The smoke test runs against both dev and a build
  (see §6).
- Getting started: drop the "SSR apps that consume through a `file:` path" callout. List what
  `apComponents()` now does: bundles Base UI, replaces `use-sync-external-store`, and dedupes
  React.
- SSR rules: drop the null-dispatcher rule, or rewrite it as "if you see this, file a bug". The
  completeness test is the guard.
- CONTRIBUTING's "second React" section: keep the history, short. It explains why the plugin
  does this.
- ADR-0002: amend the plugin's responsibilities.

## 5. Non-goals and anti-goals

**Non-goals:**
- Two Reacts that an app causes itself, for example two installed versions.
- Changing distribution away from submodule plus `file:`.
- Publishing to a registry.
- React Server Components.

**Anti-goals** (failure even if the tests pass):
- An app has to add any config line for apComponents beyond `apComponents()`.
- `ssr.noExternal: true`, or bundling all of the app's dependencies, to make the problem go
  away. Only `@ap/react`'s own chain may be bundled.
- Dev SSR works only for some components.

## 6. Calls made in review (author's, not the user's)

- **Bundling scope.** If Base UI's non-React dependencies, such as `reselect`, `@floating-ui/dom`
  and `@babel/runtime`, are unresolvable from the app, `@ap/vite` may bundle them too. "Only
  `@ap/react`'s own chain" means `@ap/react`'s whole non-peer runtime tree. The anti-goal
  forbids bundling the **app's** dependencies, not the library's. The completeness test then
  enumerates whatever the bundled list must cover.
- **Dev SSR for every component.** The proof is the showcase smoke test, which walks every
  section, running against `react-router dev` in CI, in addition to the existing build run.
  The out-of-repo check covers form and dialog in dev and build. With both, the anti-goal
  "dev works only for some components" is verified, not assumed.
- **Windows.** The out-of-repo script must pass locally on Windows. If the app needs
  `preserveSymlinks`, or any other line, there, the plugin absorbs it, because apps add
  nothing. If it cannot be absorbed safely, the builder stops and reports.

## 7. Left to the builder

- Names and file layout for the new list, the shims and the CI script.
- How `with-selector` equivalence is shown.
- How the completeness test detects a React import.
- Whether the consumer check is a new job or a step in the existing `consumer` job, as long as it
  runs on PRs.
- Whether the existing `fixtures/consumer` (SPA) gains anything. It already runs a client build
  through `file:`.
