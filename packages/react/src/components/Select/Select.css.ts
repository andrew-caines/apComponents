import { style } from '@vanilla-extract/css'
import { recipe } from '@vanilla-extract/recipes'
import { cssVarName } from '@ap/motion'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { SELECT_TOKENS as t } from './Select.tokens.js'

/**
 * The trigger: a `<button role="combobox">` laid out as a field. Its box —
 * border, padding and type scale per `size` — is `Input.css.ts`'s, so a Select
 * and an Input side by side in one form are the same height at every size.
 */
export const selectTriggerRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: vars.space['2'],
        inlineSize: '100%',
        margin: 0,
        fontFamily: vars.font.body,
        textAlign: 'start',
        color: t.text,
        background: t.bg,
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: t.border,
        borderRadius: t.radius,
        cursor: 'pointer',
        selectors: {
          // Base UI's own state attribute, set on the trigger while no value is
          // selected. The value text inherits it.
          '&[data-placeholder]': {
            color: t.placeholder,
          },
          '&:hover:not([data-disabled])': {
            borderColor: t.borderHover,
          },
          // `outline`, never `boxShadow`: an outline survives forced-colors
          // mode, where box-shadow is dropped. The style-rules gate enforces it.
          '&:focus-visible': {
            outlineWidth: vars.misc.focusRingWidth,
            outlineStyle: 'solid',
            outlineColor: t.focusRing,
            outlineOffset: vars.misc.focusRingOffset,
          },
          '&[data-invalid]': {
            borderColor: t.borderInvalid,
          },
          '&[data-disabled]': {
            cursor: 'default',
            opacity: 0.6,
          },
        },
      },
    },
  },
  variants: {
    // Input's per-size values, verbatim. The shorthand is safe here: Select has
    // no adornment compound variant that overrides one inline side.
    size: {
      sm: {
        '@layer': {
          [componentsLayer]: {
            paddingInline: vars.space['3'],
            paddingBlock: vars.space['1'],
            fontSize: vars.text.sm.size,
            lineHeight: vars.text.sm.lineHeight,
          },
        },
      },
      md: {
        '@layer': {
          [componentsLayer]: {
            paddingInline: vars.space['4'],
            paddingBlock: vars.space['2'],
            fontSize: vars.text.md.size,
            lineHeight: vars.text.md.lineHeight,
          },
        },
      },
      lg: {
        '@layer': {
          [componentsLayer]: {
            paddingInline: vars.space['5'],
            paddingBlock: vars.space['3'],
            fontSize: vars.text.lg.size,
            lineHeight: vars.text.lg.lineHeight,
          },
        },
      },
    },
  },
  defaultVariants: { size: 'md' },
})

/** The selected label: one line, truncated, and allowed to shrink in the flex row. */
export const selectValueClass = style({
  '@layer': {
    [componentsLayer]: {
      minInlineSize: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  },
})

export const selectIconClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'inline-flex',
      flexShrink: 0,
    },
  },
})

/** The positioner carries the stacking order; the popup inside it carries the look. */
export const selectPositionerClass = style({
  '@layer': {
    [componentsLayer]: {
      zIndex: vars.z.popover,
    },
  },
})

/**
 * At least as wide as the trigger, never taller than the space Base UI's
 * positioner measured, and scrolling inside itself past that. Motion is
 * Dialog's pair (§4.1.5 adds none).
 *
 * The popup is portalled out of the trigger's subtree, so it inherits none of
 * the trigger's type: it sets the `md` scale itself.
 */
export const selectPopupClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      minInlineSize: 'var(--anchor-width)',
      maxBlockSize: 'var(--available-height)',
      overflowY: 'auto',
      paddingBlock: vars.space['2'],
      fontFamily: vars.font.body,
      fontSize: vars.text.md.size,
      lineHeight: vars.text.md.lineHeight,
      color: t.itemText,
      background: t.popupBg,
      borderStyle: 'solid',
      borderWidth: '1px',
      borderColor: t.popupBorder,
      borderRadius: t.popupRadius,
      boxShadow: t.popupShadow,
      selectors: {
        '&[data-open]': { animation: `var(${cssVarName('enter.fade-rise')})` },
        '&[data-ending-style]': { animation: `var(${cssVarName('exit.fade')})` },
      },
    },
  },
})

/**
 * An option: an indicator column the width of Checkbox's glyph, then the
 * text. The column is reserved whether or not the item is selected, so the
 * labels of a list never shift as the selection moves.
 */
export const selectItemClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      display: 'grid',
      gridTemplateColumns: `${vars.icon.md} 1fr`,
      alignItems: 'center',
      gap: vars.space['2'],
      paddingInline: vars.space['4'],
      paddingBlock: vars.space['3'],
      color: t.itemText,
      cursor: 'pointer',
      selectors: {
        '&[data-highlighted]': {
          background: t.itemHighlightBg,
        },
        '&[data-disabled]': {
          color: t.itemDisabledText,
          cursor: 'default',
        },
      },
    },
  },
})

/**
 * `Select.ItemIndicator` unmounts when its item is unselected, so it only ever
 * styles the selected state; the text is pinned to column two so it keeps its
 * place when the indicator is absent.
 */
export const selectItemIndicatorClass = style({
  '@layer': {
    [componentsLayer]: {
      gridColumn: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: t.indicator,
    },
  },
})

export const selectItemTextClass = style({
  '@layer': {
    [componentsLayer]: {
      gridColumn: '2',
      minInlineSize: 0,
    },
  },
})

export const selectGroupLabelClass = style({
  '@layer': {
    [componentsLayer]: {
      paddingInline: vars.space['4'],
      paddingBlock: vars.space['2'],
      fontSize: vars.text.sm.size,
      lineHeight: vars.text.sm.lineHeight,
      fontWeight: vars.font.weightSemibold,
      color: t.groupLabelText,
    },
  },
})

export const selectSeparatorClass = style({
  '@layer': {
    [componentsLayer]: {
      blockSize: '1px',
      marginBlock: vars.space['2'],
      background: t.separator,
    },
  },
})
