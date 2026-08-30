import { globalLayer } from '@vanilla-extract/css'

/**
 * The single `ap.components` cascade layer every component's styles must
 * emit into (ADR-0016). `theme.css` declares the layer order as
 * `@layer ap.tokens, ap.components;` — this name has to match that literal
 * string exactly, so this uses `globalLayer` (which takes the name you give
 * it) rather than `layer` (which generates a hashed/scoped name from a
 * debugId). Every component's `.css.ts` recipe should import this one layer
 * rather than declaring its own, so all component styles land in the same
 * layer and stay unlayered-CSS-loses-to-layered-CSS as ADR-0016 intends.
 */
export const componentsLayer = globalLayer('ap.components')
