import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Spinner (ADR-0007).
 *
 * There is no colour token here on purpose: the spinner draws with
 * `currentColor`, exactly as `Icon` does, so it inherits whatever context it
 * sits in — the input adornment's icon colour, a button's label colour — with
 * no prop and no override to keep in sync.
 */
export const SPINNER_TOKENS = {
  /** Stroke weight of the arc. Matches the icon set's 2px-on-24 grid. */
  width: tier3('spinner-width', '2px'),
  /**
   * How much of the ring is drawn, as a dash pattern over a circumference of
   * ~56.5 (r=9). `42 15` leaves roughly a quarter open, which is what makes the
   * rotation legible — a closed ring rotating looks like nothing at all.
   */
  dash: tier3('spinner-dash', '42 15'),
} as const
