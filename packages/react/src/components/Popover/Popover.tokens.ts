import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Popover. Each falls back to a Tier 2 semantic value, so a
 * product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 *
 * The surface roles (`bg`, `border`, `shadow`, `radius`) are `SELECT_TOKENS`'
 * `popup*` roles by value, so the anchored popups share one surface and one
 * elevation. `maxInlineSize` caps the width so long content wraps instead of
 * spanning the viewport.
 */
export const POPOVER_TOKENS = {
  bg: tier3('popover-bg', vars.color.bgSurface),
  border: tier3('popover-border', vars.color.borderNormal),
  shadow: tier3('popover-shadow', vars.shadow['3']),
  radius: tier3('popover-radius', vars.radius.md),
  titleText: tier3('popover-title-text', vars.color.textPrimary),
  descriptionText: tier3('popover-description-text', vars.color.textSecondary),
  focusRing: tier3('popover-focus-ring', vars.color.focusRing),
  maxInlineSize: tier3('popover-max-inline-size', '24rem'),
} as const
