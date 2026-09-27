'use client'

import { isValidElement, type ReactNode } from 'react'

/**
 * `Field`'s protocol for labelling a control that must not have a native
 * `<label>` — Select's trigger (a `<button>` wearing `role="combobox"`,
 * Task 5) is the motivating case. A `<button>` is labelable, and Base UI
 * wires a `<label for>` to it correctly; the reason is behavioural (spec
 * §4.3). A native label forwards its clicks to the control it labels, which
 * opens the popup, and puts that control in `:hover` while the label is
 * hovered. Such a control opts in by carrying `[NON_NATIVE_LABEL]: true` as
 * a static property on its function component —
 * `Object.assign(SelectBase, { [NON_NATIVE_LABEL]: true })`, for example —
 * and `Field` (see `Field.tsx`) then labels it with a `<div>` plus
 * `aria-labelledby` instead of a native `<label>`.
 *
 * `Symbol.for`, not `Symbol()`, is deliberate: it is looked up in the GLOBAL
 * symbol registry, so it resolves to the same value even when `@ap/react`
 * ends up duplicated across two separately bundled copies (`npm link`, a
 * monorepo with a hoisting mismatch, two versions in one tree). `Symbol()`
 * would mint a distinct, non-equal symbol per module instance, and the marker
 * this file exists to detect would silently stop matching — the same
 * two-React-copies failure mode `CONTRIBUTING.md` records for `@base-ui/react`
 * leaking an external React out of a nested `node_modules`.
 */
export const NON_NATIVE_LABEL: unique symbol = Symbol.for('ap.field.nonNativeLabel')

/**
 * True only when `children` is a SINGLE valid element whose `type` itself
 * carries `[NON_NATIVE_LABEL]: true`.
 *
 * - Wrapped children (`<div><Fake /></div>`) return false: `type` is `'div'`,
 *   which carries no such property.
 * - Fragment children (`<>…</>`, or an array of elements) return false: an
 *   array is never a single `isValidElement` value, and a lone `<>…</>` has
 *   `type` set to React's Fragment symbol, which likewise carries no marker.
 * - Multiple children, `null`, `undefined`, text and other non-element
 *   `ReactNode`s all fail the `isValidElement` check up front.
 */
export function usesNonNativeLabel(children: ReactNode): boolean {
  if (!isValidElement(children)) return false
  const type: unknown = children.type
  return (
    (typeof type === 'function' || typeof type === 'object') &&
    type !== null &&
    (type as Record<PropertyKey, unknown>)[NON_NATIVE_LABEL] === true
  )
}
