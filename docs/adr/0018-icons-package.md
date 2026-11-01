# 0018 — `@ap/icons`: a standalone duotone icon set

**Status:** Accepted — 2026-10-31

Supersedes the Icons section of [ADR-0012](0012-cross-cutting-services.md).

## Context

The library had seven icons in a string-keyed path map inside `@ap/react`. Products reached past it for Lucide or FontAwesome, and the result was mismatched glyph styles next to our components. A set large enough that a product never needs a second library, drawn to one standard, removes the mismatch. This ADR records the decisions that shape the new package. The reasoning and the full design are in the [spec](../superpowers/specs/2026-10-31-icons-package-design.md); the drawing rules are in [`packages/icons/STANDARD.md`](../../packages/icons/STANDARD.md), which this ADR does not restate.

## Decision

### Package split

Icons live in their own package, `@ap/icons`, with its own version and changelog, so icons can be added without touching a component. It exports source TypeScript, compiled by the consumer ([ADR-0002](0002-distribution-git-submodule.md)), through two entry points:

- `@ap/icons`: icon data, `defineIcon` and types. Framework-free: nothing under `src/` outside `src/react/` imports React (gate-enforced).
- `@ap/icons/react`: the standalone `Icon` renderer. No hooks, no context, no `'use client'`.

Apps import icons through `@ap/react/icons` (lands in icons-react), which re-exports `@ap/icons`, so an app keeps two dependencies and takes icon updates by bumping the submodule.

### Imported values, not string names

`import { Check } from '@ap/react/icons'` then `<Icon icon={Check} />`. Each icon is its own module and `index.ts` only re-exports, so with `sideEffects: false` an unused icon never reaches a bundle. Export names are `PascalCase(name)`; the old `close` is `x`. A foreign component, such as a Lucide icon, is also a valid `icon` value and renders outline only.

### Data format

An `IconDefinition` is `{ name, primary, secondary?, viewBox? }`, made only of SVG path `d` strings. `primary` is the stroked outline and must read as a complete icon alone. `secondary` is the duotone layer: either filled paths, or the literal `'halo'`, which has no paths of its own and tells the renderer to redraw `primary` behind itself with a wider stroke. `'halo'` is the cheap route to duotone for open glyphs (`x`, `check`, `chevron-down`) and for a product's own outline icons. `defineIcon` validates, freezes copies of its input and tags the result with a brand, `Symbol.for('ap.icon')`, so two copies of the package in one tree recognise each other's icons. Built-ins must have a secondary layer.

### Duotone rules and colour resolution

Duotone is off by default and is **active** only when `duoTone` is truthy and the icon is an `IconDefinition` with a `secondary`. The secondary never carries meaning. Enclosed regions use filled paths; open glyphs use the halo.

When not active, the outline is `color ?? currentColor` and `duoTonePrimary` and `duoToneSecondary` are ignored. When active, the outline is `duoTonePrimary ?? color ?? currentColor` and the fill is `duoToneSecondary` used exactly as given, or the outline colour at 40% (`SECONDARY_OPACITY`). The outline colour travels as `style.color`, so the default secondary derives from it. Components render slot icons without `duoTone`, so chrome stays outline-only.

### Strokes: 1.5px and 5px

The outline is 1.5px (`STROKE`), down from 2px, a lighter and more professional register. The halo is 5px (`HALO_STROKE`), which shows 1.75px of surround each side of the outline. Both are constants of the set, not props, so every icon looks the same weight on a page.

### Lucide is a reference only

Lucide (ISC) is the starting point for drawing, never reshipped. `lucide-static` is a pinned `devDependency`, used only by the comparison sheet and the divergence gate, and is never imported outside `src/gates/`. A catalogue manifest records each icon's Lucide source name (or `null`); a gate fails if a built-in's primary path equals its Lucide source. Redrawing is tracked by `PENDING_REDRAW` until the pilot completes. `LICENSE` carries the Lucide notice, and a gate fails if it is lost.

## Alternatives considered

- **String names (`name="check"`).** Familiar and what the library had. Rejected: a name-keyed registry defeats tree-shaking, so a product pays for the whole set, and call sites cannot be statically checked against what is imported.
- **Peer-depending on Lucide.** A bigger set for free. Rejected: with git submodules every peer dependency is one more thing each product keeps in sync by hand, and Lucide has no duotone form. This is the same reasoning as [ADR-0012](0012-cross-cutting-services.md)'s rejection of peer-depending on an icon library.
- **A separate component module per icon (one React component each).** Rejected: it ties every icon to React and to one renderer. Plain data keeps the root entry framework-free, so a later web-component, sprite or SVG-converter build reads the same source, and one `Icon` carries all rendering rules.

## Consequences

- **Breaking change:** `<Icon name>` is removed from `@ap/react` with no deprecation period (done in `icons-react`).
- **Cost:** the set is ours to draw and maintain; the Icon Standard and gates exist to keep that cheap.
- **Not decided here:** how icon colour props relate to the roles-only rule in [ADR-0011](0011-component-api-conventions.md) §6.3 is recorded with `icons-react`.
