import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Select. Each falls back to a Tier 2 semantic value, so a
 * product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 *
 * The trigger's roles are spec §4.1.10's control-state contract, by its names
 * and with its fallbacks, plus `placeholder` with the same value as
 * `INPUT_TOKENS.placeholder` — an empty Select and an empty Input in one form
 * should read as the same kind of empty.
 *
 * The `popup*`, `item*`, `indicator`, `groupLabelText` and `separator` roles
 * are beyond the contract: they style the listbox, which no other control in
 * the library has. `popupShadow` is the elevation `DIALOG_TOKENS.shadow` uses,
 * so the two overlays sit at one height. `indicator` is `actionText`, not
 * `actionOnSolid`: the check sits on the popup surface (or the subtle
 * highlight), never on a solid action fill.
 */
export const SELECT_TOKENS = {
  bg: tier3('select-bg', vars.color.bgSurface),
  text: tier3('select-text', vars.color.textPrimary),
  placeholder: tier3('select-placeholder', vars.color.textSecondary),
  border: tier3('select-border', vars.color.borderNormal),
  borderHover: tier3('select-border-hover', vars.color.borderInteractive),
  borderInvalid: tier3('select-border-invalid', vars.color.dangerBorder),
  focusRing: tier3('select-focus-ring', vars.color.focusRing),
  radius: tier3('select-radius', vars.radius.md),

  popupBg: tier3('select-popup-bg', vars.color.bgSurface),
  popupBorder: tier3('select-popup-border', vars.color.borderNormal),
  popupShadow: tier3('select-popup-shadow', vars.shadow['3']),
  popupRadius: tier3('select-popup-radius', vars.radius.md),
  itemHighlightBg: tier3('select-item-highlight-bg', vars.color.actionBgSubtle),
  itemText: tier3('select-item-text', vars.color.textPrimary),
  itemDisabledText: tier3('select-item-disabled-text', vars.color.textSecondary),
  indicator: tier3('select-indicator', vars.color.actionText),
  groupLabelText: tier3('select-group-label-text', vars.color.textSecondary),
  separator: tier3('select-separator', vars.color.borderNormal),
} as const
