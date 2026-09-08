import { style } from '@vanilla-extract/css'
import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { RADIO_GROUP_TOKENS as t } from './RadioGroup.tokens.js'

/**
 * The control's diameter per size, from the icon scale rather than the space
 * scale: a radio reads as an icon-sized control, not a text-sized one — the
 * same choice `Checkbox.css.ts` makes for its box, so the two line up when a
 * form mixes them.
 *
 * Declared once here because TWO rules need it: the control itself, and the
 * hint's indent (which is `control + gap`, so the hint's text starts under the
 * option's text). If the hint repeated the scale independently, a change to
 * the control's size would silently leave every hint mis-indented.
 */
const CONTROL = {
  sm: vars.icon.sm,
  md: vars.icon.md,
  lg: vars.icon.lg,
} as const

/**
 * The outer `<fieldset>` from `Fieldset.Root`.
 *
 * The three resets are UA-stylesheet removals, not decoration: every browser
 * gives `fieldset` a groove border, asymmetric block padding and an inline
 * margin, plus `min-inline-size: min-content` — the last of which stops the
 * element shrinking below its widest option, so an unreset fieldset overflows
 * a narrow column instead of wrapping inside it.
 */
export const radioGroupFieldsetClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: t.gap,
      margin: 0,
      padding: 0,
      borderStyle: 'none',
      minInlineSize: 0,
      fontFamily: vars.font.body,
    },
  },
})

/**
 * The group's label, from `Fieldset.Legend`.
 *
 * That part renders a `<div>`, not a `<legend>` (verified in
 * `fieldset/legend/FieldsetLegend.js`, which calls `useRenderElement('div',
 * …)`), so none of the UA's legend quirks — the notch cut into the border, the
 * inline padding, the special placement inside the fieldset's box — apply here
 * and none of them need resetting. It is an ordinary flex item.
 */
export const radioGroupLegendClass = style({
  '@layer': {
    [componentsLayer]: {
      color: t.legendText,
      fontSize: t.legendSize,
      lineHeight: t.legendLineHeight,
      fontWeight: 500,
    },
  },
})

/** The `<div role="radiogroup">` from Base UI's own `RadioGroup`. */
export const radioGroupListClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      flexDirection: 'column',
      gap: t.optionListGap,
    },
  },
})

/** One option's wrapper — the `Field.Item` div, holding the row and its hint. */
export const radioGroupItemClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      flexDirection: 'column',
      gap: t.hintGap,
    },
  },
})

/**
 * The clickable row: the `<label>` wrapping the control and the option's text.
 *
 * `align-items: flex-start`, not `center`: an option whose text wraps to two
 * lines should keep its control beside the FIRST line rather than floating it
 * against the middle of the block — the same reasoning as `fieldErrorClass`.
 *
 * No `cursor` here, deliberately. `Checkbox` and `Switch` put the pointer on
 * the CONTROL only and leave their wrapping `<label>` alone, and this follows
 * them: the control is the element that also flips to `cursor: default` under
 * `[data-disabled]`, and a pointer declared on the label would sit over a
 * disabled option's text contradicting it. The label has no state attribute of
 * its own to key an override on.
 */
export const radioGroupOptionClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: t.optionGap,
    },
  },
})

/** The option's own text, inside the `<label>` and beside the control. */
export const radioGroupOptionTextClass = style({
  '@layer': {
    [componentsLayer]: {
      color: t.optionText,
      fontSize: t.optionSize,
      lineHeight: t.optionLineHeight,
    },
  },
})

/**
 * The control: `Radio.Root`, a `<span role="radio">`.
 *
 * The UNSELECTED look is styled here, on the base rule, rather than as a rule
 * on the indicator's unselected state — `Radio.Indicator` returns `null`
 * whenever it is neither `keepMounted` nor mounted
 * (`radio/indicator/RadioIndicator.js`: `if (!shouldRender) { return null }`),
 * so a selector targeting an unselected indicator could never match anything.
 * Same shape, and the same reason, as `Checkbox.css.ts`.
 *
 * The SELECTED look is a dot appearing inside the circle alongside a border
 * colour change, never a colour change alone (ADR-0011 §5): the dot is a
 * shape, so the state survives greyscale and forced-colors rendering.
 */
export const radioRecipe = recipe({
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
          // Longhand, matching Input/Textarea/Checkbox/Switch: `outline`,
          // never `boxShadow` — an outline survives forced-colors mode
          // (Windows High Contrast), where box-shadow is dropped entirely.
          // The style-rules gate enforces this.
          '&:focus-visible': {
            outlineWidth: vars.misc.focusRingWidth,
            outlineStyle: 'solid',
            outlineColor: t.focusRing,
            outlineOffset: vars.misc.focusRingOffset,
          },
          // Base UI's own state attributes (radio/utils/stateAttributesMapping
          // and RadioRootDataAttributes) — never an attribute of our own
          // invention.
          '&[data-checked]': {
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
    size: {
      sm: {
        '@layer': {
          [componentsLayer]: { inlineSize: CONTROL.sm, blockSize: CONTROL.sm },
        },
      },
      md: {
        '@layer': {
          [componentsLayer]: { inlineSize: CONTROL.md, blockSize: CONTROL.md },
        },
      },
      lg: {
        '@layer': {
          [componentsLayer]: { inlineSize: CONTROL.lg, blockSize: CONTROL.lg },
        },
      },
    },
  },
  defaultVariants: { size: 'md' },
})

/**
 * The selected dot: `Radio.Indicator`, centred by the control's own flex
 * alignment. Sized as a percentage of the control rather than per size, so it
 * scales with whichever `size` variant is on the root with no second scale to
 * keep in step.
 */
export const radioIndicatorClass = style({
  '@layer': {
    [componentsLayer]: {
      inlineSize: '50%',
      blockSize: '50%',
      borderRadius: t.radius,
      background: t.dot,
    },
  },
})

/**
 * An option's hint: `Field.Description`, below the row.
 *
 * Indented by `control + gap` so its first character lines up under the
 * option's text instead of under the control. That is why this is a recipe
 * rather than a plain style: the indent is derived from the control's own
 * per-size diameter (see `CONTROL` above), so it cannot drift out of step with
 * the control the way an independently written value would.
 */
export const radioGroupHintRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        margin: 0,
        color: t.hintText,
        fontSize: t.hintSize,
        lineHeight: t.hintLineHeight,
      },
    },
  },
  variants: {
    size: {
      sm: {
        '@layer': {
          [componentsLayer]: {
            paddingInlineStart: `calc(${CONTROL.sm} + ${t.optionGap})`,
          },
        },
      },
      md: {
        '@layer': {
          [componentsLayer]: {
            paddingInlineStart: `calc(${CONTROL.md} + ${t.optionGap})`,
          },
        },
      },
      lg: {
        '@layer': {
          [componentsLayer]: {
            paddingInlineStart: `calc(${CONTROL.lg} + ${t.optionGap})`,
          },
        },
      },
    },
  },
  defaultVariants: { size: 'md' },
})
