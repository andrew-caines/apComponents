import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Input. Each falls back to a Tier 2 semantic value, so a
 * product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 *
 * `borderInvalid` is `dangerBorder` (ramp step 7) and not `dangerBg` (step 9):
 * step 7 is the gated border role, contrast-checked at 3:1 against the
 * surfaces, which is the ratio WCAG 1.4.11 asks of a non-text boundary.
 */
export const INPUT_TOKENS = {
  bg: tier3('input-bg', vars.color.bgSurface),
  text: tier3('input-text', vars.color.textPrimary),
  placeholder: tier3('input-placeholder', vars.color.textSecondary),
  border: tier3('input-border', vars.color.borderNormal),
  borderHover: tier3('input-border-hover', vars.color.borderInteractive),
  borderInvalid: tier3('input-border-invalid', vars.color.dangerBorder),
  radius: tier3('input-radius', vars.radius.md),
  focusRing: tier3('input-focus-ring', vars.color.focusRing),
} as const
