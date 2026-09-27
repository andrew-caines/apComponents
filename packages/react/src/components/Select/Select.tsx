'use client'

import { Fragment, useCallback, useEffect, useRef, type ReactNode, type Ref } from 'react'
import { NON_NATIVE_LABEL } from '../Field/nonNativeLabel.js'
import { useLocale } from '../../providers/LocaleProvider.js'
import {
  SelectGroup as SelectGroupPart,
  SelectGroupLabel,
  SelectIcon,
  SelectItem as SelectItemPart,
  SelectList,
  SelectPopup,
  SelectRoot,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  type SelectRootProps,
} from './SelectParts.js'
import {
  defaultToStringValue,
  equalBySerialisation,
  findLabel,
  flattenItems,
  formatLabelList,
  isGrouped,
  type SelectItem,
  type SelectItems,
} from './selectItems.js'

export { SELECT_TOKENS } from './Select.tokens.js'
export type { SelectGroup, SelectItem, SelectItems } from './selectItems.js'
export type {
  SelectGroupLabelProps,
  SelectGroupProps,
  SelectIconProps,
  SelectItemProps,
  SelectListProps,
  SelectPopupProps,
  SelectPositionerOptions,
  SelectRootProps,
  SelectSeparatorProps,
  SelectTriggerProps,
  SelectValueProps,
} from './SelectParts.js'

/**
 * `itemToStringValue` is optional for string values and REQUIRED otherwise.
 * Without it, Base UI's fallback serialises an object into the form post,
 * which is never what a server action expects (§4.3.1). The tuple wrapping
 * stops the conditional distributing over a union `Value`.
 */
type Serialisation<Value> = [Value] extends [string]
  ? { itemToStringValue?: (value: Value) => string }
  : { itemToStringValue: (value: Value) => string }

export type SelectProps<Value, Multiple extends boolean | undefined = false> = Omit<
  SelectRootProps<Value, Multiple>,
  'items' | 'itemToStringValue' | 'itemToStringLabel' | 'children'
> &
  Serialisation<Value> & {
    /** A flat list of items, or a list of labelled groups. */
    items: SelectItems<Value>
    /** Shown in the trigger while nothing is selected. Consumer-supplied content. */
    placeholder?: string
    /** Type scale and padding, matching `Input`'s `size`. Defaults to `md`. */
    size?: 'sm' | 'md' | 'lg'
    /** Applied to the trigger. */
    className?: string
    /** Applied to the trigger. `Field`'s protocol sets it; see `Field.tsx`. */
    'aria-labelledby'?: string
    /** Applied to the trigger. */
    'aria-label'?: string
    /** The trigger `<button>`, as `Input`'s ref is its `<input>`. */
    ref?: Ref<HTMLButtonElement>
  }

function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') ref(node)
  else if (ref) ref.current = node
}

/**
 * The convenience assembly of the compound parts, for the common case:
 *
 * ```tsx
 * <Field label={t('country')}>
 *   <Select name="country" placeholder={t('choose')} items={countries} />
 * </Field>
 * ```
 *
 * **`name` goes on `Select`, never also on the wrapping `Field`.** Base UI
 * lets `Field.Root`'s `name` silently override the control's own (a 5b
 * finding), so setting both reads as working while one value is ignored.
 *
 * **Item `label` is a string, not a node.** It is what the trigger shows,
 * what `Intl.ListFormat` joins for a multiple select and what typeahead
 * matches; each needs text, and a node could not be read back out on the
 * server. A product needing rich item markup uses the parts.
 *
 * **Equality defaults to comparing serialised values.** `isItemEqualToValue`
 * defaults to `itemToStringValue(a) === itemToStringValue(b)`, where Base UI's
 * default is `Object.is`. A `defaultValue` rebuilt from server data is a new
 * object carrying the same data; under `Object.is` it matches no item, and
 * the trigger shows nothing selected. A consumer's own `isItemEqualToValue`
 * still wins.
 *
 * The trigger's text is looked up here rather than left to Base UI, which
 * resolves an object value only by a `.value` key or identity and joins
 * multiple labels with a hardcoded comma. Every part used below is public, and
 * `Select.test.tsx` asserts the two produce identical DOM.
 */
function SelectBase<Value, Multiple extends boolean | undefined = false>(
  props: SelectProps<Value, Multiple>,
): ReactNode {
  const {
    items,
    placeholder,
    size = 'md',
    className,
    'aria-labelledby': labelledBy,
    'aria-label': ariaLabel,
    ref,
    itemToStringValue,
    isItemEqualToValue,
    ...rest
  } = props
  const { locale, messages } = useLocale()
  const toString: (value: Value) => string = itemToStringValue ?? defaultToStringValue
  const flat = flattenItems(items)
  const multiple = rest.multiple === true
  const fallback = placeholder ?? null

  // Base UI's `Select.Value` never falls back to `placeholder` when its
  // children is a function (`SelectValue.js`), so the function returns it.
  const renderValue = (value: unknown): ReactNode => {
    if (multiple) {
      const labels = (Array.isArray(value) ? (value as Value[]) : [])
        .map((v) => findLabel(v, flat, toString))
        .filter((label): label is string => label !== undefined)
      return labels.length > 0 ? formatLabelList(labels, locale) : fallback
    }
    return findLabel(value as Value | null, flat, toString) ?? fallback
  }

  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const setTrigger = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node
      assignRef(ref, node)
    },
    [ref],
  )

  // §4.3.2: a `<label for>` naming the button means Field could not see the
  // marker — the Select sits inside a consumer's own component, or inside
  // hand-assembled parts. No dependency list: the label's `for` arrives from
  // Base UI's labelable context a render later. Warns once.
  const warned = useRef(false)
  useEffect(() => {
    if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') return
    const labels = triggerRef.current?.labels
    if (warned.current || !labels || labels.length === 0) return
    warned.current = true
    console.error(
      'Select: a native <label for> points at the trigger button. Field only labels a Select ' +
        'through its non-native-label protocol when the Select is its direct child. Put ' +
        '<Select> directly inside <Field label>, or give Field.Label `nativeLabel={false}` ' +
        'and `render={<div />}` and pass its id to the Select as `aria-labelledby`.',
    )
  })

  const renderItem = (item: SelectItem<Value>) => (
    <SelectItemPart
      key={toString(item.value)}
      value={item.value}
      {...(item.disabled !== undefined ? { disabled: item.disabled } : {})}
    >
      {item.label}
    </SelectItemPart>
  )

  let list: ReactNode
  if (items.length === 0) {
    // One non-selectable row. An empty labelled group rather than a disabled
    // option: an option with no `value` is Base UI's `null` item, which reads
    // as selected whenever nothing is — check glyph and `aria-selected`.
    list = (
      <SelectGroupPart>
        <SelectGroupLabel>{messages.noResults}</SelectGroupLabel>
      </SelectGroupPart>
    )
  } else if (isGrouped(items)) {
    list = items.map((group, index) => (
      <Fragment key={`${index}:${group.label}`}>
        {index > 0 ? <SelectSeparator /> : null}
        <SelectGroupPart>
          <SelectGroupLabel>{group.label}</SelectGroupLabel>
          {group.items.map(renderItem)}
        </SelectGroupPart>
      </Fragment>
    ))
  } else {
    list = items.map(renderItem)
  }

  return (
    <SelectRoot
      {...rest}
      items={items}
      itemToStringValue={toString}
      isItemEqualToValue={isItemEqualToValue ?? equalBySerialisation(toString)}
    >
      <SelectTrigger
        ref={setTrigger}
        size={size}
        {...(className !== undefined ? { className } : {})}
        {...(labelledBy !== undefined ? { 'aria-labelledby': labelledBy } : {})}
        {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
      >
        <SelectValue {...(placeholder !== undefined ? { placeholder } : {})}>
          {renderValue}
        </SelectValue>
        <SelectIcon />
      </SelectTrigger>
      <SelectPopup>
        <SelectList>{list}</SelectList>
      </SelectPopup>
    </SelectRoot>
  )
}

/**
 * `Select` is both the convenience component and the namespace holding its
 * parts, as `Field` and `RadioGroup` are. `[NON_NATIVE_LABEL]` is the static
 * marker `Field` looks for on its direct child (§4.3.2); it is internal and
 * not exported.
 */
export const Select = Object.assign(SelectBase, {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Icon: SelectIcon,
  Popup: SelectPopup,
  List: SelectList,
  Item: SelectItemPart,
  Group: SelectGroupPart,
  GroupLabel: SelectGroupLabel,
  Separator: SelectSeparator,
  [NON_NATIVE_LABEL]: true as const,
})
