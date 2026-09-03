'use client'

import { forwardRef, type CSSProperties, type ReactNode, type Ref } from 'react'
import { Input as BaseInput } from '@base-ui/react/input'
import type { InputProps as BaseInputProps } from '@base-ui/react/input'
import {
  inputRecipe,
  inputWrapper,
  slotButton,
  slotDecorative,
  slotEnd,
  slotInk,
  slotStart,
} from './Input.css.js'
import { INPUT_ICON_COLORS, type InputIconColor } from './Input.tokens.js'

export { INPUT_TOKENS, INPUT_ICON_COLORS } from './Input.tokens.js'
export type { InputIconColor } from './Input.tokens.js'

/**
 * An icon placed inside the control, at the start or end of the inline axis.
 *
 * `start` and `end`, never `left` and `right`: the position is set with
 * `inset-inline-start`/`-end`, so in an RTL locale a `startIcon` renders on the
 * right and the name stays true. A prop called `leftIcon` would be the one
 * physical-direction name in an API whose style gate rejects `padding-left`.
 *
 * The type is a union rather than a flat object, and that is the point:
 *
 * ```tsx
 * endIcon={{ icon: <Copy />, onClick: copy }}   // does not compile
 * ```
 *
 * An adornment with a click handler is a real `<button>`, and a button with no
 * accessible name is unusable by a screen-reader or voice-control user while
 * looking perfect on screen. Requiring `label` in the same shape that
 * introduces `onClick` makes that unreachable rather than merely discouraged —
 * the same move `Field.Error` makes by refusing to expose `render`.
 *
 * Without `onClick` the icon is decorative: `aria-hidden`, and transparent to
 * pointer events so clicking it puts the caret in the field behind it. If you
 * want a *static* icon that assistive technology should announce, give the
 * icon its own name (`<Icon name="info" label="…" />`) rather than reaching
 * for `label` here.
 */
export type InputAdornment =
  | {
      icon: ReactNode
      /**
       * A semantic colour role — `danger`, `success`, `action`… Defaults to
       * `default` (secondary text). Every option is a foreground role the
       * contrast gate covers, so none of them is unreadable.
       */
      color?: InputIconColor
      /** Omit for a decorative icon. Supplying it requires `label`. */
      onClick?: never
      label?: never
    }
  | {
      icon: ReactNode
      /** As above. */
      color?: InputIconColor
      /** Makes the adornment a real `<button type="button">`. */
      onClick: () => void
      /** The button's accessible name. Required — see the note above. */
      label: string
    }

/**
 * `size` is omitted from Base UI's props and redeclared as a recipe variant.
 *
 * `<input>` has a legacy `size` attribute — an integer width in characters,
 * which is a physical-units sizing mechanism the type scale replaces. Keeping
 * both spellings would mean `size="sm"` and `size={20}` on one prop with
 * different meanings and different types. The variant wins the name because it
 * is the one a consumer of this library reaches for.
 *
 * A product that genuinely wants the HTML attribute can set it through
 * `render` — but the attribute alone will not do anything visible here, because
 * `Input.css.ts` sets `inline-size: 100%` in the `ap.components` layer and that
 * overrides the attribute's intrinsic width. Setting it is therefore a
 * two-part job: `render={<input size={20} />}` for the attribute, plus a width
 * of the consumer's own (unlayered CSS always beats a layered rule, so an
 * ordinary `className` is enough) to let it take effect.
 */
export interface InputProps extends Omit<BaseInputProps, 'className' | 'size'> {
  /** Size. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** An icon at the inline start of the control — a currency symbol, a search glyph. */
  startIcon?: InputAdornment
  /** An icon at the inline end — a copy or clear button, a unit suffix. */
  endIcon?: InputAdornment
  className?: string
}

function Adornment({
  adornment,
  side,
  disabled,
}: {
  adornment: InputAdornment
  side: 'start' | 'end'
  disabled: boolean
}) {
  const position = side === 'start' ? slotStart : slotEnd

  // The colour travels as the Tier 3 custom property the slot already reads,
  // rather than as one generated class per role — ADR-0003's rule that static
  // styles stay static and dynamic values flow through custom properties.
  //
  // `--ap-input-icon-hover` is set to the same value on purpose. An icon a
  // product deliberately coloured `danger` should not turn grey-blue under the
  // cursor; the hover feedback is the chip behind it, not a change of hue.
  const tint =
    adornment.color !== undefined && adornment.color !== 'default'
      ? ({
          '--ap-input-icon': INPUT_ICON_COLORS[adornment.color],
          '--ap-input-icon-hover': INPUT_ICON_COLORS[adornment.color],
        } as CSSProperties)
      : undefined

  if (adornment.onClick === undefined) {
    return (
      <span
        className={[position, slotDecorative].join(' ')}
        {...(tint ? { style: tint } : {})}
        aria-hidden="true"
      >
        {adornment.icon}
      </span>
    )
  }

  return (
    <button
      {...(tint ? { style: tint } : {})}
      // `type="button"` is not cosmetic: a bare <button> inside a <form>
      // defaults to type="submit", so a copy or clear affordance would submit
      // the form instead of doing its job — and only when the field happens to
      // sit in a form, which is exactly the case nobody tests.
      type="button"
      className={[position, slotButton].join(' ')}
      onClick={adornment.onClick}
      aria-label={adornment.label}
      // A disabled control's affordances are disabled with it. Leaving the
      // button live would let someone clear or copy a field they cannot edit,
      // and leave a tab stop inside a control that is meant to be inert.
      disabled={disabled}
    >
      <span className={slotInk}>{adornment.icon}</span>
    </button>
  )
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', startIcon, endIcon, className, ...rest },
  ref,
) {
  const control = (
    <BaseInput
      {...rest}
      // Base UI types this ref as `Ref<HTMLElement>` even though the component
      // renders a real `<input>` — `Ref<HTMLInputElement>` is not assignable to
      // it, because a mutable ref is invariant in its element type. The cast is
      // in this one place so that consumers get the accurate `HTMLInputElement`
      // (they need `.value`, `.select()`, `.setSelectionRange()`), rather than
      // every call site having to widen or cast. The ref-forwarding test
      // asserts the runtime tagName is genuinely INPUT.
      ref={ref as Ref<HTMLElement>}
      className={[
        inputRecipe({ size, adornStart: startIcon !== undefined, adornEnd: endIcon !== undefined }),
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )

  // No adornment, no wrapper. An unadorned `Input` renders precisely the markup
  // it rendered before this prop existed — same element, same classes, same
  // parent — so nothing a consumer already styles or queries moved.
  if (startIcon === undefined && endIcon === undefined) return control

  const disabled = rest.disabled === true
  return (
    <span className={inputWrapper}>
      {startIcon ? <Adornment adornment={startIcon} side="start" disabled={disabled} /> : null}
      {control}
      {endIcon ? <Adornment adornment={endIcon} side="end" disabled={disabled} /> : null}
    </span>
  )
})
