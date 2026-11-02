# 0002 — Distribute as a git submodule resolved via `file:` protocol

**Status:** Accepted — 2026-08-29

## Context

Product repositories will consume this library as a vendored git submodule rather than from a package registry. That removes the need to run and authenticate a private registry, and pins consumers to an exact commit SHA.

Git submodules have two failure modes that must be designed around:

1. **Submodules do not install dependencies.** `git submodule update` copies files. It does not resolve `react`, `@base-ui-components/react`, `motion`, or anything else the library needs. Left unaddressed, every product would hand-maintain a list of our transitive dependencies and drift out of sync with us silently.
2. **Consumers compile our source.** Per [ADR-0003](0003-zero-runtime-styling.md) we author styles in vanilla-extract, which requires a bundler plugin at build time.

## Decision

The submodule is vendored at `vendor/apComponents/` in the consuming repository, and the consumer adds a `file:` protocol dependency:

```jsonc
// consumer package.json
{
  "dependencies": {
    "@ap/react": "file:./vendor/apComponents/packages/react"
  }
}
```

This gives SHA-pinned source vendoring **and** real npm dependency resolution — npm reads our `package.json` and installs our declared dependencies transitively, exactly as it would for a registry package.

To make source compilation a one-line change rather than a config archaeology exercise, we ship `@ap/vite`:

```ts
// consumer vite.config.ts
import { apComponents } from '@ap/vite'

export default defineConfig({
  plugins: [reactRouter(), apComponents()],
})
```

`apComponents()` applies `vanillaExtractPlugin()`, sets `ssr.noExternal: ['@ap/react', '@ap/motion', '@ap/tokens']` — required, or SSR builds externalise our packages and never transform the `.css.ts` files — and sets `optimizeDeps.exclude` for dev-server correctness.

`react` and `react-dom` are peer dependencies and must resolve to a single copy in the consumer's tree.

**Amendment, 2026-10-31.** `apComponents()` also owns that single copy, so a consumer adds nothing beyond the plugin. It bundles `@ap/react`'s React-importing dependencies (`AP_BUNDLED_DEPS`) into SSR builds, replaces the CommonJS `use-sync-external-store` with ESM shims, dedupes `react` and `react-dom`, and pre-bundles `@ap/react`'s dependencies for the dev client (`AP_PREBUNDLE`). React itself stays external and resolves to the consumer's copy. This holds whether or not the vendored submodule has its own `node_modules`, in dev and in production; the `external-consumer` CI job proves it. See `docs/superpowers/specs/2026-10-31-single-react-design.md`.

Releases are tagged with semver (`v1.4.0`) on this repository; consumers pin to a tag. `CHANGELOG.md` is maintained at the repository root.

## Consequences

- Consumers need Vite. React Router 8 framework mode mandates Vite 7+, so this is already true for the primary target. A consumer on another bundler cannot use the library without writing equivalent plugin wiring themselves.
- `@ap/vite` becomes a coupling point: a breaking change in Vite's plugin API affects every consumer at once. The preset is small enough to fix quickly.
- No build artifacts are committed. The repository stays clean and there is no stale-`dist` failure mode.
- Debugging is better than with a published package — consumers step into real source with real line numbers.
- Migrating to a private registry later is a packaging change, not a rewrite: the `file:` dependency becomes a version range and nothing else moves. We keep that door open deliberately.
- **Known risk:** `file:` dependencies are symlinked by npm. Vite's dev server and SSR externalisation both behave differently across symlinks. The `@ap/vite` preset exists specifically to encode the correct settings, and the consumer integration test ([ADR-0014](0014-verification-gates.md)) exists specifically to catch it when they stop being correct.

## Alternatives considered

- **Commit a built `dist/` to the submodule.** Removes the plugin requirement entirely. Rejected in favour of source consumption, which gives better debugging and avoids both build output in git history and the CI freshness check it would require.
- **Publish to a private registry now.** The conventional answer. Rejected as premature — it adds registry authentication to every product's CI before the library has proven its shape.
- **Monorepo workspace package.** Only viable if consuming products are co-located. They are not.
