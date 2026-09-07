# 0001 — Package architecture and boundaries

**Status:** Accepted — 2026-08-29

## Context

The library bundles several capabilities that are conceptually independent: a theme generator, a motion system, a component set, and cross-cutting utilities. Shipping them as one undifferentiated package would make the theme generator untestable without React, force every consumer to pull the whole surface, and let boundaries erode until nothing could be extracted or replaced.

The theme generator in particular has value outside React. It is a pure function from a brand colour to a token set. It should be usable from a build script, a Node service, a design-token pipeline, or a future Figma sync.

## Decision

One repository, npm workspaces, five packages:

| Package | Contains | Depends on |
|---|---|---|
| `@ap/tokens` | Colour engine, scale generation, motion/space/type/radius tokens, CSS emitter | nothing |
| `@ap/motion` | Motion token definitions; emits CSS keyframes/vars **and** JS variant objects | `@ap/tokens` |
| `@ap/react` | Components, hooks, formatters, providers, icons | `@ap/tokens`, `@ap/motion`, Base UI, React |
| `@ap/vite` | Vite plugin preset for consumers | `@vanilla-extract/vite-plugin` |
| `docs` (private) | Storybook | all of the above |

**Amended 2026-09-06 (Phase 5a).** The Storybook workspace was implemented as
`storybook/` (package name `ap-storybook`), not `docs`. The decision itself —
a private workspace holding Storybook, never part of a published package — is
unchanged and still honoured.

Two boundaries are enforced by dependency lint rules rather than convention:

1. `@ap/tokens` must not depend on React, the DOM, or any bundler.
2. `@ap/react` must not depend on `react-router`. Router integration happens through Base UI's `render` prop at the call site (see [ADR-0011](0011-component-api-conventions.md)).

## Consequences

- The colour engine is testable as pure data: seed in, token object out. No rendering, no DOM snapshots, no test renderer.
- Products that only want tokens — a marketing site, an email template builder, a native app's design values — can consume `@ap/tokens` alone.
- Five packages means five build configurations and a release process that must keep versions in lockstep. We accept this: the packages version and release together as a single unit.
- The React-free core forbids convenient shortcuts such as reading `window.matchMedia` inside the token layer. Colour-scheme detection belongs in `@ap/react`.
- Not depending on `react-router` means the library survives React Router 9 (expected ~June 2027, per their annual cadence) without a release of its own.

## Alternatives considered

- **Single package.** Simpler to build and release. Rejected because it makes the React-free guarantee unenforceable, and that guarantee is what keeps the theme generator honest.
- **Separate repositories.** Cleanest boundaries, worst ergonomics. Atomic changes across the token contract and its consumers become multi-repo choreography, and this library will change its token contract frequently in its first year.
