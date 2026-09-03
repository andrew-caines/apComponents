'use client'

import { forwardRef, type Ref } from 'react'
import { Input as BaseInput } from '@base-ui/react/input'
import type { InputProps as BaseInputProps } from '@base-ui/react/input'
import { inputRecipe } from './Input.css.js'

export { INPUT_TOKENS } from './Input.tokens.js'

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
  className?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', className, ...rest },
  ref,
) {
  return (
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
      className={[inputRecipe({ size }), className].filter(Boolean).join(' ')}
    />
  )
})
