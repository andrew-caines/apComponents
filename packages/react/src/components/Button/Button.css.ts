import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { BUTTON_TOKENS as t } from './Button.tokens.js'

export const buttonRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: vars.space['2'],
        fontFamily: vars.font.body,
        borderRadius: t.radius,
        borderStyle: 'solid',
        borderWidth: '1px',
        cursor: 'pointer',
        textDecoration: 'none',
        selectors: {
          // Focus ring uses `outline`, never `boxShadow`: an outline survives
          // forced-colors mode (Windows High Contrast), where box-shadow is
          // dropped entirely, and it never overlaps the border-box the way a
          // shadow can. The style-rules gate enforces this — a `boxShadow`
          // key inside a `:focus-visible` block fails it.
          '&:focus-visible': {
            outlineWidth: vars.misc.focusRingWidth,
            outlineStyle: 'solid',
            outlineColor: t.focusRing,
            outlineOffset: vars.misc.focusRingOffset,
          },
          // Base UI sets `data-disabled` itself; this component does not
          // invent its own disabled attribute.
          '&[data-disabled]': {
            cursor: 'default',
            opacity: 0.6,
          },
        },
      },
    },
  },
  variants: {
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
    // The actual colour treatment lives entirely in `compoundVariants` below —
    // `variant` and `tone` are declared here only so the recipe recognises
    // them as selectable groups. Flattening this into six named variants
    // (solidAction, solidDanger, outlineAction, …) would duplicate the
    // per-variant structure (background/text/border/hover) six times instead
    // of once; compoundVariants lets `tone` pick the colour set and `variant`
    // pick how it's applied, independently.
    variant: {
      solid: {},
      outline: {},
      ghost: {},
    },
    tone: {
      action: {},
      danger: {},
    },
  },
  compoundVariants: [
    {
      variants: { variant: 'solid', tone: 'action' },
      style: {
        '@layer': {
          [componentsLayer]: {
            background: t.actionBg,
            color: t.actionOnSolid,
            borderColor: 'transparent',
            selectors: {
              '&:hover': { background: t.actionBgHover },
            },
          },
        },
      },
    },
    {
      variants: { variant: 'solid', tone: 'danger' },
      style: {
        '@layer': {
          [componentsLayer]: {
            background: t.dangerBg,
            color: t.dangerOnSolid,
            borderColor: 'transparent',
            selectors: {
              '&:hover': { background: t.dangerBgHover },
            },
          },
        },
      },
    },
    {
      variants: { variant: 'outline', tone: 'action' },
      style: {
        '@layer': {
          [componentsLayer]: {
            background: 'transparent',
            color: t.actionText,
            borderColor: t.border,
            selectors: {
              '&:hover': { background: t.actionSubtle },
            },
          },
        },
      },
    },
    {
      variants: { variant: 'outline', tone: 'danger' },
      style: {
        '@layer': {
          [componentsLayer]: {
            background: 'transparent',
            color: t.dangerText,
            borderColor: t.border,
            selectors: {
              '&:hover': { background: t.dangerSubtle },
            },
          },
        },
      },
    },
    {
      variants: { variant: 'ghost', tone: 'action' },
      style: {
        '@layer': {
          [componentsLayer]: {
            background: 'transparent',
            color: t.actionText,
            borderColor: 'transparent',
            selectors: {
              '&:hover': { background: t.actionSubtle },
            },
          },
        },
      },
    },
    {
      variants: { variant: 'ghost', tone: 'danger' },
      style: {
        '@layer': {
          [componentsLayer]: {
            background: 'transparent',
            color: t.dangerText,
            borderColor: 'transparent',
            selectors: {
              '&:hover': { background: t.dangerSubtle },
            },
          },
        },
      },
    },
  ],
  defaultVariants: { variant: 'solid', size: 'md', tone: 'action' },
})
