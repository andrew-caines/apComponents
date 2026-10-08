import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Banner (ADR-0007).
 *
 * Each severity has three roles: `bg*` the subtle fill, `border*` the 1px
 * border (a real border, so the banner survives forced colours), and `icon*`
 * the glyph, a text role held to its own contrast (`npm run test:contrast`).
 */
export const BANNER_TOKENS = {
  bgInfo: tier3('banner-bg-info', vars.color.infoBgSubtle),
  bgSuccess: tier3('banner-bg-success', vars.color.successBgSubtle),
  bgWarning: tier3('banner-bg-warning', vars.color.warningBgSubtle),
  bgError: tier3('banner-bg-error', vars.color.dangerBgSubtle),
  borderInfo: tier3('banner-border-info', vars.color.infoBorder),
  borderSuccess: tier3('banner-border-success', vars.color.successBorder),
  borderWarning: tier3('banner-border-warning', vars.color.warningBorder),
  borderError: tier3('banner-border-error', vars.color.dangerBorder),
  iconInfo: tier3('banner-icon-info', vars.color.infoText),
  iconSuccess: tier3('banner-icon-success', vars.color.successText),
  iconWarning: tier3('banner-icon-warning', vars.color.warningText),
  iconError: tier3('banner-icon-error', vars.color.dangerText),
  text: tier3('banner-text', vars.color.textPrimary),
  radius: tier3('banner-radius', vars.radius.md),
  padding: tier3('banner-padding', vars.space['3']),
  gap: tier3('banner-gap', vars.space['3']),
} as const
