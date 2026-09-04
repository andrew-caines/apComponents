import { style } from '@vanilla-extract/css'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { FIELD_TOKENS as t } from './Field.tokens.js'

export const fieldRootClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      flexDirection: 'column',
      gap: t.gap,
      fontFamily: vars.font.body,
    },
  },
})

export const fieldLabelClass = style({
  '@layer': {
    [componentsLayer]: {
      color: t.labelText,
      fontSize: t.labelSize,
      lineHeight: t.labelLineHeight,
      fontWeight: 500,
    },
  },
})

export const fieldDescriptionClass = style({
  '@layer': {
    [componentsLayer]: {
      margin: 0,
      color: t.descriptionText,
      fontSize: t.descriptionSize,
      lineHeight: t.descriptionLineHeight,
    },
  },
})

export const fieldErrorClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      // flex-start, not center: a two-line error message should keep its icon
      // beside the FIRST line, not floating in the middle of the block.
      alignItems: 'flex-start',
      gap: t.errorGap,
      color: t.errorText,
      fontSize: t.errorSize,
      lineHeight: t.errorLineHeight,
    },
  },
})

export const fieldErrorIconClass = style({
  '@layer': {
    [componentsLayer]: {
      flexShrink: 0,
      // The icon is 1em, so it matches the cap height of the text beside it but
      // sits fractionally high against a taller line box. A logical nudge (not
      // a physical margin-top, which the style-rules gate rejects) lands it on
      // the text baseline.
      marginBlockStart: '0.15em',
    },
  },
})
