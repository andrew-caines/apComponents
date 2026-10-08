import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Toast (ADR-0007).
 *
 * `width` is a CAP, like `Dialog`'s `sizeMd`: the viewport is never wider than
 * the screen minus `margin` on both sides, and the smaller of the two wins.
 * `margin` is the viewport's distance from the screen edge.
 *
 * Each severity has two roles. `accent*` is the 4px start edge, a border role,
 * and `icon*` is the glyph, a text role, so each is held to the contrast its
 * own use needs (`npm run test:contrast`).
 */
export const TOAST_TOKENS = {
  bg: tier3('toast-bg', vars.color.bgRaised),
  text: tier3('toast-text', vars.color.textPrimary),
  textSecondary: tier3('toast-text-secondary', vars.color.textSecondary),
  border: tier3('toast-border', vars.color.borderSubtle),
  radius: tier3('toast-radius', vars.radius.md),
  shadow: tier3('toast-shadow', vars.shadow['2']),
  padding: tier3('toast-padding', vars.space['4']),
  gap: tier3('toast-gap', vars.space['3']),
  margin: tier3('toast-margin', vars.space['4']),
  width: tier3('toast-width', '22rem'),
  accentInfo: tier3('toast-accent-info', vars.color.infoBorder),
  accentSuccess: tier3('toast-accent-success', vars.color.successBorder),
  accentWarning: tier3('toast-accent-warning', vars.color.warningBorder),
  accentError: tier3('toast-accent-error', vars.color.dangerBorder),
  iconInfo: tier3('toast-icon-info', vars.color.infoText),
  iconSuccess: tier3('toast-icon-success', vars.color.successText),
  iconWarning: tier3('toast-icon-warning', vars.color.warningText),
  iconError: tier3('toast-icon-error', vars.color.dangerText),
} as const
