import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for RadioGroup. Each falls back to a Tier 2 semantic value, so
 * a product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 *
 * The legend/option/hint typography roles deliberately mirror
 * `Field.tokens.ts`'s `label*` and `description*` triples rather than inventing
 * a second scale: this component labels a group the way `Field` labels a single
 * control, and a radio group sitting beside a `Field` in the same form has to
 * read as the same kind of label, not a near-miss.
 *
 * `dot` is `actionBg`, not `actionOnSolid` — the opposite of `Checkbox`'s
 * `glyph`. A checked checkbox FILLS its box with `actionBg` and puts the check
 * mark on top of that fill, so its glyph needs the on-solid role. A checked
 * radio keeps its `bg` surface and paints a dot INSIDE it, which is the
 * conventional radio look and, more importantly, means the selected state is
 * carried by the presence of a shape rather than by a colour change alone
 * (ADR-0011 §5 / WCAG 1.4.1). The dot therefore sits on `bg`, not on a solid
 * fill, and takes the plain action colour.
 *
 * `borderHover` and `borderInvalid` follow `Input.tokens.ts` /
 * `Checkbox.tokens.ts` directly — a hover state and Base UI's own
 * `data-invalid` attribute both need somewhere to read a colour from.
 *
 * `focusRing` falls back to `vars.color.focusRing`, the dedicated Tier 2 role,
 * matching `Input`/`Button`/`Textarea`/`Checkbox`/`Switch`.
 */
export const RADIO_GROUP_TOKENS = {
  /** Between the legend and the option list. */
  gap: tier3('radio-group-gap', vars.space['3']),
  /** Between one option and the next. */
  optionListGap: tier3('radio-group-option-list-gap', vars.space['2']),
  /** Between an option's control and its text. Also sets the hint's indent. */
  optionGap: tier3('radio-group-option-gap', vars.space['2']),
  /** Between an option's text and its hint. */
  hintGap: tier3('radio-group-hint-gap', vars.space['1']),

  legendText: tier3('radio-group-legend-text', vars.color.textPrimary),
  legendSize: tier3('radio-group-legend-size', vars.text.sm.size),
  legendLineHeight: tier3('radio-group-legend-line-height', vars.text.sm.lineHeight),

  optionText: tier3('radio-group-option-text', vars.color.textPrimary),
  optionSize: tier3('radio-group-option-size', vars.text.sm.size),
  optionLineHeight: tier3('radio-group-option-line-height', vars.text.sm.lineHeight),

  hintText: tier3('radio-group-hint-text', vars.color.textSecondary),
  hintSize: tier3('radio-group-hint-size', vars.text.xs.size),
  hintLineHeight: tier3('radio-group-hint-line-height', vars.text.xs.lineHeight),

  bg: tier3('radio-group-bg', vars.color.bgSurface),
  border: tier3('radio-group-border', vars.color.borderNormal),
  borderHover: tier3('radio-group-border-hover', vars.color.borderInteractive),
  borderChecked: tier3('radio-group-border-checked', vars.color.actionBg),
  borderInvalid: tier3('radio-group-border-invalid', vars.color.dangerBorder),
  dot: tier3('radio-group-dot', vars.color.actionBg),
  radius: tier3('radio-group-radius', vars.radius.full),
  focusRing: tier3('radio-group-focus-ring', vars.color.focusRing),
} as const
