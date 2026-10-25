import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Tabs. Each falls back to a Tier 2 semantic value, so a
 * product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 *
 * The tab's own roles are §4.1.10's control roles: `text` at rest is
 * secondary, and `textSelected` and `textHover` lift it to primary, so the
 * selected tab reads by weight of colour as well as by its indicator.
 * `focusRing` is the dedicated Tier 2 ring role, as on every other control.
 *
 * `listBorder` is the hairline under (or beside) an underline list, the
 * quietest border role; the underline indicator covers it under the selected
 * tab. `indicator` is `actionBg`, the same fill a checked
 * `Checkbox` or `Switch` takes. `indicatorThickness` falls back to the focus
 * ring width, the library's one existing stroke weight, so the underline and
 * a ring drawn on the same tab are the same weight.
 *
 * `pillBg` and `pillText` are the pills variant's selected chip and its
 * label. `actionText` on `actionBgSubtle` is a gated Tier 2 pairing
 * (`contrastReport.ts`), so the selected label keeps 4.5:1.
 */
export const TABS_TOKENS = {
  text: tier3('tabs-text', vars.color.textSecondary),
  textSelected: tier3('tabs-text-selected', vars.color.textPrimary),
  textHover: tier3('tabs-text-hover', vars.color.textPrimary),
  focusRing: tier3('tabs-focus-ring', vars.color.focusRing),
  radius: tier3('tabs-radius', vars.radius.md),
  listBorder: tier3('tabs-list-border', vars.color.borderSubtle),
  indicator: tier3('tabs-indicator', vars.color.actionBg),
  indicatorThickness: tier3('tabs-indicator-thickness', vars.misc.focusRingWidth),
  pillBg: tier3('tabs-pill-bg', vars.color.actionBgSubtle),
  pillText: tier3('tabs-pill-text', vars.color.actionText),
} as const
