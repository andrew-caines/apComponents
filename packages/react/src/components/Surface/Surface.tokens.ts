import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Surface. Each falls back to a Tier 2 semantic value,
 * so a product can restyle just this component by setting the Tier 3
 * custom property, or restyle the whole theme via Tier 2.
 */
export const SURFACE_TOKENS = {
  bgCanvas: tier3('surface-bg-canvas', vars.color.bgCanvas),
  bgSurface: tier3('surface-bg-surface', vars.color.bgSurface),
  bgRaised: tier3('surface-bg-raised', vars.color.bgRaised),
  border: tier3('surface-border', vars.color.borderSubtle),
  text: tier3('surface-text', vars.color.textPrimary),
  radius: tier3('surface-radius', vars.radius.md),
  shadowRaised: tier3('surface-shadow-raised', vars.shadow['1']),
} as const
