# 0004 — Base UI as the unstyled primitive layer

**Status:** Accepted — 2026-08-29

## Context

Accessible interactive components are extremely expensive to build correctly. A production-grade Select needs typeahead, virtual focus, collision-aware positioning, scroll locking, ARIA relationships, touch handling, RTL support, and correct behaviour across three screen readers. Building that from scratch for fifteen components is a multi-year project, and the failure mode is invisible: it works for sighted mouse users and fails silently for everyone else.

The requirement is that accessibility is baked in rather than bolted on. That means adopting a primitive layer whose entire purpose is behaviour and ARIA correctness.

## Decision

**Base UI** (`@base-ui-components/react`) is the primitive layer for every interactive component.

Base UI reached **stable 1.7.0 on 2026-08-04** with 40+ components. Four properties make it the right fit:

1. **Genuinely unstyled** — it ships no CSS and takes no position on styling, which is what lets [ADR-0003](0003-zero-runtime-styling.md) work.
2. **Data-attribute state model** — `[data-open]`, `[data-checked]`, `[data-disabled]` are exactly the hook a zero-runtime CSS system needs to express dynamic state.
3. **Compound by construction** — `Popover.Root` / `Trigger` / `Positioner` / `Popup`, matching the compound API we want to expose.
4. **Documented Motion integration** — animation state is detected via `element.getAnimations()`, with `AnimatePresence` + `keepMounted` for unmounting trees and `actionsRef.current.unmount()` for manual lifecycle control.

Our components **wrap** Base UI parts; they do not re-export them unchanged and do not reimplement their behaviour. Where Base UI has no primitive for something (Card, Badge, EmptyState, layout parts), we build it directly with the same conventions.

We pin an exact Base UI version and upgrade deliberately, treating it as we would a framework rather than a leaf dependency.

## Consequences

- Focus management, keyboard interaction, ARIA wiring and screen-reader behaviour are inherited rather than authored. This is the single largest contributor to the "a11y baked in" requirement being achievable at all.
- Our accessibility ceiling is Base UI's accessibility ceiling. Where they have a bug, we have a bug. Mitigated by the axe gate in [ADR-0014](0014-verification-gates.md), which will catch regressions even when they originate upstream.
- Base UI's compositional shape leaks into our public API by design. That is a feature — consumers who know Base UI already know our components — but it means a future migration away from Base UI would be a breaking change to our API, not an internal refactor. We accept this coupling knowingly.
- Base UI components are client components. Every wrapped component carries a `'use client'` directive, kept even though RSC is out of scope, because it costs nothing and preserves the option.

## Alternatives considered

- **Radix UI.** The most mature option, with an enormous installed base. Base UI is from overlapping authorship (Radix and Floating UI contributors, under MUI), is more actively developed as of 2026, and has the better-documented Motion story. Radix remains the fallback if Base UI stalls.
- **React Aria (Adobe).** Arguably the strongest accessibility implementation available, especially for internationalisation and touch. Rejected because its hooks-first model produces markedly more boilerplate per component and a less compound-shaped public API.
- **Build primitives ourselves.** Rejected. The cost is enormous and the failure mode is silent inaccessibility.
- **Headless UI.** Smaller surface than needed for this component set.
