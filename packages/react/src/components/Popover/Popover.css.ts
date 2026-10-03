import { style } from '@vanilla-extract/css'
import { cssVarName } from '@ap/motion'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { POPOVER_TOKENS as t } from './Popover.tokens.js'

/** The positioner carries the stacking order; the popup inside it carries the look. */
export const popoverPositionerClass = style({
  '@layer': {
    [componentsLayer]: {
      zIndex: vars.z.popover,
    },
  },
})

/**
 * The raised surface. Motion is Select's pair (§4.1.5 adds none). The popup is
 * portalled out of the trigger's subtree, so it inherits none of the
 * trigger's type: it sets the family itself.
 */
export const popoverPopupClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      maxInlineSize: t.maxInlineSize,
      padding: vars.space['4'],
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

/** Title then the dismiss. The dismiss pins itself to the inline end, title or not. */
export const popoverHeaderClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: vars.space['2'],
    },
  },
})

/** Same typography as `DialogTitle`, one step down the scale. */
export const popoverTitleClass = style({
  '@layer': {
    [componentsLayer]: {
      margin: 0,
      fontFamily: vars.font.heading,
      fontSize: vars.text.md.size,
      lineHeight: vars.text.md.lineHeight,
      fontWeight: vars.font.weightSemibold,
      color: t.titleText,
    },
  },
})

export const popoverDescriptionClass = style({
  '@layer': {
    [componentsLayer]: {
      margin: 0,
      fontSize: vars.text.sm.size,
      lineHeight: vars.text.sm.lineHeight,
      color: t.descriptionText,
    },
  },
})

/** The icon dismiss, matching `Dialog`'s `closeClass` on the focus ring token. */
export const popoverDismissClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      padding: vars.space['2'],
      margin: 0,
      // After `margin: 0`, so it holds. With no title (`aria-label` only) the
      // dismiss is the header's one item, and `space-between` alone would put
      // it at the inline start.
      marginInlineStart: 'auto',
      border: 0,
      borderRadius: vars.radius.sm,
      background: 'transparent',
      color: vars.color.textSecondary,
      font: 'inherit',
      cursor: 'pointer',
      selectors: {
        '&:hover': {
          color: vars.color.textPrimary,
          background: vars.color.actionBgSubtle,
        },
        '&:focus-visible': {
          outlineWidth: vars.misc.focusRingWidth,
          outlineStyle: 'solid',
          outlineColor: t.focusRing,
          outlineOffset: vars.misc.focusRingOffset,
        },
      },
    },
  },
})
