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

/**
 * Base UI's `useButton` (internals/use-button/useButton.mjs) forces
 * `role="button"` whenever `nativeButton` is false — unconditionally, with
 * no prop to opt out at the API level (`Button.mjs` reads no `role` prop of
 * its own). It also forces `tabIndex={0}` via `useFocusableWhenDisabled`
 * whenever the element isn't a composite item, again unconditionally.
 *
 * That is correct for Base UI's model (a Button that happens to render as a
 * different tag is still semantically a button), and wrong for a `render`
 * element that is already a real link: an `<a href>` already has an
 * implicit `role="link"` and is already focusable, so both forced
 * attributes are not just wrong but redundant.
 *
 * Base UI's own props merge (`merge-props/mergeProps.mjs`) resolves
 * conflicts with `Object.assign` semantics — rightmost object wins — using
 * `for...in`, which visits a key even when its value is `undefined`, as
 * long as the key is explicitly present. `useFocusableWhenDisabled.mjs`
 * relies on exactly this ("we can't explicitly assign `undefined` to any of
 * these props because it would otherwise prevent subsequently merged props
 * from setting them") to justify never emitting `undefined` itself — which
 * is the confirmation that a caller doing so is the supported way to win a
 * merge. Passing `role={undefined}` / `tabIndex={undefined}` alongside
 * `nativeButton={false}` on `<BaseButton>` lands in `otherExternalProps`,
 * the last (rightmost) argument to the `mergeProps` call inside
 * `getButtonProps`, so it overrides both forced values before Base UI's
 * `useRenderElement` ever merges in the `render` element's own props.
 * Verified directly against `@base-ui/react/button`: with `nativeButton`
 * false, `role={undefined}` and `tabIndex={undefined}` produce a plain
 * `<a href="/x">`, no `role` or `tabindex` attribute at all — including
 * through an opaque wrapping component (e.g. a router `Link`) that forwards
 * unknown props to its own rendered `<a>`.
 *
 * What this cannot do: decide *whether* to apply the override for a
 * `render` element whose tag is not visible to us ahead of render. A
 * literal `<a href="…" />` tells us its tag and its `href` synchronously,
 * so detecting it is exact and risk-free. A custom component such as
 * `<Link to="…" />` does not — its `to` prop says nothing about what tag it
 * will render, and finding out would mean either invoking it outside
 * React's render cycle (unsafe: it may use hooks) or inspecting the
 * committed DOM node after the fact (which would leave incorrect
 * server-rendered markup until hydration runs, undermining exactly the
 * progressive-enhancement case ADR-0011 §4 exists for). So only the literal
 * anchor case is auto-detected. A `<Link>` (or any other component) that
 * renders to an anchor gets the same fix by adding the override on the
 * `render` element itself — `<Button render={<Link to="/x" role={undefined}
 * tabIndex={undefined} />}>` — which works for the same reason: that
 * element's own props are the rightmost argument to the final
 * `mergeProps(props, render.props)` Base UI runs in `useRenderElement.mjs`
 * before cloning it.
 */
function isAnchorWithHref(render: ButtonProps['render']): boolean {
  if (render === undefined || typeof render === 'function') return false
  if (render.type !== 'a') return false
  const href: unknown = (render.props as { href?: unknown }).href
  return typeof href === 'string' && href.length > 0
}

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button(
  { variant = 'solid', size = 'md', tone = 'action', className, render, nativeButton, ...rest },
  ref,
) {
  const isNative = nativeButton ?? deriveNativeButton(render)
  const isLinkElement = !isNative && isAnchorWithHref(render)
  return (
    <BaseButton
      {...rest}
      {...(isLinkElement ? { role: undefined, tabIndex: undefined } : null)}
      ref={ref}
      render={render}
      nativeButton={isNative}
      className={[buttonRecipe({ variant, size, tone }), className].filter(Boolean).join(' ')}
    />
  )
})
