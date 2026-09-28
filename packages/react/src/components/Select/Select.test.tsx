// @vitest-environment jsdom
import { createRef, type ReactElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Field } from '../Field/Field.js'
import { LocaleProvider } from '../../providers/LocaleProvider.js'
import { DEFAULT_MESSAGES } from '../../providers/messages.js'
import { Select } from './Select.js'
import { selectSeparatorClass, selectTriggerRecipe } from './Select.css.js'
import { equalBySerialisation, findLabel, flattenItems, type SelectItems } from './selectItems.js'

const renderIn = (ui: ReactElement, locale?: string) =>
  render(<LocaleProvider {...(locale !== undefined ? { locale } : {})}>{ui}</LocaleProvider>)

const COUNTRIES = [
  { value: 'ca', label: 'Canada' },
  { value: 'fr', label: 'France' },
]

interface Country {
  code: string
  name: string
}
const OBJECT_ITEMS = [
  { value: { code: 'ca', name: 'Canada' }, label: 'Canada' },
  { value: { code: 'fr', name: 'France' }, label: 'France' },
]
const byCode = (c: Country) => c.code

/** As in Field.test.tsx: generated ids differ between renders, nothing else may. */
function normaliseIds(html: string): string {
  return html
    .replace(/\bid="[^"]*"/g, 'id="ID"')
    .replace(/\bfor="[^"]*"/g, 'for="ID"')
    .replace(/\baria-controls="[^"]*"/g, 'aria-controls="ID"')
    .replace(/\baria-owns="[^"]*"/g, 'aria-owns="ID"')
    .replace(/\baria-describedby="[^"]*"/g, 'aria-describedby="ID"')
    .replace(/\baria-labelledby="[^"]*"/g, 'aria-labelledby="ID"')
}

const WARNING = /Select.*Field/s

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Select (convenience)', () => {
  // Type tests. Each `@ts-expect-error` below is an assertion that
  // `npm run typecheck` enforces: if the line ever stops erroring — because
  // `Serialisation<Value>` loosens, because `Object.assign` erases the
  // generic, or because Base UI widens `defaultValue` — the directive becomes
  // an unused suppression and typecheck fails on THIS line. Same mechanism
  // as Switch.test.tsx and Input.test.tsx.
  it('requires itemToStringValue for object values, at compile time', () => {
    // Created, never rendered: at runtime `defaultToStringValue` throws for
    // an object, which is the escape hatch behind this type error.
    const unserialisable = (
      // @ts-expect-error an object Value has no default serialisation, so itemToStringValue is required
      <Select items={[{ value: { id: 1 }, label: 'A' }]} aria-label="No serialiser" />
    )
    expect(unserialisable).toBeTruthy()
    renderIn(
      <Select
        items={[{ value: { id: 1 }, label: 'A' }]}
        itemToStringValue={(v) => String(v.id)}
        aria-label="Serialised"
      />,
    )
    expect(screen.getByRole('combobox', { name: 'Serialised' })).toBeTruthy()
  })

  it('requires an array defaultValue when multiple, at compile time', () => {
    renderIn(
      <Select
        multiple
        // @ts-expect-error `multiple` makes defaultValue an array of Value
        defaultValue="a"
        items={[{ value: 'a', label: 'A' }]}
      />,
    )
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  it('keeps its parts on the namespace after Object.assign', () => {
    // A compile-time check as much as a runtime one: if Object.assign lost
    // the second argument's type, `Select.Root` would not typecheck.
    expect(Select.Root).toBeTypeOf('function')
    expect(Select.Item).toBeTruthy()
  })

  // §4.3.2. Fails if `[NON_NATIVE_LABEL]` is dropped from the namespace:
  // Field then renders a native `<label for>`, whose tag is LABEL.
  it('is labelled by a div label through Field', () => {
    renderIn(
      <Field label="Country">
        <Select items={COUNTRIES} />
      </Field>,
    )
    expect(screen.getByText('Country').tagName).toBe('DIV')
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeTruthy()
  })

  // A `defaultValue` rebuilt from server data is a new object. Fails on the
  // label if the trigger falls back to Base UI's resolution (JSON), and on
  // the selected state if the `isItemEqualToValue` default is dropped.
  it('matches a rebuilt object defaultValue by serialisation', async () => {
    renderIn(
      <Select
        aria-label="Country"
        items={OBJECT_ITEMS}
        itemToStringValue={byCode}
        defaultValue={{ code: 'fr', name: 'France' }}
      />,
    )
    const trigger = screen.getByRole('combobox', { name: 'Country' })
    expect(trigger.textContent).toBe('France')
    fireEvent.click(trigger)
    const selected = await waitFor(() => {
      const el = document.querySelector('[role="option"][aria-selected="true"]')
      expect(el).not.toBeNull()
      return el!
    })
    expect(selected.textContent).toBe('France')
  })

  // Review Focus 4. Base UI's children-function branch never falls back to
  // `placeholder` (SelectValue.js), so the function returns it. Fails if the
  // function returns `null` for an unmatched value.
  it('shows the placeholder for an object defaultValue matching no item', () => {
    renderIn(
      <Select
        aria-label="Country"
        placeholder="Choose a country"
        items={OBJECT_ITEMS}
        itemToStringValue={byCode}
        defaultValue={{ code: 'de', name: 'Germany' }}
      />,
    )
    expect(screen.getByRole('combobox', { name: 'Country' }).textContent).toBe('Choose a country')
  })

  it('shows the placeholder with no selection', () => {
    renderIn(<Select aria-label="Country" placeholder="Choose a country" items={COUNTRIES} />)
    expect(screen.getByRole('combobox', { name: 'Country' }).textContent).toBe('Choose a country')
  })

  // Fails with Base UI's own `Select.Value` (no children function), which
  // joins with a hardcoded ", " → "Rot, Grün, Blau".
  it('formats multiple labels as a locale list', () => {
    renderIn(
      <Select
        multiple
        aria-label="Farben"
        items={[
          { value: 'r', label: 'Rot' },
          { value: 'g', label: 'Grün' },
          { value: 'b', label: 'Blau' },
        ]}
        defaultValue={['r', 'g', 'b']}
      />,
      'de-DE',
    )
    expect(screen.getByRole('combobox', { name: 'Farben' }).textContent).toBe('Rot, Grün und Blau')
  })

  // Fails if a separator is rendered after every group rather than between.
  it('renders grouped items with a separator between groups only', async () => {
    renderIn(
      <Select
        aria-label="City"
        defaultOpen
        items={[
          { label: 'Canada', items: [{ value: 'yvr', label: 'Vancouver' }] },
          { label: 'France', items: [{ value: 'cdg', label: 'Paris' }] },
        ]}
      />,
    )
    const listbox = await waitFor(() => screen.getByRole('listbox'))
    expect(listbox.querySelectorAll('[role="group"]')).toHaveLength(2)
    expect(screen.getByText('Canada')).toBeTruthy()
    expect(screen.getByText('France')).toBeTruthy()
    // By class: inside a listbox Base UI renders the separator with
    // `role="presentation"`, so the role cannot find it.
    expect(listbox.querySelectorAll(`.${selectSeparatorClass}`)).toHaveLength(1)
  })

  // Fails if the empty row hardcodes its text instead of reading `noResults`.
  //
  // The placeholder row IS a `role="option"` (Select.stories.tsx's `Empty`
  // story and its axe scan are what forced this: a listbox with a labelled
  // group and no options is invalid WAI-ARIA structure, unreachable by any
  // jsdom test until Storybook could open one for real). It carries
  // `aria-disabled` and is asserted NOT selected, because it is still not a
  // real `Select.Item` — Base UI never registers it as one, so it cannot be
  // the `null` item that reads as selected whenever nothing else is.
  it('shows noResults for an empty list, overridable through LocaleProvider', async () => {
    const { unmount } = renderIn(<Select<string> aria-label="Empty" defaultOpen items={[]} />)
    const listbox = await waitFor(() => screen.getByRole('listbox'))
    expect(listbox.textContent).toBe(DEFAULT_MESSAGES.noResults)
    const option = listbox.querySelector('[role="option"]')
    expect(option).not.toBeNull()
    expect(option!.getAttribute('aria-disabled')).toBe('true')
    expect(option!.getAttribute('aria-selected')).toBeNull()
    unmount()

    render(
      <LocaleProvider locale="fr-FR" messages={{ noResults: 'Aucun résultat' }}>
        <Select<string> aria-label="Vide" defaultOpen items={[]} />
      </LocaleProvider>,
    )
    const french = await waitFor(() => screen.getByRole('listbox'))
    expect(french.textContent).toBe('Aucun résultat')
  })

  // Fails if the empty branch tests `items.length` rather than the flattened
  // list: a group with no items is still one entry in `items`, so the list
  // would render a labelled group with no option in it, which is the listbox
  // `aria-required-children` violation the `noResults` row exists to avoid.
  it('shows noResults, and no group, when every group is empty', async () => {
    renderIn(
      <Select<string>
        aria-label="City"
        defaultOpen
        items={[
          { label: 'Europe', items: [] },
          { label: 'Asia', items: [] },
        ]}
      />,
    )
    const listbox = await waitFor(() => screen.getByRole('listbox'))
    expect(listbox.textContent).toBe(DEFAULT_MESSAGES.noResults)
    expect(listbox.querySelectorAll('[role="group"]')).toHaveLength(0)
    expect(listbox.querySelectorAll(`.${selectSeparatorClass}`)).toHaveLength(0)
    const option = listbox.querySelector('[role="option"]')
    expect(option).not.toBeNull()
    expect(option!.getAttribute('aria-disabled')).toBe('true')
  })

  // Fails if empty groups are rendered alongside non-empty ones: the empty
  // group's label would appear, and so would a separator beside it.
  it('skips an empty group, and the separator beside it, in a mixed list', async () => {
    renderIn(
      <Select
        aria-label="City"
        defaultOpen
        items={[
          { label: 'Europe', items: [] },
          { label: 'Canada', items: [{ value: 'yvr', label: 'Vancouver' }] },
          { label: 'Asia', items: [] },
          { label: 'France', items: [{ value: 'cdg', label: 'Paris' }] },
          { label: 'Africa', items: [] },
        ]}
      />,
    )
    const listbox = await waitFor(() => screen.getByRole('listbox'))
    expect(listbox.querySelectorAll('[role="group"]')).toHaveLength(2)
    expect(screen.queryByText('Europe')).toBeNull()
    expect(screen.queryByText('Asia')).toBeNull()
    expect(screen.queryByText('Africa')).toBeNull()
    expect(listbox.querySelectorAll(`.${selectSeparatorClass}`)).toHaveLength(1)
  })

  it('forwards ref and className to the trigger', () => {
    const ref = createRef<HTMLButtonElement>()
    renderIn(<Select aria-label="Country" items={COUNTRIES} ref={ref} className="mine" size="sm" />)
    expect(ref.current).toBe(screen.getByRole('combobox', { name: 'Country' }))
    expect(ref.current!.className).toBe(`${selectTriggerRecipe({ size: 'sm' })} mine`)
  })

  // Fails if `id` stops reaching the trigger; removing `id` from
  // `SelectProps` fails this at compile time.
  it('passes id through to the trigger', () => {
    renderIn(<Select id="x" aria-label="Country" items={COUNTRIES} />)
    expect(screen.getByRole('combobox', { name: 'Country' }).getAttribute('id')).toBe('x')
  })

  // Fails if `id` goes to the root instead of the trigger: inside a Field
  // the trigger then keeps Field's generated id even after effects (see
  // `SelectProps.id`).
  it('passes id through to the trigger inside a Field, after effects', async () => {
    renderIn(
      <Field label="Country">
        <Select id="x" items={COUNTRIES} />
      </Field>,
    )
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Country' }).getAttribute('id')).toBe('x'),
    )
  })

  // Fails if the data attributes are spread onto the root's hidden input,
  // the popup, or anywhere but the trigger, or are dropped.
  it('puts data attributes on the trigger and nowhere else', async () => {
    renderIn(
      <Select
        data-testid="s"
        data-kind="country"
        aria-label="Country"
        items={COUNTRIES}
        defaultOpen
      />,
    )
    await waitFor(() => screen.getByRole('listbox'))
    const tagged = document.body.querySelectorAll('[data-testid]')
    expect(tagged).toHaveLength(1)
    expect(tagged[0]).toBe(screen.getByRole('combobox', { name: 'Country' }))
    expect(tagged[0]!.getAttribute('data-testid')).toBe('s')
    expect(document.body.querySelectorAll('[data-kind]')).toHaveLength(1)
  })

  // Fails if onFocus/onBlur are not forwarded to the trigger.
  it('calls onFocus and onBlur once for focus entering and leaving the trigger', async () => {
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    renderIn(
      <>
        <Select aria-label="Country" items={COUNTRIES} onFocus={onFocus} onBlur={onBlur} />
        <button type="button">After</button>
      </>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Country' })
    trigger.focus()
    await waitFor(() => expect(onFocus).toHaveBeenCalledTimes(1))
    expect(onBlur).not.toHaveBeenCalled()
    screen.getByRole('button', { name: 'After' }).focus()
    await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1))
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onFocus.mock.calls[0]![0].target).toBe(trigger)
    expect(onBlur.mock.calls[0]![0].target).toBe(trigger)
  })

  // Focus leaving from inside the open popup, straight to another control
  // (a press on an outside button moves focus the same way). Fails if the
  // positioner's blur handler is removed: the trigger never blurs here, so
  // nothing else sees the exit. Tab out through the focus guards and a press
  // on non-focusable space need a real browser: the `FocusWithin` story.
  it('calls onBlur once when focus leaves from inside the open popup', async () => {
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    renderIn(
      <>
        <Select aria-label="Country" items={COUNTRIES} onFocus={onFocus} onBlur={onBlur} />
        <button type="button">After</button>
      </>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Country' })
    trigger.focus()
    fireEvent.click(trigger)
    await waitFor(() => screen.getByRole('listbox'))
    await waitFor(() => expect(trigger.ownerDocument.activeElement).not.toBe(trigger))
    expect(onBlur).not.toHaveBeenCalled()
    screen.getByRole('button', { name: 'After' }).focus()
    await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1))
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  /**
   * react-hook-form's Controller marks a field touched in `onBlur`. Focus
   * moving into the listbox on open, and back to the trigger on close, is
   * not leaving the control. Fails if the popup filter is removed: Base UI
   * merges the consumer's `onBlur` after its own filtered one, so it would
   * run on the move into the popup.
   */
  it('ignores focus moving into and back out of the popup', async () => {
    const onFocus = vi.fn()
    let touched = false
    const onBlur = vi.fn(() => {
      touched = true
    })
    renderIn(
      <>
        <Select aria-label="Country" items={COUNTRIES} onFocus={onFocus} onBlur={onBlur} />
        <button type="button">After</button>
      </>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Country' })
    trigger.focus()
    await waitFor(() => expect(onFocus).toHaveBeenCalledTimes(1))
    fireEvent.click(trigger)
    const option = await waitFor(() => screen.getByRole('option', { name: 'France' }))
    await waitFor(() => expect(trigger.ownerDocument.activeElement).not.toBe(trigger))
    // Base UI commits a mouse click only after a pointerdown on the item.
    fireEvent.pointerDown(option, { pointerType: 'mouse' })
    fireEvent.click(option)
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
    await waitFor(() => expect(trigger.ownerDocument.activeElement).toBe(trigger))
    expect(trigger.textContent).toBe('France')
    expect(onBlur).not.toHaveBeenCalled()
    expect(touched).toBe(false)
    expect(onFocus).toHaveBeenCalledTimes(1)

    screen.getByRole('button', { name: 'After' }).focus()
    await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1))
    expect(touched).toBe(true)
  })

  // §4.3.2's development warning. Fails if the effect is removed (first
  // case) or if it warns on every Select regardless of `labels` (second).
  it('warns when a native label points at the trigger', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderIn(
      <Field.Root>
        <Field.Label>Country</Field.Label>
        <Select items={COUNTRIES} />
      </Field.Root>,
    )
    await waitFor(() => {
      expect(spy.mock.calls.some((args) => WARNING.test(String(args[0])))).toBe(true)
    })
  })

  it('does not warn inside <Field label>', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderIn(
      <Field label="Country">
        <Select items={COUNTRIES} />
      </Field>,
    )
    // Let every effect and re-render settle before asserting the absence.
    await waitFor(() => screen.getByRole('combobox', { name: 'Country' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(spy.mock.calls.some((args) => WARNING.test(String(args[0])))).toBe(false)
  })

  /**
   * ADR-0011 §2 as a test, the way Field.test.tsx asserts it for Field: the
   * convenience component is exactly an assembly of the public parts. Open,
   * so the popup's items are compared too; `document.body` because the
   * popup is portalled.
   *
   * A `data-*` attribute is included so its placement cannot drift from the
   * parts'. `id` is too, but `normaliseIds` rewrites every id, so the
   * comparison cannot see it; each side asserts the trigger's id before
   * normalising instead. `onFocus`/`onBlur` are not included: a handler
   * leaves no trace in the DOM, so passing it to either side would compare
   * nothing. Their behaviour is asserted by the focus tests above and the
   * `FocusWithin` story.
   */
  it('produces exactly the DOM its own compound parts produce', async () => {
    const items: SelectItems<string> = [
      { label: 'North America', items: [{ value: 'ca', label: 'Canada' }] },
      { label: 'Europe', items: [{ value: 'fr', label: 'France', disabled: true }] },
    ]
    const flat = flattenItems(items)
    const toString = (v: string) => v

    renderIn(
      <Select
        id="country-select"
        data-testid="country"
        aria-label="Country"
        name="country"
        placeholder="Pick"
        items={items}
        defaultValue="ca"
        defaultOpen
      />,
    )
    await waitFor(() => screen.getByRole('listbox'))
    expect(screen.getByRole('combobox', { name: 'Country' }).getAttribute('id')).toBe(
      'country-select',
    )
    const a = normaliseIds(document.body.innerHTML)
    // `cleanup`, not `unmount`: unmount leaves the first container in the body.
    cleanup()

    renderIn(
      <Select.Root
        name="country"
        items={items}
        itemToStringValue={toString}
        isItemEqualToValue={equalBySerialisation(toString)}
        defaultValue="ca"
        defaultOpen
      >
        <Select.Trigger id="country-select" aria-label="Country" size="md" data-testid="country">
          <Select.Value placeholder="Pick">
            {(value: string | null) => findLabel(value, flat, toString) ?? 'Pick'}
          </Select.Value>
          <Select.Icon />
        </Select.Trigger>
        <Select.Popup>
          <Select.List>
            <Select.Group>
              <Select.GroupLabel>North America</Select.GroupLabel>
              <Select.Item value="ca">Canada</Select.Item>
            </Select.Group>
            <Select.Separator />
            <Select.Group>
              <Select.GroupLabel>Europe</Select.GroupLabel>
              <Select.Item value="fr" disabled>
                France
              </Select.Item>
            </Select.Group>
          </Select.List>
        </Select.Popup>
      </Select.Root>,
    )
    await waitFor(() => screen.getByRole('listbox'))
    expect(screen.getByRole('combobox', { name: 'Country' }).getAttribute('id')).toBe(
      'country-select',
    )
    const b = normaliseIds(document.body.innerHTML)

    expect(a).toBe(b)
    expect(a).toContain('role="listbox"')
  })
})
