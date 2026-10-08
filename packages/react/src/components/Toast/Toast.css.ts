import { style } from '@vanilla-extract/css'
import { recipe } from '@vanilla-extract/recipes'
import { cssVarName } from '@ap/motion'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { TOAST_TOKENS as t } from './Toast.tokens.js'

const motion = (name: string) => `var(${cssVarName(name)})`

/**
 * The stack. `position: fixed` takes it out of flow, and `pointer-events: none`
 * means an empty viewport (or the gap between two toasts) catches no clicks;
 * each Root turns them back on.
 *
 * Bottom placements are `column-reverse` and top ones `column`: Base UI
 * PREPENDS new toasts (`toast/store.js:146`), so the newest is first in DOM
 * order, and the flex direction is what puts it nearest the screen edge.
 *
 * Insets are logical, so `*-start` and `*-end` follow the page direction. The
 * `*-center` placements span the inline axis and centre with `margin-inline:
 * auto` on a width-capped box.
 */
export const toastViewportRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        position: 'fixed',
        zIndex: vars.z.toast,
        display: 'flex',
        gap: t.gap,
        inlineSize: `min(${t.width}, calc(100% - 2 * ${t.margin}))`,
        pointerEvents: 'none',
      },
    },
  },
  variants: {
    placement: {
      'top-start': {
        '@layer': {
          [componentsLayer]: {
            insetBlockStart: t.margin,
            insetInlineStart: t.margin,
            flexDirection: 'column',
          },
        },
      },
      'top-center': {
        '@layer': {
          [componentsLayer]: {
            insetBlockStart: t.margin,
            insetInline: 0,
            marginInline: 'auto',
            flexDirection: 'column',
          },
        },
      },
      'top-end': {
        '@layer': {
          [componentsLayer]: {
            insetBlockStart: t.margin,
            insetInlineEnd: t.margin,
            flexDirection: 'column',
          },
        },
      },
      'bottom-start': {
        '@layer': {
          [componentsLayer]: {
            insetBlockEnd: t.margin,
            insetInlineStart: t.margin,
            flexDirection: 'column-reverse',
          },
        },
      },
      'bottom-center': {
        '@layer': {
          [componentsLayer]: {
            insetBlockEnd: t.margin,
            insetInline: 0,
            marginInline: 'auto',
            flexDirection: 'column-reverse',
          },
        },
      },
      'bottom-end': {
        '@layer': {
          [componentsLayer]: {
            insetBlockEnd: t.margin,
            insetInlineEnd: t.margin,
            flexDirection: 'column-reverse',
          },
        },
      },
    },
  },
  defaultVariants: { placement: 'bottom-end' },
})

/**
 * One toast. The real 1px border on every side is what keeps the toast visible
 * under `forced-colors`, where the shadow is dropped; the 4px start edge is the
 * severity accent drawn over it.
 *
 * Motion (Review Focus 5). `toast.slide-in` and `toast.slide-out` are a
 * physical `translateX(100%)` (`packages/motion/src/motions.ts:119-131`), so
 * they are only right for a `*-end` placement in a left-to-right page, where
 * the toast comes from the edge it is docked to. `*-start`, `*-center` and
 * every right-to-left page use `enter.fade-rise` and `exit.fade`. Where two
 * rules can match at once, the later one has strictly more attribute and
 * pseudo-class selectors, so source order is never what decides.
 *
 * Entry is a base `animation`, so it runs when the element is inserted. Exit is
 * keyed on `[data-ending-style]`, which Base UI sets from
 * `transitionStatus: 'ending'` (`toast/store.js:223-227`) and then waits on
 * `getAnimations()` before removing (`toast/root/ToastRoot.js:106-114`).
 *
 * Swipe. While `[data-swiping]` the inline `transform` follows the pointer and
 * `--toast-swipe-movement-x/y` carry the offset (`toast/root/ToastRoot.js:406-416`).
 * The entry animation is held at zero duration rather than set to `none`,
 * because switching the name back would restart it and replay the entrance
 * after a released swipe. An ending toast that was swiped
 * (`[data-swipe-direction]`) fades out from where it was dropped, keeping that
 * offset through `translate`.
 */
export const toastRootClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      pointerEvents: 'auto',
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      gridTemplateAreas: '"icon title close" "icon description close" "icon action close"',
      columnGap: t.gap,
      alignItems: 'start',
      padding: t.padding,
      background: t.bg,
      color: t.text,
      fontFamily: vars.font.body,
      fontSize: vars.text.sm.size,
      lineHeight: vars.text.sm.lineHeight,
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: t.border,
      borderInlineStartWidth: '4px',
      borderInlineStartColor: t.accentInfo,
      borderRadius: t.radius,
      boxShadow: t.shadow,
      animation: motion('enter.fade-rise'),
      selectors: {
        '&[data-type="info"]': { borderInlineStartColor: t.accentInfo },
        '&[data-type="success"]': { borderInlineStartColor: t.accentSuccess },
        '&[data-type="warning"]': { borderInlineStartColor: t.accentWarning },
        '&[data-type="error"]': { borderInlineStartColor: t.accentError },
        // Past the limit a Root is inert (`toast/root/ToastRoot.js:431`) and
        // flagged (`toast/store.js:49`). It reappears when newer toasts close.
        '&[data-limited]': { display: 'none' },
        '&[data-ending-style]': { animation: motion('exit.fade') },
        '&[data-placement$="-end"]': { animation: motion('toast.slide-in') },
        '&[data-placement$="-end"][data-ending-style]': { animation: motion('toast.slide-out') },
        '&[data-placement$="-end"]:dir(rtl)': { animation: motion('enter.fade-rise') },
        '&[data-placement$="-end"][data-ending-style]:dir(rtl)': {
          animation: motion('exit.fade'),
        },
        '&[data-swiping][data-placement]:not([data-ending-style])': { animationDuration: '0s' },
        '&[data-ending-style][data-swipe-direction][data-placement]': {
          animation: motion('exit.fade'),
          translate: 'var(--toast-swipe-movement-x) var(--toast-swipe-movement-y)',
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

/** The severity glyph. Decorative, and coloured by the matching text role. */
export const toastIconRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        gridArea: 'icon',
        display: 'flex',
        alignItems: 'center',
        blockSize: vars.text.sm.lineHeight,
        fontSize: vars.text.md.size,
      },
    },
  },
  variants: {
    severity: {
      info: { '@layer': { [componentsLayer]: { color: t.iconInfo } } },
      success: { '@layer': { [componentsLayer]: { color: t.iconSuccess } } },
      warning: { '@layer': { [componentsLayer]: { color: t.iconWarning } } },
      error: { '@layer': { [componentsLayer]: { color: t.iconError } } },
      loading: { '@layer': { [componentsLayer]: { color: t.textSecondary } } },
    },
  },
  defaultVariants: { severity: 'info' },
})

export const toastTitleClass = style({
  '@layer': {
    [componentsLayer]: {
      gridArea: 'title',
      margin: 0,
      minInlineSize: 0,
      fontWeight: vars.font.weightSemibold,
      color: t.text,
    },
  },
})

export const toastDescriptionClass = style({
  '@layer': {
    [componentsLayer]: {
      gridArea: 'description',
      margin: 0,
      minInlineSize: 0,
      color: t.textSecondary,
    },
  },
})

export const toastActionClass = style({
  '@layer': {
    [componentsLayer]: {
      gridArea: 'action',
      justifySelf: 'start',
      marginBlockStart: vars.space['2'],
      padding: 0,
      border: 0,
      background: 'transparent',
      color: t.text,
      font: 'inherit',
      fontWeight: vars.font.weightSemibold,
      textDecoration: 'underline',
      cursor: 'pointer',
      selectors: {
        '&:hover:not([data-disabled])': { textDecorationThickness: '2px' },
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

export const toastCloseClass = style({
  '@layer': {
    [componentsLayer]: {
      gridArea: 'close',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: vars.space['1'],
      margin: 0,
      border: 0,
      borderRadius: vars.radius.sm,
      background: 'transparent',
      color: t.textSecondary,
      font: 'inherit',
      cursor: 'pointer',
      selectors: {
        '&:hover:not([data-disabled])': {
          color: t.text,
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
