# 0003 — Zero-runtime styling: vanilla-extract + CSS custom properties

**Status:** Accepted — 2026-08-29

## Context

The styling approach has to satisfy four requirements simultaneously, and they constrain each other hard:

1. **Themeable at runtime.** A generated theme ([ADR-0006](0006-oklch-colour-engine.md)) must be applied — and swapped — without rebuilding, and for multi-tenant products without re-rendering the tree.
2. **Correct under server rendering.** Server-rendered HTML must arrive fully styled, with no flash of unstyled content and no per-request setup for consumers to get wrong ([ADR-0005](0005-rendering-targets.md)).
3. **Safe when source is vendored.** Consumers compile our source from a git submodule ([ADR-0002](0002-distribution-git-submodule.md)). Any styling mechanism that depends on a single shared runtime instance is a duplicate-instance hazard across product repositories, and that class of bug fails silently.
4. **Cheap.** Styling a data-dense enterprise UI should cost nothing on the main thread at render time.

The design already contains its own answer to the first requirement. The theme generator was specified to *output a CSS token set that is passed into the component library*. **CSS custom properties are that token set** — and once components read `var(--ap-color-action-bg)`, theming is runtime-switchable with zero JavaScript, zero flash and zero hydration risk. Computing styles in the browser would mean re-solving a problem the token design has already solved, while adding cost to every render.

That settles the direction: styles are static, and everything dynamic flows through custom properties. The remaining question is only how to *author* them.

## Decision

Styles are authored in **vanilla-extract** (`.css.ts`) and compiled to plain CSS at build time. Zero runtime.

The theme contract is **CSS custom properties**. Components never read theme values through JavaScript; they read `var(--ap-*)`.

Dynamic styling is expressed through the two mechanisms Base UI is built around:

- **State via data attributes.** `[data-open]`, `[data-checked]`, `[data-disabled]`, `[data-invalid]` — matched in CSS, set by the primitive.
- **Dynamic values via CSS variables.** Base UI already exposes these (`--available-height` on Popover, panel height on Accordion); we follow the same pattern for our own measured values.

Variants are typed via vanilla-extract `recipes`, so `<Button variant="solid" size="sm">` is checked at compile time and resolves to a static class name at runtime.

vanilla-extract specifically, rather than another zero-runtime option, because it gives **typed token contracts**: the generated token set is a TypeScript object, so a token name typo is a compile error rather than a silently-missing style. With several hundred tokens ([ADR-0007](0007-three-tier-token-contract.md)), that is a real safety property rather than a convenience.

## Consequences

- Themes swap by changing custom property values on a single element. No React re-render, no prop cascade, no flash.
- Server-rendered HTML arrives fully styled. There is no style-collection step for consumers to get wrong.
- Styles cost nothing at render time — no computation, no injection, no main-thread work.
- Authoring stays in TypeScript, colocated with the component, with autocomplete over the token set.
- The React Server Components door stays open at no cost, should [ADR-0005](0005-rendering-targets.md) ever be revisited. Static CSS is the hardest constraint RSC imposes, and this satisfies it.
- **Cost:** styles cannot depend on arbitrary runtime JavaScript values. Anything genuinely dynamic must be expressed as a CSS variable set via the `style` prop. In practice this is a small set of cases — measured positions, user-set dimensions, progress values — and is exactly how Base UI already works.
- **Cost:** consumers must run the vanilla-extract Vite plugin. Addressed by the `@ap/vite` preset in [ADR-0002](0002-distribution-git-submodule.md), which reduces it to one line.
- **Cost:** `.css.ts` is a new authoring model for most contributors. It is TypeScript, colocated and scoped, so the learning curve is short, but component templates and documented conventions ([ADR-0011](0011-component-api-conventions.md)) exist partly to flatten it.

## Alternatives considered

- **CSS Modules.** The same zero-runtime, SSR-safe outcome with plainer tooling and no library-specific plugin — every bundler handles them natively, which would have removed the consumer plugin requirement entirely. Rejected only because it loses typed token autocomplete, which matters at this token count. This remains the fallback if the plugin requirement proves painful in practice.
- **Panda CSS / StyleX.** Both credible zero-runtime systems with strong type stories. Rejected as heavier build-tool couplings for consumers than vanilla-extract, for no gain at this scale.
- **Tailwind.** Widely adopted and zero-runtime. Rejected because it pushes styling decisions into consumer markup, which is the opposite of what a component library that owns its own visual language should do. Nothing here prevents a consuming product from using Tailwind for its own application code.
- **Plain global CSS with BEM-style naming.** No build tooling at all. Rejected — no scoping guarantees, no type safety, and class-name collisions across vendored source are exactly the kind of silent failure this decision is trying to avoid.
