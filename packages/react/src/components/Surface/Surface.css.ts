import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { SURFACE_TOKENS as t } from './Surface.tokens.js'

export const surfaceRecipe = recipe({
  base: {
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
  variants: {
    tone: {
      canvas: { background: t.bgCanvas },
      surface: { background: t.bgSurface },
      raised: { background: t.bgRaised, boxShadow: t.shadowRaised },
    },
    pad: {
      none: { padding: vars.space['0'] },
      sm: { padding: vars.space['3'] },
      md: { padding: vars.space['5'] },
      lg: { padding: vars.space['6'] },
    },
  },
  defaultVariants: { tone: 'surface', pad: 'md' },
})
