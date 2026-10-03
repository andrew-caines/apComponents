'use client'

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
 */
export function deriveNativeButton(render: unknown): boolean {
  if (render === undefined) return true
  if (typeof render === 'function') return false
  return (render as { type?: unknown }).type === 'button'
}
