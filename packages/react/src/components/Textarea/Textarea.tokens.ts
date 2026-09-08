import { vars } from '../../theme/contract.css.js'
import { tier3 } from '../../theme/tier3.js'

/**
 * A textarea is an Input that grew a second dimension, so it borrows Input's
 * Tier 2 roles deliberately rather than inventing parallel ones: a product
 * that retints its inputs should not have to retint its textareas separately.
 * The two token sets stay distinct so either can be overridden alone.
 */
export const TEXTAREA_TOKENS = {
  bg: tier3('textarea-bg', vars.color.bgSurface),
  text: tier3('textarea-text', vars.color.textPrimary),
  placeholder: tier3('textarea-placeholder', vars.color.textSecondary),
  border: tier3('textarea-border', vars.color.borderNormal),
  borderHover: tier3('textarea-border-hover', vars.color.borderInteractive),
  borderInvalid: tier3('textarea-border-invalid', vars.color.dangerBorder),
  radius: tier3('textarea-radius', vars.radius.md),
  focusRing: tier3('textarea-focus-ring', vars.color.focusRing),
} as const
