import { style } from '@vanilla-extract/css'
import { componentsLayer } from '../theme/layers.css.js'

/**
 * The standard clip pattern for text that only assistive technology should
 * reach. Shared so the notification surfaces do not each carry a private copy
 * that drifts.
 */
export const visuallyHiddenClass = style({
  '@layer': {
    [componentsLayer]: {
      position: 'absolute',
      inlineSize: '1px',
      blockSize: '1px',
      overflow: 'hidden',
      clipPath: 'inset(50%)',
      whiteSpace: 'nowrap',
      margin: '-1px',
      padding: 0,
      border: 0,
    },
  },
})
