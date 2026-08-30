import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { SURFACE_TOKENS as t } from './Surface.tokens.js'

export const surfaceRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        color: t.text,
        fontFamily: vars.font.body,
        fontSize: vars.text.md.size,
        lineHeight: vars.text.md.lineHeight,
        borderRadius: t.radius,
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: t.border,
      },
    },
  },
  variants: {
    tone: {
      canvas: { '@layer': { [componentsLayer]: { background: t.bgCanvas } } },
      surface: { '@layer': { [componentsLayer]: { background: t.bgSurface } } },
      raised: {
        '@layer': { [componentsLayer]: { background: t.bgRaised, boxShadow: t.shadowRaised } },
      },
    },
    pad: {
      none: { '@layer': { [componentsLayer]: { padding: vars.space['0'] } } },
      sm: { '@layer': { [componentsLayer]: { padding: vars.space['3'] } } },
      md: { '@layer': { [componentsLayer]: { padding: vars.space['5'] } } },
      lg: { '@layer': { [componentsLayer]: { padding: vars.space['6'] } } },
    },
  },
  defaultVariants: { tone: 'surface', pad: 'md' },
})
