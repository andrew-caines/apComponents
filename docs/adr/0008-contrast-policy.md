# 0008 — Contrast: generate with APCA, gate CI with WCAG 2.1 AA

**Status:** Accepted — 2026-08-29

## Context

Accessible contrast is a requirement, not a preference. But there are two competing standards and they disagree, so choosing one has real consequences.

**WCAG 2.1 contrast ratio** is a simple ratio of relative luminances. It is the legal and procurement standard: VPATs, accessibility audits, Section 508 and EN 301 549 are all written against it. It is also known to be perceptually inaccurate — it was designed around light-background assumptions and does not model how the eye actually responds. In practice it is **over-permissive in dark mode** (pairings pass the arithmetic and read poorly) and **over-strict in some mid-tone ranges**. It also ignores font weight and size entirely, beyond a single large-text threshold.

**APCA** (Accessible Perceptual Contrast Algorithm), developed for the WCAG 3 drafts, models perceptual lightness contrast and accounts for font size and weight. It produces markedly better results, particularly for dark mode and thin type. It is not yet a ratified standard, so it carries no compliance weight.

Choosing only one means either a palette that looks right but cannot be evidenced to an auditor, or a palette that passes audit and reads badly in dark mode.

## Decision

**Use both, for different jobs.**

### APCA drives generation

The colour engine solves for lightness targets against APCA:

| Use | Target |
|---|---|
| Body text | Lc 75 |
| Large text, secondary text | Lc 60 |
| Non-text UI (borders, icons, focus rings) | Lc 45 |

This is what makes the generated palette look correct — especially in dark mode, where WCAG 2.1 alone would happily approve pairings that are unpleasant to read.

### WCAG 2.1 AA gates CI

Every text and UI pairing that the design system actually uses is asserted against WCAG 2.1 AA:

| Use | Minimum |
|---|---|
| Body text on its background | 4.5:1 |
| Large text (≥ 18.66px bold / ≥ 24px) | 3:1 |
| UI components and graphical objects | 3:1 |

The gate runs over **both modes** and **every semantic pairing** in the Tier 2 contract ([ADR-0007](0007-three-tier-token-contract.md)) — not over the full cross-product of Tier 1 primitives, which would be meaningless. A theme that fails AA fails the build. There is no warning level and no allowlist.

The test output is a table of every pairing with its computed ratio and pass/fail, written to `reports/contrast.md` on every CI run. **This is the compliance artifact** — it can be handed to an auditor directly.

### Colour is never the only signal

WCAG 1.4.1 requires that information is not conveyed by colour alone. This is enforced structurally rather than by review: every semantic state in the component API ships an icon or text alongside its colour, and there is no way to render an error state that is colour-only. See [ADR-0011](0011-component-api-conventions.md).

## Consequences

- The palette looks perceptually correct *and* produces an audit artifact. Neither standard alone gives both.
- Contrast failures are caught at generation time, before a component is ever written against them. The generator cannot emit a theme that fails.
- **Cost:** two contrast implementations to maintain, and occasional cases where APCA-optimal and WCAG-passing pull in different directions. The resolution rule is fixed: WCAG AA is a hard floor; APCA optimises within what AA permits.
- Some brand colours simply cannot produce an AA-passing solid-with-white-text pairing. The generator handles this by computing whether step 9 takes white or dark foreground text (`--ap-brand-contrast`) rather than assuming white — a common and visible bug in hand-built systems.
- Moving to APCA-only later, if WCAG 3 ratifies, is a matter of removing the gate.

## Alternatives considered

- **WCAG 2.1 AA only.** One standard, simple to explain. Rejected — it accepts known-poor dark-mode results, and dark mode is in scope from day one.
- **APCA only.** Best perceptual outcome. Rejected — no compliance artifact, and procurement and legal requirements are written against WCAG 2.x.
- **AAA (7:1) as the target.** Highest bar. Rejected: AAA severely constrains usable chroma, and most brand colours cannot reach it. Better offered later as an opt-in high-contrast mode ([ADR-0006](0006-oklch-colour-engine.md)) than imposed on the default theme.
