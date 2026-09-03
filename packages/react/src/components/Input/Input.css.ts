import { style } from '@vanilla-extract/css'
import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { INPUT_TOKENS as t } from './Input.tokens.js'

/**
 * How much inline padding an adorned side needs so the text never runs under
 * the icon: the gap outside the slot, the slot itself, and the gap between the
 * slot and the text.
 *
 * Deliberately independent of `size`. The slot is a hit target, and a hit
 * target does not shrink because the type got smaller — an icon button in a
 * `sm` field still has to be reachable with a finger.
 */
const ADORNED_PAD = `calc(${t.iconGap} + ${t.iconSlot} + ${t.iconGap})`

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
    // Each size sets the two inline longhands rather than the `paddingInline`
    // shorthand, so the adornment compound variants below can override ONE
    // side without also resetting the other. With the shorthand, an
    // end-adorned field would have its start padding silently re-declared.
    size: {
      sm: {
        '@layer': {
          [componentsLayer]: {
            paddingInlineStart: vars.space['3'],
            paddingInlineEnd: vars.space['3'],
            paddingBlock: vars.space['1'],
            fontSize: vars.text.sm.size,
            lineHeight: vars.text.sm.lineHeight,
          },
        },
      },
      md: {
        '@layer': {
          [componentsLayer]: {
            paddingInlineStart: vars.space['4'],
            paddingInlineEnd: vars.space['4'],
            paddingBlock: vars.space['2'],
            fontSize: vars.text.md.size,
            lineHeight: vars.text.md.lineHeight,
          },
        },
      },
      lg: {
        '@layer': {
          [componentsLayer]: {
            paddingInlineStart: vars.space['5'],
            paddingInlineEnd: vars.space['5'],
            paddingBlock: vars.space['3'],
            fontSize: vars.text.lg.size,
            lineHeight: vars.text.lg.lineHeight,
          },
        },
      },
    },
    /** Set by `Input` from the presence of `startIcon` / `endIcon`. */
    adornStart: { true: {}, false: {} },
    adornEnd: { true: {}, false: {} },
  },
  // In `compoundVariants` rather than in the variant groups above, because
  // vanilla-extract emits compound variants last: the padding override then
  // wins over the size rule by source order instead of by whichever variant
  // group happened to be declared second. `Input.test.tsx` asserts the class
  // actually changes; `gen:input-demo` check 7 asserts the computed padding
  // actually changes in a browser.
  compoundVariants: [
    {
      variants: { adornStart: true },
      style: { '@layer': { [componentsLayer]: { paddingInlineStart: ADORNED_PAD } } },
    },
    {
      variants: { adornEnd: true },
      style: { '@layer': { [componentsLayer]: { paddingInlineEnd: ADORNED_PAD } } },
    },
  ],
  defaultVariants: { size: 'md', adornStart: false, adornEnd: false },
})

/**
 * Wraps the control ONLY when there is an adornment to place. An unadorned
 * `Input` renders exactly the bare `<input>` it always did, so adding this
 * feature changed no existing markup, no existing selector, and nothing a
 * consumer may already be styling.
 */
export const inputWrapper = style({
  '@layer': {
    [componentsLayer]: {
      position: 'relative',
      display: 'block',
      inlineSize: '100%',
    },
  },
})

const slot = {
  position: 'absolute',
  insetBlockStart: 0,
  insetBlockEnd: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: t.iconSlot,
  color: t.icon,
} as const

export const slotStart = style({
  '@layer': { [componentsLayer]: { ...slot, insetInlineStart: t.iconGap } },
})

export const slotEnd = style({
  '@layer': { [componentsLayer]: { ...slot, insetInlineEnd: t.iconGap } },
})

/**
 * A decorative adornment must not eat clicks: the whole control reads as one
 * field, so clicking the currency symbol should put the caret in the input
 * behind it rather than doing nothing at all.
 */
export const slotDecorative = style({
  '@layer': { [componentsLayer]: { pointerEvents: 'none' } },
})

export const slotButton = style({
  '@layer': {
    [componentsLayer]: {
      padding: 0,
      margin: 0,
      border: 0,
      background: 'transparent',
      font: 'inherit',
      cursor: 'pointer',
      borderRadius: t.radius,
      selectors: {
        '&:hover:not(:disabled)': {
          color: t.iconHover,
          background: t.iconHoverBg,
        },
        // `outline`, never `boxShadow` — see the note on the input's own ring.
        '&:focus-visible': {
          outlineWidth: vars.misc.focusRingWidth,
          outlineStyle: 'solid',
          outlineColor: t.focusRing,
          // No offset: the ring would otherwise be clipped by the input's own
          // border, which sits a couple of pixels away.
          outlineOffset: '0px',
        },
        '&:disabled': {
          cursor: 'default',
          opacity: 0.6,
        },
      },
    },
  },
})
