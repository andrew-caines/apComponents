import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { TEXTAREA_TOKENS as t } from './Textarea.tokens.js'

export const textareaRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        display: 'block',
        inlineSize: '100%',
        fontFamily: vars.font.body,
        color: t.text,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: t.radius,
        paddingBlock: vars.space['2'],
        paddingInline: vars.space['3'],
        // Nested under `selectors`, matching Input.css.ts: vanilla-extract's
        // `StyleRule` type does not accept a bare `&[data-invalid]`-style key
        // as a direct sibling of plain CSS properties (`npm run typecheck`
        // catches it), only shorthand pseudo-classes without `&`. Grouping
        // everything under `selectors` keeps one consistent shape.
        selectors: {
          '&::placeholder': { color: t.placeholder },
          // `:not([data-disabled])`-guarded, matching Input.css.ts:38 and every
          // other control in this library: without the guard a DISABLED
          // textarea still repaints its border on hover, advertising an
          // interaction it will refuse.
          '&:hover:not([data-disabled])': { borderColor: t.borderHover },
          // Longhand, matching Input.css.ts: `outline`, never `boxShadow` — an
          // outline survives forced-colors mode (Windows High Contrast), where
          // box-shadow is dropped entirely. The style-rules gate enforces this.
          '&:focus-visible': {
            outlineWidth: vars.misc.focusRingWidth,
            outlineStyle: 'solid',
            outlineColor: t.focusRing,
            outlineOffset: vars.misc.focusRingOffset,
          },
          // Base UI's own attributes. Never invent our own state hooks.
          '&[data-invalid]': { borderColor: t.borderInvalid },
          // `default`, not `not-allowed` — Input, Checkbox, Switch and Radio all
          // use `default` for their disabled state, and a control that reads
          // as inert is better than one that flags itself as a barrier.
          '&[data-disabled]': { opacity: 0.6, cursor: 'default' },
        },
      },
    },
  },
  variants: {
    size: {
      sm: { '@layer': { [componentsLayer]: { fontSize: vars.text.sm.size, lineHeight: vars.text.sm.lineHeight } } },
      md: { '@layer': { [componentsLayer]: { fontSize: vars.text.md.size, lineHeight: vars.text.md.lineHeight } } },
      lg: { '@layer': { [componentsLayer]: { fontSize: vars.text.lg.size, lineHeight: vars.text.lg.lineHeight } } },
    },
    resize: {
      none: { '@layer': { [componentsLayer]: { resize: 'none' } } },
      vertical: { '@layer': { [componentsLayer]: { resize: 'vertical' } } },
    },
  },
  defaultVariants: { size: 'md', resize: 'vertical' },
})
