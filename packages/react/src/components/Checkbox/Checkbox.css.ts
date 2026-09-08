import { style } from '@vanilla-extract/css'
import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { CHECKBOX_TOKENS as t } from './Checkbox.tokens.js'

/**
 * The clickable row: the `<label>` wrapping the box and the label text, and
 * the element this component renders at its root.
 *
 * Without this rule the row was a bare `<label>`: an `inline-flex` box abutting
 * its own text with no gap at all, baseline-aligned, and the text at whatever
 * size it inherited — beside `Field` labels at `text.sm` in the same form.
 *
 * `align-items: flex-start`, not `center`: a label that wraps to two lines
 * should keep its box beside the FIRST line rather than floating it against
 * the middle of the block. Same choice, same reason, as
 * `radioGroupOptionClass` and `fieldErrorClass`.
 *
 * No `cursor` here, deliberately — the pointer lives on the CONTROL, which is
 * also the element that flips to `cursor: default` under `[data-disabled]`. A
 * pointer declared on the label would sit over a disabled control's text
 * contradicting it, and the label carries no state attribute of its own to key
 * an override on. `RadioGroup.css.ts` records the same decision.
 */
export const checkboxLabelClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: t.labelGap,
      fontFamily: vars.font.body,
    },
  },
})

/** The label's own text, inside the `<label>` and beside the box. */
export const checkboxLabelTextClass = style({
  '@layer': {
    [componentsLayer]: {
      color: t.labelText,
      fontSize: t.labelSize,
      lineHeight: t.labelLineHeight,
    },
  },
})

/**
 * The box itself: `Checkbox.Root`, a `<span role="checkbox">`.
 *
 * The UNCHECKED look is styled here, on the base rule, rather than as a
 * `:not([data-checked])` rule on the indicator — `Checkbox.Indicator`
 * unmounts entirely when the box is unchecked (no `keepMounted`), so a
 * selector targeting its unchecked state could never match anything.
 */
export const checkboxRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        display: 'inline-flex',
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        background: t.bg,
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: t.border,
        borderRadius: t.radius,
        cursor: 'pointer',
        selectors: {
          '&:hover:not([data-disabled])': {
            borderColor: t.borderHover,
          },
          // Longhand, matching Input.css.ts/Textarea.css.ts: `outline`, never
          // `boxShadow` — an outline survives forced-colors mode (Windows
          // High Contrast), where box-shadow is dropped entirely. The
          // style-rules gate enforces this.
          '&:focus-visible': {
            outlineWidth: vars.misc.focusRingWidth,
            outlineStyle: 'solid',
            outlineColor: t.focusRing,
            outlineOffset: vars.misc.focusRingOffset,
          },
          // Base UI's own state attributes (getCheckboxStateAttributesMapping /
          // getStateAttributesProps) — never an attribute of our own invention.
          '&[data-checked]': {
            background: t.bgChecked,
            borderColor: t.borderChecked,
          },
          '&[data-indeterminate]': {
            background: t.bgChecked,
            borderColor: t.borderChecked,
          },
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
    // The box is a fixed square driven off the icon scale — a checkbox reads
    // as an icon-sized control, not a text-sized one, so it borrows
    // `vars.icon` rather than `vars.space`.
    size: {
      sm: {
        '@layer': {
          [componentsLayer]: { inlineSize: vars.icon.sm, blockSize: vars.icon.sm },
        },
      },
      md: {
        '@layer': {
          [componentsLayer]: { inlineSize: vars.icon.md, blockSize: vars.icon.md },
        },
      },
      lg: {
        '@layer': {
          [componentsLayer]: { inlineSize: vars.icon.lg, blockSize: vars.icon.lg },
        },
      },
    },
  },
  defaultVariants: { size: 'md' },
})

/**
 * The indicator wrapper (`Checkbox.Indicator`) — centres whichever glyph it
 * holds (the check icon, or the indeterminate bar) inside the box.
 */
export const checkboxIndicator = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      inlineSize: '100%',
      blockSize: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      color: t.glyph,
    },
  },
})

/**
 * The indeterminate glyph: a CSS bar, not an icon.
 *
 * Chosen over adding a `minus` entry to `icons/paths.ts` because that route
 * would touch the icon registry AND the hardcoded name list
 * `Icon.test.tsx` asserts against — both outside this component's file set,
 * and the icon route buys nothing a plain shape can't already say. A bar
 * reads as a distinct GLYPH from the check mark (not just a different
 * colour), which is what ADR-0011 §5 requires: the mixed state must be
 * visible without relying on colour alone.
 */
export const checkboxIndeterminateBar = style({
  '@layer': {
    [componentsLayer]: {
      inlineSize: '60%',
      blockSize: '2px',
      borderRadius: vars.radius.full,
      background: 'currentColor',
    },
  },
})
