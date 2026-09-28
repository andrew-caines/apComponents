'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  type FocusEvent,
  type FocusEventHandler,
  type ReactNode,
  type Ref,
} from 'react'
import { NON_NATIVE_LABEL } from '../Field/nonNativeLabel.js'
import { useLocale } from '../../providers/LocaleProvider.js'
import { selectGroupLabelClass } from './Select.css.js'
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
  'items' | 'itemToStringValue' | 'itemToStringLabel' | 'children' | 'id'
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
    /**
     * The trigger's id; Base UI's root puts it there. Outside a `Field` it is
     * in the server HTML. **Inside a `Field` it is not:** the server renders a
     * generated `base-ui-…` id and the trigger takes this one only after
     * hydration (docs/CONTRIBUTING.md, "Base UI's Field discards a
     * caller-supplied `id` from server markup"). Locate a Select inside a
     * `Field` by its label before hydration, never by this id.
     */
    id?: string
    /**
     * Called when focus enters the trigger from outside the control. Not called
     * when focus returns to the trigger from the popup's listbox on close.
     */
    onFocus?: FocusEventHandler<HTMLButtonElement>
    /**
     * Called when focus leaves the control. Not called when focus moves from
     * the trigger into the popup's listbox on open: Base UI's trigger blur
     * fires then, and a form library would mark the field touched on opening
     * it. Together with `ref`, what react-hook-form's `Controller` expects.
     */
    onBlur?: FocusEventHandler<HTMLButtonElement>
    /** Applied to the trigger only, never to the popup or the hidden input. */
    [data: `data-${string}`]: string | undefined
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
 * **`Select` must render inside a `LocaleProvider`.** It calls `useLocale()`
 * to get the locale a multiple selection's labels are joined with
 * (`Intl.ListFormat`) and the `noResults` message shown for an empty `items`
 * list. `ApProvider` composes `LocaleProvider` already, so the common case
 * needs nothing extra; a `Select` rendered with no `ApProvider`/`LocaleProvider`
 * ancestor at all throws from `useLocale` itself
 * (`providers/LocaleProvider.tsx`), the same requirement `Dialog` has.
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
    id,
    onFocus,
    onBlur,
    ...others
  } = props
  // `data-*` attributes go to the trigger; everything else is the root's.
  // Undefined values are dropped: Base UI's merge would let them win.
  const rest = {} as typeof others
  const dataAttributes: Record<string, string> = {}
  for (const [key, value] of Object.entries(others)) {
    if (!key.startsWith('data-')) (rest as Record<string, unknown>)[key] = value
    else if (typeof value === 'string') dataAttributes[key] = value
  }
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

  // Base UI's own trigger blur skips focus moving into the popup
  // (`trigger/SelectTrigger.mjs`), but merges a consumer's `onBlur` after it,
  // so the consumer's would run on every open. The same test, against the
  // popup element, filters both handlers.
  const popupRef = useRef<HTMLDivElement | null>(null)
  const withinPopup = (event: FocusEvent<HTMLButtonElement>): boolean =>
    popupRef.current?.contains(event.relatedTarget as Node | null) === true
  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    if (!withinPopup(event)) onFocus?.(event)
  }
  const handleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    if (!withinPopup(event)) onBlur?.(event)
  }

  // §4.3.2: a native `<label>` naming the button — by `for`, or by wrapping
  // it — means Field could not see the marker: the Select sits inside a
  // consumer's own component, or inside hand-assembled parts. No dependency
  // list: the label's `for` arrives from Base UI's labelable context a
  // render later. Warns once.
  //
  // A bare `process.env.NODE_ENV`, never guarded by `typeof process`: that
  // is the reference bundlers replace (Vite, webpack, esbuild), and Base UI's
  // own builds spell it the same way (`field/label/FieldLabel.mjs`). Guarded
  // by `typeof process`, the check returned early in every browser bundle,
  // where `process` is undefined, so the warning only ever fired in Node.
  const warned = useRef(false)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const labels = triggerRef.current?.labels
      if (warned.current || !labels || labels.length === 0) return
      warned.current = true
      console.error(
        'Select: a native <label> labels the trigger button, through `for` or by wrapping ' +
          'the Select, and leaks its click and hover behaviour into the button. Field avoids ' +
          'this only when the Select is its direct child. Put <Select> directly inside ' +
          '<Field label>, not inside a <label>, or give Field.Label `nativeLabel={false}` ' +
          'and `render={<div />}` and pass its id to the Select as `aria-labelledby`.',
      )
    }
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
  // `flat`, not `items`: a grouped list whose groups are all empty has
  // entries in `items` but no option to show.
  if (flat.length === 0) {
    // A plain `role="option"`, never `Select.Item` (Task 5's own reasoning
    // still holds: an `<Select.Item>` with no `value` is Base UI's `null`
    // item, which reads as selected whenever nothing else is). Rendering it
    // as a bare `<div>` keeps it out of Base UI's item registry entirely —
    // unreachable by arrow-key navigation, uncounted towards any selection —
    // while still satisfying WAI-ARIA's listbox, which requires at least one
    // `option` (or `group`) descendant with actual `option` content beneath
    // it. A `noResults`-only `Select.Group`/`Select.GroupLabel` (this
    // branch's original shape) is a group with no options in it, which is
    // exactly what that rule forbids — axe only ever scans an OPENED Select
    // (Task 6's `Empty` story, `defaultOpen`), so this was unreachable by any
    // jsdom-based unit test before Storybook could open one for real.
    list = (
      <div role="option" aria-disabled="true" className={selectGroupLabelClass}>
        {messages.noResults}
      </div>
    )
  } else if (isGrouped(items)) {
    // An empty group is skipped, separator and all: a labelled group with no
    // option in it is the same listbox violation as above. Filtering first
    // keeps each separator strictly between two groups that are rendered.
    list = items
      .filter((group) => group.items.length > 0)
      .map((group, index) => (
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
      {...(id !== undefined ? { id } : {})}
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
        {...(onFocus !== undefined ? { onFocus: handleFocus } : {})}
        {...(onBlur !== undefined ? { onBlur: handleBlur } : {})}
        {...dataAttributes}
      >
        <SelectValue {...(placeholder !== undefined ? { placeholder } : {})}>
          {renderValue}
        </SelectValue>
        <SelectIcon />
      </SelectTrigger>
      <SelectPopup ref={popupRef}>
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
