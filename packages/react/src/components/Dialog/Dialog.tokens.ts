import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Dialog (ADR-0007).
 *
 * The four `size*` entries are the width CAPS, one per `size` variant. They are
 * caps rather than widths so a product can retheme the scale without the popup
 * ever exceeding the viewport — the recipe always clamps against the available
 * space as well, and the smaller of the two wins.
 *
 * There is no height token, and that is deliberate: block size is not a design
 * choice. A dialog grows to its content and stops at the viewport, and its body
 * scrolls while the header and footer stay pinned. Exposing a height override
 * would let a product push its own close control off-screen.
 */
export const DIALOG_TOKENS = {
  bg: tier3('dialog-bg', vars.color.bgRaised),
  text: tier3('dialog-text', vars.color.textPrimary),
  radius: tier3('dialog-radius', vars.radius.lg),
  shadow: tier3('dialog-shadow', vars.shadow['3']),
  /**
   * The scrim behind the popup. A literal rather than a Tier 2 reference
   * because there is no scrim in the colour system: it is not a surface, not
   * text, and carries no contrast requirement — it is an occluder, and 50%
   * black reads correctly over both the light and the dark canvas.
   */
  scrim: tier3('dialog-scrim', 'rgb(0 0 0 / 0.5)'),
  /** Breathing room between the popup and the viewport edge, on every side. */
  margin: tier3('dialog-margin', vars.space['4']),
  /** Inline padding of the header, body and footer. */
  padding: tier3('dialog-padding', vars.space['5']),
  gap: tier3('dialog-gap', vars.space['4']),
  border: tier3('dialog-border', vars.color.borderSubtle),
  sizeSm: tier3('dialog-size-sm', '20rem'),
  sizeMd: tier3('dialog-size-md', '30rem'),
  sizeLg: tier3('dialog-size-lg', '40rem'),
  sizeXl: tier3('dialog-size-xl', '50rem'),
} as const
