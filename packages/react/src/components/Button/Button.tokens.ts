import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Button. Each falls back to a Tier 2 semantic value, so a
 * product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 */
export const BUTTON_TOKENS = {
  actionBg: tier3('button-action-bg', vars.color.actionBg),
  actionBgHover: tier3('button-action-bg-hover', vars.color.actionBgHover),
  actionOnSolid: tier3('button-action-on-solid', vars.color.actionOnSolid),
  actionText: tier3('button-action-text', vars.color.actionText),
  actionSubtle: tier3('button-action-subtle', vars.color.actionBgSubtle),
  dangerBg: tier3('button-danger-bg', vars.color.dangerBg),
  dangerBgHover: tier3('button-danger-bg-hover', vars.color.dangerBgHover),
  dangerOnSolid: tier3('button-danger-on-solid', vars.color.dangerOnSolid),
  dangerText: tier3('button-danger-text', vars.color.dangerText),
  dangerSubtle: tier3('button-danger-subtle', vars.color.dangerBgSubtle),
  border: tier3('button-border', vars.color.borderInteractive),
  radius: tier3('button-radius', vars.radius.md),
  focusRing: tier3('button-focus-ring', vars.color.focusRing),
} as const
