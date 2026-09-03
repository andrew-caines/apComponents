import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { INPUT_TOKENS as t } from './Input.tokens.js'

export const inputRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        inlineSize: '100%',
        fontFamily: vars.font.body,
        color: t.text,
        background: t.bg,
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: t.border,
        borderRadius: t.radius,
        selectors: {
          '&::placeholder': {
            color: t.placeholder,
            // Some engines apply a UA opacity to the placeholder; pin it so the
            // colour we contrast-checked is the colour that renders.
            opacity: 1,
          },
          '&:hover:not([data-disabled])': {
            borderColor: t.borderHover,
          },
          // Focus ring uses `outline`, never `boxShadow`: an outline survives
          // forced-colors mode (Windows High Contrast), where box-shadow is
          // dropped entirely. The style-rules gate enforces this.
          '&:focus-visible': {
            outlineWidth: vars.misc.focusRingWidth,
            outlineStyle: 'solid',
            outlineColor: t.focusRing,
            outlineOffset: vars.misc.focusRingOffset,
          },
          // `data-invalid` is Base UI's own state attribute (see
          // internals/field-constants/constants.mjs) — set by Field when the
          // control fails validation or the root is marked invalid. We never
          // invent an attribute of our own for this.
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
