import { style } from '@vanilla-extract/css'
import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { TABS_TOKENS as t } from './Tabs.tokens.js'

/** The list's hairline, on its block end (horizontal) or inline end (vertical). */
const LIST_BORDER = `1px solid ${t.listBorder}`

/**
 * The root only lays the list and the panels out. A vertical list sits
 * beside its panels rather than above them.
 */
export const tabsRootRecipe = recipe({
  base: { '@layer': { [componentsLayer]: { boxSizing: 'border-box' } } },
  variants: {
    orientation: {
      horizontal: {},
      vertical: {
        '@layer': {
          [componentsLayer]: { display: 'flex', alignItems: 'flex-start', gap: vars.space['4'] },
        },
      },
    },
  },
  defaultVariants: { orientation: 'horizontal' },
})

/**
 * The tablist. `position: relative` makes it the indicator's containing
 * block, which is also the box Base UI measures `--active-tab-*` against
 * (`tabs/indicator/TabsIndicator.js:81-82`).
 *
 * A horizontal list never wraps: it scrolls inside its own box
 * (`overflowX: 'auto'`) so a long row of tabs cannot push the page wider.
 * Base UI adds the list's `scrollLeft` to the measured offset (`:81`), so the
 * indicator rides along with the scrolled tabs.
 */
export const tabsListRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex',
        gap: vars.space['1'],
      },
    },
  },
  variants: {
    variant: { underline: {}, pills: {} },
    orientation: {
      horizontal: {
        '@layer': {
          [componentsLayer]: { flexDirection: 'row', flexWrap: 'nowrap', overflowX: 'auto' },
        },
      },
      vertical: {
        '@layer': {
          [componentsLayer]: { flexDirection: 'column', alignItems: 'stretch' },
        },
      },
    },
  },
  compoundVariants: [
    {
      variants: { variant: 'underline', orientation: 'horizontal' },
      style: { '@layer': { [componentsLayer]: { borderBlockEnd: LIST_BORDER } } },
    },
    {
      variants: { variant: 'underline', orientation: 'vertical' },
      style: { '@layer': { [componentsLayer]: { borderInlineEnd: LIST_BORDER } } },
    },
  ],
  defaultVariants: { variant: 'underline', orientation: 'horizontal' },
})

/**
 * One tab. `[data-active]` is Base UI's selected-tab attribute
 * (`tabs/tab/TabsTabDataAttributes.d.ts`). Hover skips a disabled and a
 * selected tab: `:hover:not(…)` outranks a bare `[data-active]` on
 * specificity, as on `Checkbox.css.ts`.
 *
 * `position: relative` puts every tab in the positioned paint layer, so a
 * tab painted after the pill indicator in source order sits above it. That
 * is why `TabsIndicator` comes first inside `TabsList`. No `zIndex` needed.
 *
 * The focus ring is `outline`, never `boxShadow`, as in `Input.css.ts`, but
 * drawn inward like `Input.css.ts`'s `slotButton`: a horizontal list scrolls,
 * and a scroll container clips anything drawn outside its padding box, so an
 * outward ring would lose its block edges.
 */
export const tabRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        margin: 0,
        border: 0,
        paddingBlock: vars.space['2'],
        paddingInline: vars.space['3'],
        background: 'transparent',
        borderRadius: t.radius,
        fontFamily: vars.font.body,
        fontSize: vars.text.sm.size,
        lineHeight: vars.text.sm.lineHeight,
        fontWeight: vars.font.weightMedium,
        whiteSpace: 'nowrap',
        color: t.text,
        cursor: 'pointer',
        selectors: {
          '&:hover:not([data-disabled]):not([data-active])': {
            color: t.textHover,
          },
          '&:focus-visible': {
            outlineWidth: vars.misc.focusRingWidth,
            outlineStyle: 'solid',
            outlineColor: t.focusRing,
            outlineOffset: `calc(-1 * ${vars.misc.focusRingWidth})`,
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
    variant: {
      underline: {
        '@layer': {
          [componentsLayer]: { selectors: { '&[data-active]': { color: t.textSelected } } },
        },
      },
      pills: {
        '@layer': {
          [componentsLayer]: { selectors: { '&[data-active]': { color: t.pillText } } },
        },
      },
    },
    orientation: {
      horizontal: { '@layer': { [componentsLayer]: { justifyContent: 'center' } } },
      vertical: { '@layer': { [componentsLayer]: { justifyContent: 'flex-start' } } },
    },
  },
  defaultVariants: { variant: 'underline', orientation: 'horizontal' },
})

/**
 * Places the indicator at the selected tab. `--active-tab-left` is the tab's
 * offset from the containing block's physical-left padding edge, in scroll
 * coordinates (`TabsIndicator.js:81` adds `scrollLeft`), in either direction.
 * `--active-tab-right` is NOT the mirror of it: Base UI computes it as
 * `scrollWidth - left - width` (`:89`), the distance from the end of the
 * scrollable content, not from the padding edge. Once a horizontal list
 * overflows, which ours may (`overflowX: 'auto'`), the two differ by
 * `scrollWidth - clientWidth`. So RTL never reads `--active-tab-right`. There
 * the inline end is the physical-left side, and the indicator is pinned to it
 * with the same left variable: `insetInlineEnd: var(--active-tab-left)`, with
 * the start inset released to `auto`.
 */
const atSelectedTab = {
  insetInlineStart: 'var(--active-tab-left)',
  selectors: {
    '&:dir(rtl)': { insetInlineStart: 'auto', insetInlineEnd: 'var(--active-tab-left)' },
  },
} as const

/**
 * The indicator: Base UI's `<span role="presentation">`, positioned from the
 * `--active-tab-*` variables it writes (`TabsIndicator.js:103-110`).
 *
 * It moves by a TRANSITION on its position and size, as `Switch.css.ts`'s
 * thumb does, with `vars.duration.fast`, which `theme.css` cuts to 1ms under
 * reduced motion.
 *
 * First paint: there is no slide in from nothing. While the list element is
 * still unknown (it is React state the list sets from its ref,
 * `tabs/list/TabsList.js:39,99`, so it is null on the server and on the first
 * client render), nothing is measured (`TabsIndicator.js:61`), `style` is
 * undefined (`:103`), and the span renders `hidden` (`:111,124`). On the
 * re-render after the list mounts, the variables are set and `hidden` is
 * dropped in the same commit, so the indicator first paints already at the
 * selected tab's position and size. Leaving `display: none` gives a transition
 * no before-change style, so none runs. With no selected value at all it
 * renders nothing (`:130`). This recipe therefore never sets `display`, which
 * would beat the UA `[hidden]` rule; the `[hidden]` guard below makes that
 * explicit.
 */
export const tabsIndicatorRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        position: 'absolute',
        pointerEvents: 'none',
        transitionProperty:
          'inset-inline-start, inset-inline-end, inset-block-start, inline-size, block-size',
        transitionDuration: vars.duration.fast,
        transitionTimingFunction: vars.ease.out,
        selectors: { '&[hidden]': { display: 'none' } },
      },
    },
  },
  variants: {
    variant: {
      underline: { '@layer': { [componentsLayer]: { background: t.indicator } } },
      pills: {
        '@layer': {
          [componentsLayer]: {
            ...atSelectedTab,
            insetBlockStart: 'var(--active-tab-top)',
            inlineSize: 'var(--active-tab-width)',
            blockSize: 'var(--active-tab-height)',
            background: t.pillBg,
            borderRadius: t.radius,
          },
        },
      },
    },
    orientation: { horizontal: {}, vertical: {} },
  },
  compoundVariants: [
    {
      variants: { variant: 'underline', orientation: 'horizontal' },
      style: {
        '@layer': {
          [componentsLayer]: {
            ...atSelectedTab,
            insetBlockEnd: 0,
            inlineSize: 'var(--active-tab-width)',
            blockSize: t.indicatorThickness,
          },
        },
      },
    },
    {
      variants: { variant: 'underline', orientation: 'vertical' },
      style: {
        '@layer': {
          [componentsLayer]: {
            insetInlineEnd: 0,
            insetBlockStart: 'var(--active-tab-top)',
            inlineSize: t.indicatorThickness,
            blockSize: 'var(--active-tab-height)',
          },
        },
      },
    },
  ],
  defaultVariants: { variant: 'underline', orientation: 'horizontal' },
})

/**
 * A panel. Base UI makes it focusable (`tabIndex` 0 while open,
 * `tabs/panel/TabsPanel.js:75`), so it carries the same focus ring as
 * `Input.css.ts`'s field.
 */
export const tabsPanelClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      selectors: {
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
