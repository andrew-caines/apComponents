# 0013 — Documentation: Storybook on GitHub Pages

**Status:** Accepted — 2026-08-29

## Context

The library needs a component gallery and documentation. Two candidates were considered — Docusaurus and GitHub Pages — but they are not alternatives to each other: **GitHub Pages is a host; Docusaurus is one thing you could host on it.** The real question is what to build, and Pages is the host either way.

The deciding consideration is that documentation for a component library either feeds the test suite or rots. Prose docs describing behaviour drift from the components silently. Stories that render real components cannot drift, because they break.

## Decision

**Storybook**, built in CI and deployed to **GitHub Pages**.

Storybook is chosen because it is simultaneously the gallery, the development environment and part of the test suite:

| Capability | Role |
|---|---|
| Stories | Gallery entries and live playgrounds with typed controls |
| `@storybook/addon-a11y` | Runs axe on every story — the a11y gate in [ADR-0014](0014-verification-gates.md) |
| Interaction tests (`play` functions) | Behavioural tests that are also documentation |
| Autodocs | Props tables generated from TypeScript, so they cannot go stale |
| MDX pages | Long-form docs — colour theory, theming guide, SSR rules, migration notes |

The theme generator gets a dedicated interactive MDX page: enter a brand colour, see the generated ramps, and see the live contrast report. That page is also the fastest way to sanity-check the engine during development.

Docs are versioned by deploying tagged releases to versioned paths, so a product pinned to an older SHA can read the docs matching it.

## Consequences

- One site, one deployment, one thing to keep working.
- Documentation is executable. A component that breaks breaks its story, and CI catches it.
- The a11y gate runs over the same artifact developers browse, so accessibility failures are visible in the place people already look.
- Storybook is also the development environment, so there is no separate playground app to maintain.
- **Cost:** Storybook is weaker than Docusaurus for long-form prose — navigation, search and cross-linking are less good. Acceptable while the prose is a handful of guides; if narrative documentation outgrows it, Docusaurus can be added at the site root with Storybook at `/storybook`, and this ADR superseded.
- **Cost:** Storybook is a heavy dependency with a nontrivial upgrade cadence. It stays confined to the private `docs` workspace and never enters a published package.
- GitHub Pages is public. Nothing confidential goes in a story, and this must be stated in contribution guidelines rather than assumed.

**Amended 2026-09-06 (Phase 5a).** The workspace above was implemented as
`storybook/` (package name `ap-storybook`), not `docs`. The decision itself —
that Storybook stays confined to a private workspace and never enters a
published package — is unchanged and still honoured.

## Alternatives considered

- **Docusaurus.** Far better for prose and versioned narrative docs. Rejected as the primary: live playgrounds, props tables and a11y testing would all have to be hand-built, and none of it would feed CI.
- **Both (Docusaurus at root, Storybook at `/storybook`).** The best end state, roughly double the docs infrastructure. Deferred, not rejected — the migration path is additive.
- **A custom React Router 8 docs site, dogfooding the library.** The most compelling demonstration, since the docs site would itself prove SSR and SPA both work. Rejected as the docs solution — it provides no a11y or interaction test rig — but the *idea* is retained in a smaller form: the SSR/SPA smoke apps in [ADR-0014](0014-verification-gates.md) do exactly this job, as tests rather than as a website.
