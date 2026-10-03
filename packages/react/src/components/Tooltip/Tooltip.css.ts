import { style } from '@vanilla-extract/css'
import { cssVarName } from '@ap/motion'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { TOOLTIP_TOKENS as t } from './Tooltip.tokens.js'

/** The positioner carries the stacking order; the popup inside it carries the look. */
export const tooltipPositionerClass = style({
  '@layer': {
    [componentsLayer]: {
      zIndex: vars.z.tooltip,
    },
  },
})

/**
 * A short label on the raised surface, one step down the type scale. The
 * width cap is four of the largest space step, so a long description wraps
 * instead of spanning the viewport. No arrow: the side offset alone ties the
 * popup to its trigger. Motion is Select's pair (§4.1.5 adds none).
 *
 * The popup is portalled out of the trigger's subtree, so it inherits none of
 * the trigger's type: it sets the family and scale itself.
 */
export const tooltipPopupClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      maxInlineSize: `calc(${vars.space['9']} * 4)`,
      paddingBlock: vars.space['1'],
      paddingInline: vars.space['2'],
      fontFamily: vars.font.body,
      fontSize: vars.text.sm.size,
      lineHeight: vars.text.sm.lineHeight,
      color: t.text,
      background: t.bg,
      borderStyle: 'solid',
      borderWidth: '1px',
      borderColor: t.border,
      borderRadius: t.radius,
      boxShadow: t.shadow,
      selectors: {
        '&[data-open]': { animation: `var(${cssVarName('enter.fade-rise')})` },
        '&[data-ending-style]': { animation: `var(${cssVarName('exit.fade')})` },
      },
    },
  },
})
