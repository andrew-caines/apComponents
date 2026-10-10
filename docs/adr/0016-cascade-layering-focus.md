# 0016 — Cascade layers, z-index scale, and focus policy

**Status:** Accepted — 2026-08-29

## Context

Three related gaps, all in the category of "cheap to decide now, expensive to retrofit":

1. **Cascade order.** vanilla-extract emits CSS per module and the consumer's bundler decides file order. Without an explicit strategy, whether a consumer's override wins depends on import order — overrides work by accident, then break by accident.
2. **Stacking order.** Dialog, Popover, Tooltip and Toast all portal to `<body>`. Nothing defined which stacks above which; a toast rendering *behind* a modal backdrop is the classic result.
3. **Focus indication.** `--ap-color-focus-ring` existed as a token with no policy attached — nothing prevented a component (or a consumer) from removing focus indication.

## Decision

### Cascade layers

All library CSS is wrapped in named layers, declared once in `theme.css`:

```css
@layer ap.tokens, ap.components;
```

- `ap.tokens` — custom property definitions (Tiers 1–3, both modes, fonts)
- `ap.components` — all component styles

The property CSS layers guarantee: **layered CSS always loses to unlayered CSS**, regardless of specificity or load order. Any plain consumer stylesheet therefore overrides ours by simply existing. Overriding stops being a specificity war and becomes defined behaviour. (A consumer who wants to lose to us on purpose can put their CSS in an earlier layer — also defined behaviour.)

**No global reset ships.** A library that resets the consumer's page is a bug factory in someone else's codebase. Every component is styled self-contained — it does not depend on any reset existing, and it does not assume the absence of one.

### Z-index token scale

```css
--ap-z-sticky:   1100;   /* sticky headers, toolbars      */
--ap-z-backdrop: 1300;   /* dialog/drawer backdrops        */
--ap-z-dialog:   1400;
--ap-z-popover:  1500;   /* popover, select, menu, combobox */
--ap-z-toast:    1600;
--ap-z-tooltip:  1700;
```

The ordering encodes deliberate rules, not just numbers: **a toast must be visible above an open modal** (it may be reporting the result of the modal's own action), and **tooltips top everything** because they are ephemeral, pointer-anchored and self-dismissing. Gaps of 100 leave room for consumer layers in between.

**No component uses a literal z-index.** Enforced by stylelint: any `z-index` value in `ap.components` that is not a `var(--ap-z-*)` fails lint.

Popovers opened *from* a dialog stack correctly for free — Base UI portals nested surfaces later in DOM order within the same z-band, and later-in-DOM wins at equal z-index.

### Focus policy

- All focus styling uses **`:focus-visible`** — rings appear for keyboard and assistive-tech focus, not on mouse click. (Form fields, where a visible focused state aids everyone, may additionally style `:focus`.)
- One shared ring recipe: `outline: var(--ap-focus-ring-width) solid var(--ap-color-focus-ring); outline-offset: var(--ap-focus-ring-offset)`. `outline` rather than `box-shadow`, because outlines survive `overflow: hidden` and cost no layout.
- **Focus indication is never removed.** stylelint fails any `outline: none` / `outline: 0` in `ap.components` that is not immediately accompanied by a replacement `:focus-visible` style.
- The ring meets the 3:1 non-text contrast minimum against adjacent colours — asserted by the contrast gate ([ADR-0008](0008-contrast-policy.md)) as a semantic pairing.

## Consequences

- Consumer overrides are guaranteed rather than accidental; support questions about "my style doesn't apply" mostly disappear.
- Stacking bugs between portaled surfaces are prevented by construction, and products can slot their own layers into the gaps.
- Focus indication is uniform, keyboard-only, contrast-checked, and cannot be silently removed — three lint rules do what review discipline otherwise would.
- **Cost:** `@layer` requires the browsers of ~2022+. Our Base UI + React 19 baseline is already far past that.
- **Cost:** losing to all unlayered CSS means a consumer's careless global rule (`button { border: none }`) also wins. This is the correct trade — predictable override beats accidental protection — but it goes in the consumer docs as the first FAQ.

**Amended 2026-10-10 (Phase 5h).** The "~2022+" floor above holds for `@layer`, but not for all our CSS. For CSS, the floor is now Chrome and Edge 120 (with Safari 16.4, iOS 16.4 and Firefox 114), set by `@ap/vite`'s `AP_CSS_TARGET`. Our right-to-left rules use `:dir(rtl)`, which needs Chrome 120; below it, Vite's lightningcss minifier lowers `:dir()` to `:lang()` and RTL follows the page language instead of its direction. `@ap/vite` applies the target unless the consumer sets `build.cssTarget` or `build.target`, and warns if the built CSS still has `:dir()` lowered. See CONTRIBUTING, "The CSS browser floor".

## Alternatives considered

- **High-specificity selectors / `!important` defence.** The traditional approach. Rejected: it makes intended overrides as hard as accidental ones.
- **Ship a scoped reset/preflight.** More predictable base for our own styles. Rejected — self-contained component styles achieve the same without touching consumer markup; revisit only if component CSS proves repetitive.
- **Single stacking context manager in JS.** Runtime-assigned z-index (as some libraries do). Rejected: JS-dependent stacking under SSR draws first paint wrong, and the static scale covers every real case.
