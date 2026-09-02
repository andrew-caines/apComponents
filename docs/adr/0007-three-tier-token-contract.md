# 0007 — Three-tier design token contract

**Status:** Accepted — 2026-08-29

## Context

The most common way a design system becomes unmaintainable is that components reference raw palette values. Once `Button` reads `--ap-blue-9` directly, "blue" is load-bearing: a product whose brand is green cannot retheme without forking components, and no one can change what blue means without auditing every consumer.

The generator in [ADR-0006](0006-oklch-colour-engine.md) produces primitives. Something has to stand between those primitives and the components, or the generator's value is lost the moment a component is written.

## Decision

Three tiers, with a strict rule about who may reference what.

### Tier 1 — Primitives

Raw generated values. Every step of every ramp.

```css
--ap-brand-9: #2E5FD9;
--ap-neutral-3: #F1F2F4;
--ap-danger-11: #C62A2F;
```

**Components must never reference Tier 1.** Enforced by a stylelint rule.

### Tier 2 — Semantic

What a value *means*. This is the theming contract, and the only tier a product should normally need to touch.

```css
--ap-color-bg-canvas:          var(--ap-neutral-1);
--ap-color-bg-surface:         var(--ap-neutral-2);
--ap-color-bg-raised:          var(--ap-neutral-3);
--ap-color-border-subtle:      var(--ap-neutral-6);
--ap-color-border-interactive: var(--ap-neutral-8);
--ap-color-text-primary:       var(--ap-neutral-12);
--ap-color-text-secondary:     var(--ap-neutral-11);
--ap-color-action-bg:          var(--ap-brand-9);
--ap-color-action-bg-hover:    var(--ap-brand-10);
--ap-color-action-on-solid:    var(--ap-brand-contrast);
--ap-color-action-text:        var(--ap-brand-11);
--ap-color-action-bg-subtle:   var(--ap-brand-3);
--ap-color-danger-bg:          var(--ap-danger-9);
--ap-color-focus-ring:         var(--ap-brand-8);
```

Semantic tokens exist for a second reason beyond indirection: **the same colour reads differently against different backgrounds** (simultaneous contrast). A token named `--ap-color-text-on-solid` encodes the pairing, so the contrast guarantee travels with the token instead of depending on where a developer happens to use it.

### Tier 3 — Component

Per-component overrides, defaulting to a Tier 2 value.

```css
--ap-button-solid-bg: var(--ap-color-action-bg);
--ap-button-radius:   var(--ap-radius-md);
--ap-toast-gap:       var(--ap-space-2);
```

Components read Tier 3. Every Tier 3 token is documented per component as its public override surface.

### The rule

```
Components  →  Tier 3  →  Tier 2  →  Tier 1
                                      ↑
                              generator writes here only
```

A retheme touches Tier 2 and everything follows. A one-off override touches Tier 3 and nothing else moves. Nothing touches Tier 1 by hand.

### Naming

`--ap-{tier}-{category}-{role}-{state}`. The `ap-` prefix is mandatory and non-configurable — it is what prevents collisions when a product has its own custom properties.

### Versioning the contract

Tiers 2 and 3 are the published contract; Tier 1 is internal. Repository tags follow semver, with the breaking-change boundary defined as **structural, not visual**:

- **Major:** removing or renaming a Tier 2/3 token, a component prop, or a package export; changing a token's *semantic meaning* (what it is for, not what it resolves to).
- **Minor:** changing a token's resolved value — colour tuning, spacing adjustments, motion timing. Every such change is listed in the changelog under a **Visual changes** heading. Products running screenshot tests re-baseline on minor upgrades; this is the documented expectation, not a surprise.
- **Deprecation window:** a renamed token keeps its old name as an emitted alias for at least one minor release, marked deprecated in the changelog and the TypeScript contract (`@deprecated`), before removal in the next major.

## Consequences

- Retheming works without forking components, which is the entire point of the generator.
- The override surface is explicit and documented, so consumers customise through a supported API rather than by out-specifying our selectors.
- Contrast guarantees attach to semantic pairings rather than to individual colours.
- **Cost:** three levels of indirection to trace when debugging a colour. Mitigated by documentation and by devtools showing the resolved value.
- **Cost:** every new component needs its Tier 3 tokens designed, not just its styles written. This is deliberate friction — it is the step that keeps the system consistent.
- The token count is large (several hundred). vanilla-extract's typed contracts ([ADR-0003](0003-zero-runtime-styling.md)) make it navigable via autocomplete instead of memorisation.

## Alternatives considered

- **Two tiers (primitive + semantic).** Simpler, and adequate until the first time a product needs to change one component without changing the theme. Rejected: that request always arrives.
- **Flat token set.** Rejected — it is the failure mode this ADR exists to prevent.
- **Four or more tiers (adding a per-variant tier).** Rejected as over-engineering; variants are handled by vanilla-extract recipes, not by more custom properties.
