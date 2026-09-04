import { style } from '@vanilla-extract/css'
import { recipe } from '@vanilla-extract/recipes'
import { cssVarName } from '@ap/motion'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { DIALOG_TOKENS as t } from './Dialog.tokens.js'

/**
 * The scrim. Fixed to the viewport and sitting one z step below the popup, both
 * from the `Z` scale — never a literal, which the style gate enforces.
 */
export const backdropClass = style({
  '@layer': {
    [componentsLayer]: {
      position: 'fixed',
      inset: 0,
      background: t.scrim,
      zIndex: vars.z.backdrop,
      selectors: {
        '&[data-open]': { animation: `var(${cssVarName('enter.fade-rise')})` },
        '&[data-ending-style]': { animation: `var(${cssVarName('exit.fade')})` },
      },
    },
  },
})

/**
 * The positioning container, and the reason the popup can animate at all.
 *
 * Centring with `translate: -50% -50%` is the usual trick and would have been a
 * defect here: `@ap/motion` emits its keyframes as the individual `translate`
 * property (`translate: 0px 8px`), so a centring translate and an animating one
 * would be the same property fighting over one element — the popup would snap
 * to the corner for the duration of every entrance. Flex centring on a parent
 * leaves `translate` entirely to the animation.
 *
 * The padding is what bounds the popup: with `inset: 0` and `box-sizing:
 * border-box`, this element's content box IS the viewport minus the margin, so
 * the popup's `max-block-size: 100%` needs no `calc` and no `dvh` unit.
 */
export const viewportClass = style({
  '@layer': {
    [componentsLayer]: {
      position: 'fixed',
      inset: 0,
      boxSizing: 'border-box',
      padding: t.margin,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: vars.z.dialog,
      // A last-resort escape for a viewport too short even for the capped
      // popup — a phone in landscape with the keyboard up. Without it that
      // overflow is simply unreachable.
      overflow: 'auto',
    },
  },
})

export const popupRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        // The popup itself never scrolls; its body does. That is what keeps the
        // title and the close control visible on a long dialog.
        overflow: 'hidden',
        maxBlockSize: '100%',
        // Fluid below its cap rather than a fixed width, so the popup is never
        // wider than the space the viewport actually has.
        inlineSize: '100%',
        background: t.bg,
        color: t.text,
        borderRadius: t.radius,
        boxShadow: t.shadow,
        fontFamily: vars.font.body,
        selectors: {
          '&[data-open]': { animation: `var(${cssVarName('enter.fade-rise')})` },
          '&[data-ending-style]': { animation: `var(${cssVarName('exit.fade')})` },
        },
      },
    },
  },
  variants: {
    size: {
      sm: { '@layer': { [componentsLayer]: { maxInlineSize: t.sizeSm } } },
      md: { '@layer': { [componentsLayer]: { maxInlineSize: t.sizeMd } } },
      lg: { '@layer': { [componentsLayer]: { maxInlineSize: t.sizeLg } } },
      xl: { '@layer': { [componentsLayer]: { maxInlineSize: t.sizeXl } } },
      /**
       * Shrink-to-fit, bounded at both ends.
       *
       * `fit-content` resolves against the content's MAX-CONTENT width, and a
       * percentage-width child contributes nothing to max-content — so a `fit`
       * dialog wrapping a `Field` and an `Input` would otherwise collapse to
       * the width of the longest label, rendering the inputs as slivers. The
       * `min-inline-size` floor makes that impossible; the cap keeps a long
       * paragraph from running to an unreadable measure. `fit` is for alerts
       * and confirmations, whose content has intrinsic width.
       */
      fit: {
        '@layer': {
          [componentsLayer]: {
            inlineSize: 'fit-content',
            minInlineSize: t.sizeSm,
            maxInlineSize: t.sizeLg,
          },
        },
      },
    },
    /**
     * `auto` is ADR-0017's adaptive presentation: a centred dialog at `sm` and
     * above, a bottom sheet below it. `dialog` is the opt-out that stays
     * centred everywhere. The switch is a media query, not a JS breakpoint —
     * structure decided by a JS media query is a hydration mismatch by
     * construction (ADR-0017).
     */
    layout: {
      dialog: {},
      auto: {
        '@layer': {
          [componentsLayer]: {
            '@media': {
              // 639px, not 640: ADR-0017's `sm` is a MIN-width breakpoint at
              // 640, so the sheet presentation is everything strictly below it.
              '(max-width: 639px)': {
                alignSelf: 'flex-end',
                inlineSize: '100%',
                maxInlineSize: '100%',
                minInlineSize: 0,
                // Square off the edge that meets the viewport edge.
                borderEndStartRadius: 0,
                borderEndEndRadius: 0,
                selectors: {
                  '&[data-open]': { animation: `var(${cssVarName('enter.slide-up')})` },
                  '&[data-ending-style]': { animation: `var(${cssVarName('exit.slide-down')})` },
                },
              },
            },
          },
        },
      },
    },
  },
  defaultVariants: { size: 'md', layout: 'auto' },
})

export const headerClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: t.gap,
      padding: t.padding,
      paddingBlockEnd: vars.space['3'],
    },
  },
})

export const headingsClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      flexDirection: 'column',
      gap: vars.space['1'],
      // Lets the heading column shrink so a long title wraps instead of pushing
      // the close control out of the popup.
      minInlineSize: 0,
      flex: 1,
    },
  },
})

export const titleClass = style({
  '@layer': {
    [componentsLayer]: {
      margin: 0,
      fontFamily: vars.font.heading,
      fontSize: vars.text.lg.size,
      lineHeight: vars.text.lg.lineHeight,
      fontWeight: vars.font.weightSemibold,
      color: vars.color.textPrimary,
    },
  },
})

export const descriptionClass = style({
  '@layer': {
    [componentsLayer]: {
      margin: 0,
      fontSize: vars.text.sm.size,
      lineHeight: vars.text.sm.lineHeight,
      color: vars.color.textSecondary,
    },
  },
})

/**
 * The only scrolling region. `flex: 1` with `min-block-size: 0` is what lets it
 * actually shrink inside the flex column — without the zero minimum a flex item
 * refuses to go below its content size, the popup grows past its cap, and the
 * footer leaves the screen.
 */
export const bodyClass = style({
  '@layer': {
    [componentsLayer]: {
      flex: 1,
      minBlockSize: 0,
      overflow: 'auto',
      paddingInline: t.padding,
      paddingBlock: vars.space['1'],
      fontSize: vars.text.md.size,
      lineHeight: vars.text.md.lineHeight,
    },
  },
})

export const footerClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: vars.space['3'],
      padding: t.padding,
      paddingBlockStart: vars.space['3'],
    },
  },
})

/**
 * The header's dismiss control. Unlike `Input`'s adornments this paints on the
 * element that takes focus: nothing here spans a larger hit area than its own
 * ink, so there is no ring-vs-border collision to solve (ADR-0011 §6.4).
 */
export const closeClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      padding: vars.space['2'],
      margin: 0,
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
          outlineColor: vars.color.focusRing,
          outlineOffset: vars.misc.focusRingOffset,
        },
      },
    },
  },
})
