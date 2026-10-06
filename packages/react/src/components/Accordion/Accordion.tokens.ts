import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Accordion. Each falls back to a Tier 2 semantic value, so
 * a product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 *
 * The trigger takes §4.1.10's control roles: `text` is primary, since the
 * trigger is the item's heading, `focusRing` is the dedicated Tier 2 ring
 * role, and `radius` rounds the hover fill and the ring together.
 * `triggerHoverBg` is `actionBgSubtle`, the quiet fill a pill tab takes.
 * `chevron` is secondary text, so the glyph sits a step behind the label.
 *
 * `itemBorder` is the hairline between items, the quietest border role, as
 * under a Tabs list.
 */
export const ACCORDION_TOKENS = {
  itemBorder: tier3('accordion-item-border', vars.color.borderSubtle),
  text: tier3('accordion-text', vars.color.textPrimary),
  focusRing: tier3('accordion-focus-ring', vars.color.focusRing),
  radius: tier3('accordion-radius', vars.radius.md),
  triggerHoverBg: tier3('accordion-trigger-hover-bg', vars.color.actionBgSubtle),
  chevron: tier3('accordion-chevron', vars.color.textSecondary),
} as const
