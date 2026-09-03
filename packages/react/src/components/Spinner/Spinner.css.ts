import { style } from '@vanilla-extract/css'
import { cssVarName } from '@ap/motion'
import { componentsLayer } from '../../theme/layers.css.js'
import { SPINNER_TOKENS as t } from './Spinner.tokens.js'

/**
 * The animation comes from `@ap/motion`'s `spinner.rotate` composite, named by
 * deriving its custom property rather than by writing the string — a hardcoded
 * `--ap-motion-spinner-rotate` resolves to nothing the day that convention
 * changes, and a spinner that stopped spinning is a failure no gate sees.
 *
 * Reduced motion is handled entirely at the token layer: `motion.css`
 * redefines these keyframes inside `@media (prefers-reduced-motion: reduce)`
 * so the rotation drops away and only the opacity breath remains. There is no
 * media query in this file, and that is ADR-0010's claim working — the
 * component does not know the preference exists.
 *
 * If `motion.css` is not linked, `var()` resolves to nothing, the spinner is
 * simply static, and everything else still works.
 */
export const spinnerClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'inline-block',
      flexShrink: 0,
      animation: `var(${cssVarName('spinner.rotate')})`,
    },
  },
})
