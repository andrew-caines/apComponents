import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Tooltip. Each falls back to a Tier 2 semantic value, so a
 * product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 *
 * The theme has no inverse colour role (`theme/contract.css.ts`), so a dark
 * tooltip on a light page is out of scope: it would need a new Tier 2 role,
 * the generator and the contrast gate. What separates the tooltip from the
 * page is the raised surface plus `border` and `shadow`. `shadow` is the
 * elevation `SELECT_TOKENS.popupShadow` and `DIALOG_TOKENS.shadow` use, so the
 * overlays sit at one height.
 */
export const TOOLTIP_TOKENS = {
  bg: tier3('tooltip-bg', vars.color.bgRaised),
  text: tier3('tooltip-text', vars.color.textPrimary),
  border: tier3('tooltip-border', vars.color.borderSubtle),
  shadow: tier3('tooltip-shadow', vars.shadow['3']),
  radius: tier3('tooltip-radius', vars.radius.sm),
} as const
