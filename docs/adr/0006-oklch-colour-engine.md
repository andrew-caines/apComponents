# 0006 — OKLCH colour engine with role-based 12-step scales

**Status:** Accepted — 2026-08-29

## Context

The theme generator takes a brand colour and produces a complete, coherent, accessible token set. Whether that is possible at all depends almost entirely on the colour space it works in.

**HSL cannot do this.** Its lightness channel is not perceptual. `hsl(60 100% 50%)` (yellow) and `hsl(240 100% 50%)` (blue) both claim 50% lightness; the yellow is perceptually several times brighter. Any ramp built by stepping HSL lightness therefore produces wildly different contrast depending on hue — which is precisely why hand-built palettes always contain one colour that "doesn't work" and nobody can explain why.

**OKLCH is perceptually uniform.** L = 0.6 looks equally light at every hue. That single property is what makes generation possible: define one set of lightness targets, apply them across every hue, get predictable contrast.

## Decision

### Colour space

All internal computation is in **OKLCH**. Output is sRGB hex or `oklch()` with an sRGB fallback.

### Scale shape: generate by role, not by shade

Each hue produces a **12-step scale with fixed semantic meanings** (the model Radix documents, with our own generated values):

| Steps | Role |
|---|---|
| 1–2 | App background, subtle background |
| 3–5 | Component background: rest / hover / active |
| 6–8 | Borders: subtle / normal / focus |
| 9 | Solid fill — this is "the brand colour" |
| 10 | Solid hover |
| 11 | Low-contrast text (guaranteed ≥ 4.5:1 on steps 1–2) |
| 12 | High-contrast text |

Components reference a step **by role**, never by lightness and never by hue name. Swap the hue and nothing can break, because the contract is the role.

### Input: one seed, everything derived

```ts
generateTheme({ brand: '#2E5FD9' })
```

From one brand colour the engine derives:

- **The brand ramp**, anchored so step 9 is the seed (gamut-mapped if needed).
- **Neutrals**, tinted with the brand hue at chroma 0.004–0.015. Pure grey (chroma 0) beside a saturated brand reads as dead and slightly dirty; every good system tints its neutrals. For the calm/enterprise direction this project targets, that means cool-tinted greys anchored near a blue-family primary.
- **Semantic hues** — danger ≈ 25°, warning ≈ 80°, success ≈ 145°, info ≈ 250° — each nudged **up to 10°** toward the brand hue so the family resembles itself. Never further. A green danger colour is a bug, not a brand decision.

Every derived value is overridable, but the zero-config path produces a complete, coherent theme.

#### Minimum hue separation from the brand

The harmony nudge above needs a floor, because the brand is supplied by the product and can land anywhere. The default brand is a blue at 264°; info's base is 250°; the nudge closed that 14.2° gap to **4.2°**, and `action-bg-subtle` (#e9f0ff) came out against `info-bg-subtle` (#e8f1ff) at 1.00:1 — the same colour. A red brand collides with danger identically.

So a status ramp is never brought within **35°** of the brand. When the nudge would breach that, the status is pushed back out to exactly 35°, on **the side its base already sits on** — info stays on the cyan side of blue rather than flipping to violet — crossing to the far side only when the near one would land within 25° of another status's base. Identity first, collision as the tie-break: choosing instead by "farthest from everything else" sends info to 299° violet for the default brand, winning 2° of clearance and losing the meaning.

Contrast gating cannot catch this. Two ramps can each pass AA against the page and still be indistinguishable from *each other* — every contrast gate stayed green the whole time this bug existed. Gate 4 therefore asserts hue separation directly across the 135-seed sweep: ≥35° between the brand and every status, and ≥20° between any two statuses (the observed minimum is 23.9°). Reinstating the unfloored derivation fails it with 123 collisions.

One limit this does not fix: at step 3 the chroma fraction is small enough that *any* two ramps look alike, so `-bg-subtle` backgrounds stay close (ΔE 0.015 for action vs info, up from 0.006). Subtle surfaces should not be the only thing distinguishing two states — let the border, icon and label carry it.

### Modes

**Light and dark are generated from the same seed against mode-specific lightness targets. Dark mode is not inversion.** The rules that make dark mode work:

- Lightness targets are rebuilt for dark, not flipped.
- **Elevation reverses.** In light mode elevated surfaces cast shadows; in dark mode shadows barely read, so elevated surfaces get *lighter*.
- Chroma is reduced at high lightness and often raised at low lightness, or dark surfaces go muddy.
- Never pure white on pure black — it causes halation, where text visibly vibrates. Target roughly `#EDEDED` on `#111`.
- Step 9 stays approximately constant across modes. It is the brand; everything around it moves.

**P3 wide-gamut** values are emitted inside `@media (color-gamut: p3)`, with sRGB as the fallback. Essentially free once gamut mapping exists.

High-contrast mode is **not** generated in v1. The scale design does not preclude adding it later as a third set of lightness targets.

### Gamut mapping

OKLCH can describe colours outside sRGB. Browsers clip naively, which visibly shifts hue. The engine reduces chroma while holding lightness and hue constant until the colour is in gamut (CSS Color 4 gamut mapping), then emits the richer value in the P3 block.

### Non-colour tokens

The same engine emits type scale, spacing, radii, elevation and border widths. These are ratio-derived rather than hand-picked, so a product can shift density or roundness coherently.

## Consequences

- A product supplies one hex value and receives a complete theme in which every pairing is contrast-checked. Coherence is the default rather than an achievement.
- Because roles are fixed, a rebrand cannot break component styling. This is what makes the system re-themeable rather than forkable.
- The engine has real complexity — perceptual colour maths, gamut mapping, contrast solving. It is pure and deterministic, so it is testable as data, which is why [ADR-0001](0001-package-architecture.md) keeps React out of it.
- Nudging semantic hues toward brand risks weakening semantic recognition. The 10° cap plus the never-colour-alone rule ([ADR-0011](0011-component-api-conventions.md)) bound that risk.
- Designers accustomed to hand-picking every value will find the generator constraining. Tier-3 component tokens ([ADR-0007](0007-three-tier-token-contract.md)) provide the escape hatch without breaking the system.

## Alternatives considered

- **Hand-authored palettes.** Total control, no coherence guarantee, and it does not scale to per-tenant theming.
- **HSL/HSV generation.** Rejected — perceptually non-uniform, as above.
- **Material 3 / HCT.** A strong, well-researched system. Rejected because its tonal-palette model bakes in Material's visual language, and its scale is organised by tone rather than by UI role, which is the more useful axis for a component library.
- **Simple lighten/darken of a seed.** What most bespoke systems do. Produces exactly the incoherent, contrast-unsafe ramps this ADR exists to avoid.
