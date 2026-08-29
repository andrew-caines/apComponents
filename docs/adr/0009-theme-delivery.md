# 0009 — Theme delivery: build-time CSS with a runtime override API

**Status:** Accepted — 2026-08-29

## Context

The generator produces tokens. How they reach a running application determines whether theming is a build concern or a runtime capability — and the two have very different cost profiles.

Generating themes at runtime on every page load costs JavaScript execution before anything can be painted, and under SSR it risks a flash of unthemed content: the server has no idea what the theme is, so it either guesses or renders unstyled.

Generating only at build time is free and flash-proof, but forecloses per-tenant white-labelling and user-customisable themes without a rebuild and redeploy.

## Decision

**Both, with the static path as the default.**

### Build-time (default path)

The default theme is generated during the library build into a static stylesheet:

```
@ap/react/theme.css
```

It contains Tier 1, 2 and 3 tokens for light and dark, plus the P3 block. Consumers import it once. Zero runtime cost, no flash, correct before JavaScript loads.

### Runtime override API (opt-in)

Products needing per-tenant or user-chosen themes call the generator directly:

```ts
import { generateTheme, toCssText } from '@ap/tokens'

const theme = generateTheme({ brand: tenant.brandColour })
```

The result is injected as CSS custom properties on a scoping element — either via a `<style>` tag rendered **into the server HTML** (the SSR-correct path; the tenant is known from the request, so there is no flash and no hydration mismatch) or via inline `style` on a wrapper element.

`ThemeProvider` handles scoping and nesting. Because tokens are CSS custom properties, a nested `ThemeProvider` re-scopes everything beneath it with no React re-render.

### Colour scheme selection

Three-state: `light` / `dark` / `system`.

- `system` resolves via `@media (prefers-color-scheme: dark)` in pure CSS. No JavaScript, no flash, correct on first paint.
- An explicit user choice sets `data-ap-scheme="light|dark"` on `<html>`, which takes precedence in the cascade.
- **Persisting an explicit choice across page loads is where theme flash comes from.** Two supported paths:
  - **SSR (preferred):** the choice is stored in a cookie, read server-side, and the attribute is rendered into the initial HTML. Zero flash, no script.
  - **SPA:** a tiny synchronous `<ThemeScript />` in `<head>` reads `localStorage` and sets the attribute before first paint. Blocking and inline by necessity — this is the one place a blocking script is correct.

`useColorScheme()` reads and sets the preference. It never reads `localStorage` during render ([ADR-0005](0005-rendering-targets.md)).

## Consequences

- The common case (one theme, static) costs nothing at runtime and cannot flash.
- Multi-tenant white-labelling is possible without forking, and is SSR-correct when the tenant is known from the request.
- Dark mode works with JavaScript disabled.
- **Cost:** two delivery paths to document and test. The runtime path is the one that can go wrong, so it gets the SSR integration test.
- **Cost:** the generator ships in the client bundle for products using the runtime path. It is pure computation with no React dependency ([ADR-0001](0001-package-architecture.md)), so it tree-shakes out entirely for products that do not.
- Nested themes come free from CSS custom property scoping — a dark-themed panel inside a light page requires no special support.

## Alternatives considered

- **Build-time only.** Simplest and fastest. Rejected: it rules out per-tenant theming, which is a plausible near-term requirement for HXM products.
- **Runtime only.** Maximum flexibility. Rejected: it makes every product pay JavaScript cost and flash risk for a capability most will not use.
- **Build-time plus a CLI.** Products generate and commit their own theme file. A good idea that this decision does not preclude — the CLI is a thin wrapper over `generateTheme` and can be added whenever a product wants it.
