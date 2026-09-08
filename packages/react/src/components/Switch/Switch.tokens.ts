import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Switch. Each falls back to a Tier 2 semantic value, so a
 * product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 *
 * `trackBg` is `borderNormal`, not `bgSurface`: the track is a FILLED,
 * borderless shape (unlike `Checkbox`, which pairs a `bgSurface` fill with a
 * separate `border` colour) — its unchecked state still has to read as an
 * affordance rather than an empty surface, and `borderNormal` is the same
 * neutral, mid-contrast role `Checkbox` already leans on for its unchecked
 * outline. `trackBgChecked` mirrors `Checkbox`'s `bgChecked` exactly
 * (`actionBg`).
 *
 * `thumbBg` is `bgSurface`: the thumb has to contrast against BOTH track
 * colours (neutral off, `actionBg` on), and the page-surface colour is the
 * one role guaranteed to sit apart from both.
 *
 * `focusRing` falls back to `vars.color.focusRing` — the dedicated Tier 2
 * role, not `borderInteractive` — matching `Input`/`Button`/`Textarea`/
 * `Checkbox`.
 *
 * The `label*` roles are the ROW — the `<label>` wrapping the track and its
 * text — and they deliberately carry the same values as
 * `CHECKBOX_TOKENS`'s `label*` and `RADIO_GROUP_TOKENS`'s `option*`, which
 * in turn mirror `FIELD_TOKENS`'s `label*` triple. A form that mixes a
 * `Switch`, a `Checkbox`, a `RadioGroup` and a `Field`-wrapped `Input` has to
 * read as one form: same gap between control and copy, same type size for a
 * control's own label as for a field's. They are still distinct tokens so
 * any one of the four can be overridden alone.
 */
export const SWITCH_TOKENS = {
  /** Between the track and its label text. Matches Checkbox's `labelGap`. */
  labelGap: tier3('switch-label-gap', vars.space['2']),
  labelText: tier3('switch-label-text', vars.color.textPrimary),
  labelSize: tier3('switch-label-size', vars.text.sm.size),
  labelLineHeight: tier3('switch-label-line-height', vars.text.sm.lineHeight),

  trackBg: tier3('switch-track-bg', vars.color.borderNormal),
  trackBgChecked: tier3('switch-track-bg-checked', vars.color.actionBg),
  thumbBg: tier3('switch-thumb-bg', vars.color.bgSurface),
  radius: tier3('switch-radius', vars.radius.full),
  focusRing: tier3('switch-focus-ring', vars.color.focusRing),
} as const
