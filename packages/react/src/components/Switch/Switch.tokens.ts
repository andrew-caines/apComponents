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
 * `border`, `borderHover` and `borderInvalid` are the shared control-state
 * roles spec §4.1.10 requires of every form control, by those names and
 * fallbacks (`borderNormal`/`borderInteractive`/`dangerBorder`) — Task 8 of
 * plan 5c, one of two follow-ups 5b deliberately deferred (the other is
 * `RadioGroup`'s `invalid` JSDoc). Plan 5b gave `Checkbox` these same three
 * roles but left `Switch` with none, so `Switch` alone had no `[data-invalid]`
 * rule; §4.1.10 was added specifically to stop that kind of drift. Unlike
 * `Checkbox`, whose box was already outlined, the track had no border at all
 * before this — `Switch.css.ts`'s recipe adds one and compensates the
 * thumb's inset math so the added border does not change the track's outer
 * footprint or the thumb's travel (see the note there).
 *
 * `borderChecked` is `actionBg`, the same value as `trackBgChecked` and the
 * same role `Checkbox` has: once checked, the border takes the fill's colour
 * so the pill fills edge to edge instead of wearing a `borderNormal` ring. It
 * is a distinct token, as on `Checkbox`, so the two can be overridden apart.
 *
 * `borderInvalid` is `dangerBorder`, never `dangerBg`: it is the role gated
 * for 3:1 non-text contrast (ADR-0008), the same reasoning `Checkbox.tokens.ts`
 * gives for its own `borderInvalid`.
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
  border: tier3('switch-border', vars.color.borderNormal),
  borderHover: tier3('switch-border-hover', vars.color.borderInteractive),
  borderChecked: tier3('switch-border-checked', vars.color.actionBg),
  borderInvalid: tier3('switch-border-invalid', vars.color.dangerBorder),
  thumbBg: tier3('switch-thumb-bg', vars.color.bgSurface),
  radius: tier3('switch-radius', vars.radius.full),
  focusRing: tier3('switch-focus-ring', vars.color.focusRing),
} as const
