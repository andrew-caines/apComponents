import { style } from '@vanilla-extract/css'
import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { BANNER_TOKENS as t } from './Banner.tokens.js'

/** The region. Stacks banners with a gap; empty, it takes no space. */
export const bannerRegionClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: t.gap,
    },
  },
})

/**
 * One banner. The real 1px border on every side is what keeps it visible under
 * `forced-colors`, where the fill is dropped.
 */
export const bannerRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: t.gap,
        padding: t.padding,
        color: t.text,
        fontFamily: vars.font.body,
        fontSize: vars.text.sm.size,
        lineHeight: vars.text.sm.lineHeight,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: t.radius,
      },
    },
  },
  variants: {
    severity: {
      info: { '@layer': { [componentsLayer]: { background: t.bgInfo, borderColor: t.borderInfo } } },
      success: { '@layer': { [componentsLayer]: { background: t.bgSuccess, borderColor: t.borderSuccess } } },
      warning: { '@layer': { [componentsLayer]: { background: t.bgWarning, borderColor: t.borderWarning } } },
      error: { '@layer': { [componentsLayer]: { background: t.bgError, borderColor: t.borderError } } },
    },
  },
  defaultVariants: { severity: 'info' },
})

export const bannerIconRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
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
    },
  },
  defaultVariants: { severity: 'info' },
})

/** Title and description, stacked, taking the free inline space. */
export const bannerBodyClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minInlineSize: 0,
    },
  },
})

export const bannerTitleClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      fontWeight: vars.font.weightSemibold,
    },
  },
})

export const bannerDescriptionClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
    },
  },
})

export const bannerCloseClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      padding: vars.space['1'],
      margin: 0,
      border: 0,
      borderRadius: vars.radius.sm,
      background: 'transparent',
      color: t.text,
      font: 'inherit',
      cursor: 'pointer',
      selectors: {
        '&:hover:not([data-disabled])': { background: vars.color.actionBgSubtle },
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
