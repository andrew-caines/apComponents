# Architecture Decision Records

Decisions that are expensive to reverse, recorded at the point they were made.

Format: [Michael Nygard's](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) — Status, Context, Decision, Consequences, Alternatives considered.

An ADR is immutable once accepted. To change a decision, write a new ADR that supersedes it and update the Status line of the old one.

| # | Decision | Status |
|---|---|---|
| [0001](0001-package-architecture.md) | Package architecture and boundaries | Accepted |
| [0002](0002-distribution-git-submodule.md) | Distribute as a git submodule resolved via `file:` protocol | Accepted |
| [0003](0003-zero-runtime-styling.md) | Zero-runtime styling: vanilla-extract + CSS custom properties | Accepted |
| [0004](0004-base-ui-primitives.md) | Base UI as the unstyled primitive layer | Accepted |
| [0005](0005-rendering-targets.md) | Rendering targets: SPA and React Router 8; RSC out of scope | Accepted |
| [0006](0006-oklch-colour-engine.md) | OKLCH colour engine with role-based 12-step scales | Accepted |
| [0007](0007-three-tier-token-contract.md) | Three-tier design token contract | Accepted |
| [0008](0008-contrast-policy.md) | Contrast: generate with APCA, gate CI with WCAG 2.1 AA | Accepted |
| [0009](0009-theme-delivery.md) | Theme delivery: build-time CSS with a runtime override API | Accepted |
| [0010](0010-motion-system.md) | Motion: CSS-first tokens, Motion opt-in, reduced-motion at the token layer | Accepted |
| [0011](0011-component-api-conventions.md) | Component API: compound parts, `render` passthrough, uncontrolled-first forms | Accepted |
| [0012](0012-cross-cutting-services.md) | Cross-cutting services: formatters, locale, hooks, notifications, icons | Accepted |
| [0013](0013-documentation-storybook.md) | Documentation: Storybook on GitHub Pages | Accepted |
| [0014](0014-verification-gates.md) | Verification and CI gates | Accepted |
| [0015](0015-typography.md) | Typography: self-hosted Inter default, theme-supplied font override | Accepted |
| [0016](0016-cascade-layering-focus.md) | Cascade layers, z-index scale, and focus policy | Accepted |
| [0017](0017-responsive-adaptive.md) | Responsive and adaptive behaviour: desktop and mobile | Accepted |

## Context for all of these

`apComponents` is a React + TypeScript component library for Atlas HXM products. It must work in single-page apps and server-rendered apps, ship accessibility by default, generate its own themes from a brand colour, and be consumed by product repositories as a vendored git submodule.

These decisions were made on 2026-08-29, before any code existed. The accompanying system design is in [`docs/superpowers/specs/2026-08-29-component-library-design.md`](../superpowers/specs/2026-08-29-component-library-design.md).
