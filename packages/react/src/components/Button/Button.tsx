'use client'

import { forwardRef } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import type { Button as BaseButtonNamespace } from '@base-ui/react/button'
import { buttonRecipe } from './Button.css.js'

export { BUTTON_TOKENS } from './Button.tokens.js'

type BaseButtonProps = BaseButtonNamespace.Props

export interface ButtonProps extends Omit<BaseButtonProps, 'className'> {
  /** Colour treatment. Defaults to `solid`. */
  variant?: 'solid' | 'outline' | 'ghost'
  /** Size. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** Colour role. Defaults to `action`. */
  tone?: 'action' | 'danger'
  className?: string
}

/**
 * Base UI's `nativeButton` prop (default `true`) tells its internal
 * `useButton` hook whether the element it renders is a real `<button>`. That
 * flag drives ARIA and keyboard behaviour, not markup: a native button gets
 * `type="button"` from Base UI, anything else gets `role="button"`. Leaving
 * the default `true` while `render` swaps in an `<a href>` (or a router's
 * `<Link>`) tells Base UI an anchor is a button — wrong semantics, wrong
 * keyboard handling — even though the DOM tag is correct either way.
 *
 * Consumers of `<Button>` must never have to know `nativeButton` exists, so
 * it is derived from `render` rather than asked for:
 *
 *  - `render` absent -> this component renders a real `<button>` -> true.
 *  - `render` is an element whose `type` is the literal string `'button'`
 *    -> still a real button under a different JSX spelling -> true.
 *  - `render` is any other element (`<a>`, `<div>`, a custom component's
 *    element) -> not a button -> false.
 *  - `render` is a function -> we cannot inspect what it will return before
 *    it runs, and treating a would-be anchor as a native button is worse
 *    than treating a would-be button as a generic non-native element, so
 *    this defaults to false.
 *
 * Do not delete this reasoning as "obviously true from the code": the whole
 * point is that `nativeButton` looks redundant with `render` until the
 * anchor case is spelled out.
 */
function deriveNativeButton(render: ButtonProps['render']): boolean {
  if (render === undefined) return true
  if (typeof render === 'function') return false
  return render.type === 'button'
}

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button(
  { variant = 'solid', size = 'md', tone = 'action', className, render, nativeButton, ...rest },
  ref,
) {
  return (
    <BaseButton
      {...rest}
      ref={ref}
      render={render}
      nativeButton={nativeButton ?? deriveNativeButton(render)}
      className={[buttonRecipe({ variant, size, tone }), className].filter(Boolean).join(' ')}
    />
  )
})
