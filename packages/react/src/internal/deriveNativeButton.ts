'use client'

/** Static marker on `Button`: `deriveNativeButton` derives through an element whose type carries it. */
export const NATIVE_BUTTON_DERIVABLE: unique symbol = Symbol.for('ap.button.nativeButtonDerivable')

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
 *
 * Shared across every Base UI part with a `render` prop (Button today,
 * Select's parts from Phase 5c on), so the parameter is typed `unknown`
 * rather than any one part's own `render` prop type — each part's narrower
 * type is assignable into `unknown` with no cast at the call site.
 *
 * `Button` is the one composite this helper can see through. It renders a
 * real `<button>` by default, yet its element `type` is a component, so the
 * "any other element" rule above would call it not native and Base UI would
 * log an error for `trigger={<Button>}`. `Button` therefore carries
 * `[NATIVE_BUTTON_DERIVABLE]: true` as a static property (the same protocol
 * as `NON_NATIVE_LABEL`), and for such an element the answer is Button's own:
 * its `nativeButton` prop if set, else derived from its own `render` prop.
 * Every other composite still returns false.
 */
export function deriveNativeButton(render: unknown): boolean {
  if (render === undefined) return true
  if (typeof render === 'function') return false
  const element = render as { type?: unknown; props?: Record<string, unknown> }
  const type = element.type
  if (
    type !== null &&
    (typeof type === 'function' || typeof type === 'object') &&
    (type as Record<PropertyKey, unknown>)[NATIVE_BUTTON_DERIVABLE] === true
  ) {
    const props = element.props ?? {}
    return typeof props.nativeButton === 'boolean'
      ? props.nativeButton
      : deriveNativeButton(props.render)
  }
  return type === 'button'
}
