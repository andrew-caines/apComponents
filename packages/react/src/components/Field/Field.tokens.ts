import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for the Field parts. Each falls back to a Tier 2 semantic
 * value (ADR-0007).
 *
 * The error text uses `dangerText` (ramp step 11) rather than `dangerBg`
 * (step 9): step 11 is the ramp's TEXT role, gated at 4.5:1 against
 * `color-bg-canvas` and against `color-danger-bg-subtle` (ADR-0008). Step 9
 * is a solid fill and is not a text colour.
 *
 * Note what the gate does and does not cover: those two pairings, not every
 * surface. A field sitting on `bg-raised` is two neutral steps from the gated
 * background, so its margin is close to the gated one rather than identical.
 */
export const FIELD_TOKENS = {
  gap: tier3('field-gap', vars.space['2']),

  labelText: tier3('field-label-text', vars.color.textPrimary),
  labelSize: tier3('field-label-size', vars.text.sm.size),
  labelLineHeight: tier3('field-label-line-height', vars.text.sm.lineHeight),

  descriptionText: tier3('field-description-text', vars.color.textSecondary),
  descriptionSize: tier3('field-description-size', vars.text.xs.size),
  descriptionLineHeight: tier3('field-description-line-height', vars.text.xs.lineHeight),

  errorText: tier3('field-error-text', vars.color.dangerText),
  errorSize: tier3('field-error-size', vars.text.xs.size),
  errorLineHeight: tier3('field-error-line-height', vars.text.xs.lineHeight),
  errorGap: tier3('field-error-gap', vars.space['1']),
} as const
