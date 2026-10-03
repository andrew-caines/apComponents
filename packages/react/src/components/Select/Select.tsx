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
  type SelectOption,
  type SelectOptions,
} from './selectItems.js'

export { SELECT_TOKENS } from './Select.tokens.js'
export type { SelectOption, SelectOptionGroup, SelectOptions } from './selectItems.js'
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
    /** A flat list of options, or a list of labelled groups. */
    options: SelectOptions<Value>
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
     * The trigger's id, in server HTML and after hydration, inside a `Field`
     * or not. It goes to `Select.Trigger`, which renders it directly and
     * registers it with the `Field`. Given to `Select.Root` instead, a Select
     * inside a `Field` keeps a generated `base-ui-…` id for good: the trigger
     * registers the provider's generated id before the root registers the
     * caller's, and Base UI's `LabelableProvider` keeps the id it has.
     */
    id?: string
    /**
     * Called when focus enters the control — the trigger or its open popup —
     * from outside it. Not called when focus moves between the two, as it
     * does on open and close. The event's target is the element focused,
     * usually the trigger.
     */
    onFocus?: FocusEventHandler<HTMLElement>
    /**
     * Called when focus leaves the control: from the trigger, or from inside
     * the open popup (Tab out of the list, a press on another control). Not
     * called when focus moves from the trigger into the popup on open: Base
     * UI's trigger blur fires then, and a form library would mark the field
     * touched on opening it. Together with `ref`, what react-hook-form's
     * `Controller` expects. The target is the element losing focus, which
     * may be inside the popup.
     */
    onBlur?: FocusEventHandler<HTMLElement>
    /**
     * Applied to the trigger only, never to the popup or the hidden input.
     * Non-string values are dropped.
     */
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
 *   <Select name="country" placeholder={t('choose')} options={countries} />
 * </Field>
 * ```
 *
 * **`name` goes on `Select`, never also on the wrapping `Field`.** Base UI
 * lets `Field.Root`'s `name` silently override the control's own (a 5b
 * finding), so setting both reads as working while one value is ignored.
 *
 * **`Select` must render inside a `LocaleProvider`.** It calls `useLocale()`
 * to get the locale a multiple selection's labels are joined with
 * (`Intl.ListFormat`) and the `noResults` message shown for an empty `options`
 * list. `ApProvider` composes `LocaleProvider` already, so the common case
 * needs nothing extra; a `Select` rendered with no `ApProvider`/`LocaleProvider`
 * ancestor at all throws from `useLocale` itself
 * (`providers/LocaleProvider.tsx`), the same requirement `Dialog` has.
 *
 * **Option `label` is a string, not a node.** It is what the trigger shows,
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
    options,
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
  const flat = flattenItems(options)
  const multiple = rest.multiple === true
  const fallback = placeholder ?? null

  // Base UI's `Select.Value` never falls back to `placeholder` when its
  // children is a function (`SelectValue.js`), so the function returns it.
  //
  // A value matching no option shows as its serialised self, never as the
  // placeholder: it still posts, and Base UI counts it as selected, so a
  // placeholder there would read as "nothing chosen" in body-text colour
  // while the form submits something.
  const labelOf = (value: Value): string => findLabel(value, flat, toString) ?? toString(value)
  const renderValue = (value: unknown): ReactNode => {
    if (multiple) {
      const values = Array.isArray(value) ? (value as Value[]) : []
      return values.length > 0 ? formatLabelList(values.map(labelOf), locale) : fallback
    }
    return value === null || value === undefined ? fallback : labelOf(value as Value)
  }

  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const setTrigger = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node
      assignRef(ref, node)
    },
    [ref],
  )

  // Focus-within across the trigger and the positioner (which holds the
  // popup and Base UI's focus guards): `onFocus` fires when focus enters the
  // control from outside, `onBlur` when it leaves both elements. Base UI's
  // trigger blur fires as focus moves into the popup, and Base UI merges a
  // consumer's handler after its own, so an unfiltered `onBlur` would run on
  // every open and miss every exit made from inside the popup. React focus
  // events bubble through the portal, so the positioner's handlers see
  // blurs from items and guards alike.
  //
  // A `null` `relatedTarget` is outside for a blur from the trigger (a press
  // on empty page space). From inside the popup it is not an exit: in
  // Chromium, a press on non-focusable space outside the open popup blurs
  // the item with `null`, then Base UI's outside-press close returns focus
  // to the trigger (`FloatingFocusManager`'s return focus), and that pair is
  // one uninterrupted stay in the control. `focusWithin` stays true, so the
  // return is not a new entry either — as when the popup unmounts under focus.
  const positionerRef = useRef<HTMLDivElement | null>(null)
  const focusWithin = useRef(false)
  const withinControl = (target: EventTarget | null): boolean => {
    const node = target as Node | null
    if (node === null) return false
    return (
      triggerRef.current?.contains(node) === true || positionerRef.current?.contains(node) === true
    )
  }
  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    // A `relatedTarget` inside is a move within the control, even with
    // `focusWithin` false: a focus guard moves focus on out from its own
    // focus handler, so its blur reaches here before its focus finishes
    // bubbling to the positioner.
    if (focusWithin.current || withinControl(event.relatedTarget)) return
    focusWithin.current = true
    onFocus?.(event)
  }
  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!focusWithin.current || withinControl(event.relatedTarget)) return
    focusWithin.current = false
    onBlur?.(event)
  }
  const handlePopupBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.relatedTarget !== null) handleBlur(event)
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

  const renderItem = (item: SelectOption<Value>) => (
    <SelectItemPart
      key={toString(item.value)}
      value={item.value}
      {...(item.disabled !== undefined ? { disabled: item.disabled } : {})}
    >
      {item.label}
    </SelectItemPart>
  )

  let list: ReactNode
  // `flat`, not `options`: a grouped list whose groups are all empty has
  // entries in `options` but no option to show.
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
  } else if (isGrouped(options)) {
    // An empty group is skipped, separator and all: a labelled group with no
    // option in it is the same listbox violation as above. Filtering first
    // keeps each separator strictly between two groups that are rendered.
    list = options
      .filter((group) => group.options.length > 0)
      .map((group, index) => (
        <Fragment key={`${index}:${group.label}`}>
          {index > 0 ? <SelectSeparator /> : null}
          <SelectGroupPart>
            <SelectGroupLabel>{group.label}</SelectGroupLabel>
            {group.options.map(renderItem)}
          </SelectGroupPart>
        </Fragment>
      ))
  } else {
    list = options.map(renderItem)
  }

  return (
    <SelectRoot
      {...rest}
      // Flat, whatever shape `options` has: Base UI reads `items` only to
      // resolve labels, which `renderValue` does itself, and a flat list
      // keeps Base UI from needing to know our group shape.
      items={flat}
      itemToStringValue={toString}
      isItemEqualToValue={isItemEqualToValue ?? equalBySerialisation(toString)}
    >
      <SelectTrigger
        ref={setTrigger}
        {...(id !== undefined ? { id } : {})}
        size={size}
        {...(className !== undefined ? { className } : {})}
        {...(labelledBy !== undefined ? { 'aria-labelledby': labelledBy } : {})}
        {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...dataAttributes}
      >
        <SelectValue {...(placeholder !== undefined ? { placeholder } : {})}>
          {renderValue}
        </SelectValue>
        <SelectIcon />
      </SelectTrigger>
      <SelectPopup
        positioner={{ ref: positionerRef, onFocus: handleFocus, onBlur: handlePopupBlur }}
      >
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
