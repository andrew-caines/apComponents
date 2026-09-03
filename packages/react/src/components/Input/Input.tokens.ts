import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Input. Each falls back to a Tier 2 semantic value, so a
 * product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 *
 * `borderInvalid` is `dangerBorder` (ramp step 7) and not `dangerBg` (step 9):
 * step 7 is the border role, and the one gated for non-text contrast — 3:1
 * against `color-bg-canvas` (ADR-0008), the ratio WCAG 1.4.11 asks of a
 * boundary. The gate pairs it against the canvas, not against every surface,
 * so on `bg-surface` (one neutral step away) the margin is close to the
 * gated one rather than identical to it.
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

  // Adornments (startIcon / endIcon).
  //
  // The slot is `hit-target` wide rather than an em-based icon size, because an
  // adornment carrying an `onClick` is a real button and WCAG 2.5.8 sizes a
  // target, not a glyph. A decorative adornment gets the same box so the two
  // reserve identical space and a field does not reflow when an icon becomes
  // actionable.
  iconSlot: tier3('input-icon-slot', vars.misc.hitTarget),
  iconGap: tier3('input-icon-gap', vars.space['2']),
  icon: tier3('input-icon', vars.color.textSecondary),
  // An actionable adornment is the only part of the control that responds to
  // its own hover, so it needs its own pair — the input's `borderHover` says
  // nothing about a button sitting inside it.
  iconHover: tier3('input-icon-hover', vars.color.textPrimary),
  iconHoverBg: tier3('input-icon-hover-bg', vars.color.actionBgSubtle),
} as const

/**
 * The colours an adornment icon may take.
 *
 * Semantic roles, not the raw `vars.color` keyset. Most of that keyset is
 * backgrounds and borders — `bgCanvas` as an icon colour is an invisible icon,
 * and `borderSubtle` is a 3:1 role being used as a 4.5:1 one. Every entry here
 * is a foreground role the contrast gate covers as text, so a product cannot
 * pick an unreadable one from this list.
 *
 * Applied by setting the Tier 3 custom property rather than by generating a
 * class per colour: this is the dynamic-values-travel-as-custom-properties path
 * ADR-0003 describes, and it reuses the same `--ap-input-icon` hook a product
 * already has for overriding the default.
 */
export const INPUT_ICON_COLORS = Object.freeze({
  /** The default — secondary text, for an icon that should not compete. */
  default: vars.color.textSecondary,
  primary: vars.color.textPrimary,
  action: vars.color.actionText,
  danger: vars.color.dangerText,
  warning: vars.color.warningText,
  success: vars.color.successText,
  info: vars.color.infoText,
})

export type InputIconColor = keyof typeof INPUT_ICON_COLORS
