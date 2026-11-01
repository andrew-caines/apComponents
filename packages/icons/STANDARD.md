# Icon Standard

**Version:** v0. **Status:** frozen as v1 at the end of `icons-pilot`.

v0 ships with `icons-core` and states the current geometry. v1 is frozen at the end of `icons-pilot`, and every built-in after that is drawn to it. The standard is written so a third party could draw an icon that sits in the set unnoticed.

Items marked **[gate]** are checked by code, and each names the test that enforces it. The rest are checked in review.

Credit: [Lucide](https://lucide.dev) is the starting point for this set. Its licence notice is carried in `LICENSE`, enforced by `src/gates/license.gate.test.ts`.

## 1. Geometry

- 24x24 grid, with a 2px padding live area (content within 2-22). **[gate: every coordinate within 1-23, `src/gates/standard.gate.test.ts`]**
- **One stroke weight across the set: 1.5px at 24px**, a lighter, more professional register than the 2px it replaces. Halo stroke: **5px**. Both were decided in review, and the pilot tunes how the glyphs are drawn, not these two values.
- Round caps and round joins. Corner radius is 2px on rectangular containers.
- At least 2px of clear space between parallel strokes, so a glyph doesn't clog at 16px.
- Keylines: circle diameter 20, square 18x18, portrait rectangle 16x20, landscape rectangle 20x16. Optical balance can override them.
- A built-in leaves `viewBox` undefined, so it uses the default `0 0 24 24`. **[gate: `src/gates/standard.gate.test.ts`]**

## 2. Duotone rules

1. **The outline alone is a complete, recognisable icon.** The secondary layer never carries meaning. That keeps outline-only rendering, forced-colours mode and foreign-icon fallback correct by construction.
2. **An icon with an enclosed region uses filled paths.** The secondary is fill only, sits inside or behind the outline's footprint, and fills **one** coherent region: the body of the bell, the face of the document, the interior of the circle. It never mirrors the whole outline.
3. **An open glyph with no enclosed region uses `'halo'`.** Examples are `x`, `check`, `plus`, `chevron-down` and the arrows. The halo is the outline redrawn behind itself at the 5px halo stroke, so the shape gets a soft surround. Choosing between filled and halo is a review item. A filled secondary is preferred wherever a region exists.
4. **Every built-in has a secondary layer.** **[gate: `src/gates/standard.gate.test.ts`]**
5. **A halo fits in the frame.** Its half-width is added to the primary's extent, so a halo icon's primary coordinates stay at least 2.5px (halo stroke / 2) inside the 24px edge. **[gate: `src/gates/standard.gate.test.ts`]**
6. The secondary, filled or halo, must remain distinguishable at the default 40% opacity on both light and dark canvases. This is checked on the contact sheet, not computed.

## 3. Style and metaphor

- The register is calm, professional and business-software. No playful metaphors, no hand-drawn wobble, no decorative detail that disappears at 16px.
- One metaphor per concept across the set. For example, "settings" is always the gear and "delete" is always the bin. The catalogue records the chosen metaphor next to each name.
- Modifier badges, such as plus, check and x on a file, always sit bottom-right and are the same size every time.

## 4. Naming

- kebab-case, ordered subject, then modifier, then container (`file-plus`, `alert-circle`). **[gate: kebab-case, unique, export name = PascalCase(name); uniqueness in `src/gates/standard.gate.test.ts`, export naming in `src/icons.test.ts`]**
- The seven current names are kept as they are. `close` becomes `x`, because a slot now carries the "close" meaning.

## 5. Lucide derivation

Lucide is inspiration and a reference, not a set we reship. A ported icon is **redrawn**, not re-tinted. The test is whether it reads as ours next to Lucide's original on the comparison sheet. It must not be byte-identical. **[gate: no built-in primary path equals the Lucide source path it was ported from, `src/gates/lucide-divergence.gate.test.ts`]**

Each definition records its Lucide source name, or `null` for an original, in the `catalogue.ts` manifest that the gate and the sheet read. `lucide-static` is a pinned `devDependency` only. It is never imported from `src/` outside `src/gates/`. **[gate: `src/gates/isolation.gate.test.ts`]**
