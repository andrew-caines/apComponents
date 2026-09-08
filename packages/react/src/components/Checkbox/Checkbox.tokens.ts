import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Checkbox. Each falls back to a Tier 2 semantic value, so a
 * product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 *
 * `glyph` is `actionOnSolid`, not `actionText`: the check mark sits ON the
 * solid `actionBg` fill once checked, and `actionOnSolid` is the role for
 * content on a solid action background — the same distinction
 * `Button.tokens.ts` draws between `actionText` (text on a plain surface)
 * and `actionOnSolid` (text/glyph on the solid fill).
 *
 * `borderHover` and `borderInvalid` are not in the brief's literal role list
 * but follow `Input.tokens.ts`/`Textarea.tokens.ts` directly: a hover state
 * and Base UI's own `data-invalid` attribute both need somewhere to read a
 * colour from, and inventing a fresh pattern for just this component would
 * break with what every other control in this library already does.
 *
 * The `label*` roles are the ROW — the `<label>` wrapping the box and its
 * text — and they deliberately carry the same values as
 * `RADIO_GROUP_TOKENS`'s `optionGap`/`optionText`/`optionSize`/
 * `optionLineHeight` and, one hop further back, `FIELD_TOKENS`'s `label*`
 * triple. A form that mixes a `Checkbox`, a `Switch`, a `RadioGroup` and a
 * `Field`-wrapped `Input` has to read as one form: same gap between control
 * and copy, same type size for a control's own label as for a field's. They
 * are still distinct tokens so any one of the four can be overridden alone.
 */
export const CHECKBOX_TOKENS = {
  /** Between the box and its label text. Matches RadioGroup's `optionGap`. */
  labelGap: tier3('checkbox-label-gap', vars.space['2']),
  labelText: tier3('checkbox-label-text', vars.color.textPrimary),
  labelSize: tier3('checkbox-label-size', vars.text.sm.size),
  labelLineHeight: tier3('checkbox-label-line-height', vars.text.sm.lineHeight),

  bg: tier3('checkbox-bg', vars.color.bgSurface),
  bgChecked: tier3('checkbox-bg-checked', vars.color.actionBg),
  border: tier3('checkbox-border', vars.color.borderNormal),
  borderHover: tier3('checkbox-border-hover', vars.color.borderInteractive),
  borderChecked: tier3('checkbox-border-checked', vars.color.actionBg),
  borderInvalid: tier3('checkbox-border-invalid', vars.color.dangerBorder),
  glyph: tier3('checkbox-glyph', vars.color.actionOnSolid),
  radius: tier3('checkbox-radius', vars.radius.sm),
  focusRing: tier3('checkbox-focus-ring', vars.color.focusRing),
} as const
