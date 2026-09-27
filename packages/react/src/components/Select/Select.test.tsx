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
  it('shows noResults for an empty list, overridable through LocaleProvider', async () => {
    const { unmount } = renderIn(<Select<string> aria-label="Empty" defaultOpen items={[]} />)
    const listbox = await waitFor(() => screen.getByRole('listbox'))
    expect(listbox.textContent).toBe(DEFAULT_MESSAGES.noResults)
    expect(listbox.querySelector('[role="option"]')).toBeNull()
    unmount()

    render(
      <LocaleProvider locale="fr-FR" messages={{ noResults: 'Aucun résultat' }}>
        <Select<string> aria-label="Vide" defaultOpen items={[]} />
      </LocaleProvider>,
    )
    const french = await waitFor(() => screen.getByRole('listbox'))
    expect(french.textContent).toBe('Aucun résultat')
  })

  it('forwards ref and className to the trigger', () => {
    const ref = createRef<HTMLButtonElement>()
    renderIn(<Select aria-label="Country" items={COUNTRIES} ref={ref} className="mine" size="sm" />)
    expect(ref.current).toBe(screen.getByRole('combobox', { name: 'Country' }))
    expect(ref.current!.className).toBe(`${selectTriggerRecipe({ size: 'sm' })} mine`)
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
        aria-label="Country"
        name="country"
        placeholder="Pick"
        items={items}
        defaultValue="ca"
        defaultOpen
      />,
    )
    await waitFor(() => screen.getByRole('listbox'))
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
        <Select.Trigger aria-label="Country" size="md">
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
    const b = normaliseIds(document.body.innerHTML)

    expect(a).toBe(b)
    expect(a).toContain('role="listbox"')
  })
})
