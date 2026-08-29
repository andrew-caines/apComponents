# 0015 — Typography: self-hosted Inter default, theme-supplied font override

**Status:** Accepted — 2026-08-29

## Context

The type system was a gap in the original decision set: [ADR-0006](0006-oklch-colour-engine.md) derives a type *scale* but never decided the typeface, who ships the font files, or what happens while fonts load.

Three constraints shape this:

1. **GDPR.** Loading fonts from Google Fonts CDN sends user IP addresses to Google on every page view. For an HR product serving EU users this is a live legal exposure (German courts have fined for exactly this), not a theoretical one. Fonts must be first-party.
2. **Layout shift.** A web font arriving after first paint reflows text unless the fallback font is metric-matched. Under SSR this is visible and measurable (CLS); metric-compatible fallbacks via `size-adjust` / `ascent-override` / `descent-override` eliminate it.
3. **Theming.** The theme builder must accept a supplied font the same way it accepts a brand colour.

## Decision

### Default: Inter, self-hosted

**Inter** is the default typeface — designed for UI, tabular numerals, broad glyph coverage, an excellent variable font, SIL Open Font License. The variable woff2 (latin + latin-ext subsets) ships **inside `@ap/react`** with an optional side-effect import:

```ts
import '@ap/react/fonts.css'   // @font-face for Inter var + metric-matched fallback
import '@ap/react/theme.css'
```

No third-party requests, works on intranets, nothing for consumers to configure. Products that already load Inter themselves simply omit the import.

`fonts.css` also defines a metric-matched local fallback:

```css
@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial');
  size-adjust: 107%;
  ascent-override: 90%;
  /* … precomputed against Inter's metrics */
}
```

so `--ap-font-body: 'Inter', 'Inter Fallback', system-ui, sans-serif` renders shift-free before and after font load. `font-display: swap` is used; with matched metrics, the swap is invisible.

### Theme-supplied fonts

```ts
generateTheme({
  brand: '#2E5FD9',
  font: { family: 'Poppins' },
})
```

The generator emits the family stack, weight tokens and metric-matched fallback for the supplied font. **Metrics are precomputed and bundled for the preferred five: Inter, Roboto, Open Sans, Poppins, Manrope.** Any other family gets the stack without metric overrides unless the caller supplies metrics explicitly (`font: { family, metrics }`).

The generator emits **tokens only** — it never ships or fetches font files. The product loads its own files for a custom font. This keeps `@ap/tokens` pure ([ADR-0001](0001-package-architecture.md)) and keeps font licensing the product's decision.

### Font tokens (Tier 1 → 2, same contract as colour)

```css
--ap-font-body:    'Inter', 'Inter Fallback', system-ui, sans-serif;
--ap-font-heading: var(--ap-font-body);   /* single-family by default */
--ap-font-mono:    ui-monospace, 'Cascadia Code', Menlo, monospace;

--ap-font-weight-regular: 400;
--ap-font-weight-medium:  500;
--ap-font-weight-semibold: 600;

--ap-text-xs … --ap-text-2xl;             /* size+line-height pairs from the ADR-0006 scale */
--ap-font-numeric: 'tnum';                /* tabular numerals — applied by data components */
```

Components reference `--ap-font-body` etc., never a family name — the same role-not-value rule as [ADR-0007](0007-three-tier-token-contract.md). Tabular numerals are applied automatically in numeric table cells and stat displays, because proportional digits in columns are a legibility bug.

## Consequences

- Zero-config typography that is GDPR-clean and shift-free under SSR.
- A font swap is one line in the theme seed, and for the preferred five it is also shift-free with no extra work.
- Package weight grows by ~100KB of woff2. It is an optional import, so products loading Inter another way pay nothing.
- The five-font metrics table is ours to maintain — small, static, and testable.
- Single-family by default keeps the system calm ([ADR-0006](0006-oklch-colour-engine.md)'s direction); `--ap-font-heading` exists so a product can split heading/body later without a breaking change.

## Alternatives considered

- **Google Fonts CDN.** Zero package weight, best caching story pre-2020. Rejected on GDPR grounds alone; cross-site font caching no longer exists in modern browsers anyway, so the CDN's performance argument is dead.
- **Consumer always self-hosts, even Inter.** Smallest package. Rejected: the default theme would silently render in a fallback font in every product that forgets, which is most of them.
- **Generator downloads and vendors font files at build time.** Nicest DX for swaps. Rejected — it makes the otherwise-pure generator network-dependent and non-deterministic.
- **System font stack only.** Free, fast, zero bytes. Rejected: cross-platform inconsistency is at odds with a design system whose point is consistency, and no tabular-numeral guarantee.
