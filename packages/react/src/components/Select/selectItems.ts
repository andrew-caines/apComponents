'use client'

/**
 * The convenience `<Select>` (Task 5) accepts either a flat list of options
 * or a list of groups. Every helper below operates on that union so the
 * component never has to branch on shape more than once.
 *
 * Named `SelectOption`, not `SelectItem`, to match `RadioGroupOption` and to
 * keep the data shape apart from the `Select.Item` part (`SelectItemProps`).
 */
export interface SelectOption<Value> {
  value: Value
  label: string
  disabled?: boolean
}

export interface SelectOptionGroup<Value> {
  label: string
  options: ReadonlyArray<SelectOption<Value>>
}

export type SelectOptions<Value> =
  | ReadonlyArray<SelectOption<Value>>
  | ReadonlyArray<SelectOptionGroup<Value>>

/**
 * A `SelectOptionGroup` is told apart from a `SelectOption` by the presence
 * of an `options` array — `SelectOption` never has one. An empty list is
 * treated as ungrouped: there is nothing in it to prove otherwise, and
 * `flattenItems` returns `[]` for it either way.
 */
export function isGrouped<Value>(
  items: SelectOptions<Value>,
): items is ReadonlyArray<SelectOptionGroup<Value>> {
  return items.length > 0 && 'options' in items[0]!
}

/**
 * Reduces `items` to a single flat list, in source order, for typeahead,
 * label lookup (`findLabel`) and any other consumer that does not care about
 * grouping.
 */
export function flattenItems<Value>(
  items: SelectOptions<Value>,
): ReadonlyArray<SelectOption<Value>> {
  if (!isGrouped(items)) return items
  return items.flatMap((group) => group.options)
}

/**
 * The default `itemToStringValue`. Values are strings in the common case,
 * and pass through unchanged. A non-string value only reaches this function
 * when a consumer used an object `Value` without supplying their own
 * `itemToStringValue` — the type system requires that prop for non-string
 * values (Task 5), so this `as`-cast escape hatch throws instead of silently
 * stringifying with `[object Object]` or similar.
 */
export function defaultToStringValue(value: unknown): string {
  if (typeof value === 'string') return value
  throw new Error(
    'Select: a non-string item value requires an `itemToStringValue` prop to serialise it ' +
      'for comparison and label lookup.',
  )
}

/**
 * Base UI's `isItemEqualToValue` compares two `Value`s and, by default, uses
 * `===` — which fails the moment a `Value` is an object rebuilt on every
 * render (a fresh `{ code: 'ca', name: 'California' }` literal each time,
 * rather than a stored reference). Comparing by serialisation instead means
 * two values are equal exactly when their `toString` output matches,
 * independent of object identity.
 */
export function equalBySerialisation<Value>(
  toString: (value: Value) => string,
): (a: Value, b: Value) => boolean {
  return (a, b) => toString(a) === toString(b)
}

/**
 * Looks up the label for `value` in `flat` by serialised equality, the same
 * comparison `equalBySerialisation` gives Base UI. This exists because Base
 * UI's own label resolution (`resolveSelectedLabel`) matches an object value
 * only by a `.value` key or identity — a rebuilt `defaultValue` object with
 * neither renders as raw JSON in the trigger (see global-constraints.md).
 * The convenience `<Select>` never relies on Base UI's resolution; it always
 * looks the label up itself with this function.
 */
export function findLabel<Value>(
  value: Value | null | undefined,
  flat: ReadonlyArray<SelectOption<Value>>,
  toString: (value: Value) => string,
): string | undefined {
  if (value === null || value === undefined) return undefined
  const serialised = toString(value)
  return flat.find((item) => toString(item.value) === serialised)?.label
}

/**
 * Formats a multi-select's chosen labels as a locale-correct conjunction
 * list ("Red, Green, and Blue" in `en-US`; "Rot, Grün und Blau" in `de-DE`).
 * Base UI's own multi-value label joins with a hardcoded `', '`
 * (`resolveValueLabel.js`), which is exactly the English-only shortcut this
 * replaces.
 */
export function formatLabelList(labels: ReadonlyArray<string>, locale: string): string {
  if (labels.length === 0) return ''
  return new Intl.ListFormat(locale, { type: 'conjunction', style: 'long' }).format(labels)
}
