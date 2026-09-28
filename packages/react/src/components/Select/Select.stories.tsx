import { useState, type FocusEventHandler } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Field } from '../Field/Field.js'
import { DEFAULT_MESSAGES } from '../../providers/messages.js'
import { Select } from './Select.js'
import { selectPopupClass } from './Select.css.js'

const COUNTRIES = [
  { value: 'ca', label: 'Canada' },
  { value: 'fr', label: 'France' },
  { value: 'de', label: 'Germany' },
  { value: 'jp', label: 'Japan' },
]

const GROUPED_COUNTRIES = [
  {
    label: 'North America',
    items: [
      { value: 'ca', label: 'Canada' },
      { value: 'us', label: 'United States' },
    ],
  },
  {
    label: 'Europe',
    items: [
      { value: 'fr', label: 'France' },
      { value: 'de', label: 'Germany' },
    ],
  },
]

interface Country {
  code: string
  name: string
}
const OBJECT_COUNTRIES = [
  { value: { code: 'ca', name: 'Canada' }, label: 'Canada' },
  { value: { code: 'fr', name: 'France' }, label: 'France' },
]
const byCode = (c: Country) => c.code

const meta = {
  title: 'Components/Select',
  // The instantiation expression, not `typeof Select<string>` in the
  // `satisfies` target alone: `satisfies` only validates, it never narrows a
  // property's own recorded type, so `component: Select` here would keep
  // `Select`'s full unresolved generic signature and `StoryObj`'s `Args`
  // would come out with `Value` and `Multiple` as their bare, unresolved type
  // parameters (`defaultValue: unknown`, `multiple: boolean | undefined`).
  component: Select<string>,
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
  args: {
    items: COUNTRIES,
    placeholder: 'Choose a country',
  },
} satisfies Meta<typeof Select<string>>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The convenience component inside `Field`, exactly as the common case in
 * `Select.tsx`'s own doc comment. `play` covers the keyboard model a mouse
 * click can't exercise: opening, moving the highlight, selecting, cancelling,
 * and jumping to an item by typing while closed.
 */
export const Default: Story = {
  render: (args) => (
    <Field label="Country">
      <Select {...args} />
    </Field>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('combobox', { name: 'Country' })
    await expect(trigger).toHaveTextContent('Choose a country')

    await step('ArrowDown opens the popup and highlights the first item', async () => {
      trigger.focus()
      await userEvent.keyboard('{ArrowDown}')
      const listbox = await within(document.body).findByRole('listbox')
      const canada = within(listbox).getByRole('option', { name: 'Canada' })
      await waitFor(() => expect(canada).toHaveAttribute('data-highlighted'))
    })

    await step('further arrows move the highlight', async () => {
      const listbox = within(document.body).getByRole('listbox')
      const canada = within(listbox).getByRole('option', { name: 'Canada' })
      const france = within(listbox).getByRole('option', { name: 'France' })
      await userEvent.keyboard('{ArrowDown}')
      await waitFor(() => expect(france).toHaveAttribute('data-highlighted'))
      await expect(canada).not.toHaveAttribute('data-highlighted')
    })

    await step(
      'Enter selects the highlighted item, closes the popup, and returns focus',
      async () => {
        await userEvent.keyboard('{Enter}')
        // NOT `waitForElementToBeRemoved`: Base UI force-mounts the listbox
        // (hidden) the whole time the trigger is focused, to support the
        // closed-trigger typeahead the next step exercises, so the node never
        // leaves the document. `queryByRole` is accessibility-aware and
        // correctly stops finding it once Base UI applies the native
        // `hidden` attribute post-transition — that is "closed" here.
        await waitFor(() => expect(within(document.body).queryByRole('listbox')).toBeNull())
        await waitFor(() => expect(trigger).toHaveFocus())
        await expect(trigger).toHaveTextContent('France')
      },
    )

    await step('Escape closes the popup without changing the value', async () => {
      // Reopening highlights the current selection (France) first — pressing
      // Escape right there could never distinguish "committed nothing" from
      // "committed the already-selected item". Moving the highlight OFF the
      // selected value (to Germany) before Escape is what makes this fail if
      // Escape ever wrongly committed the highlighted item.
      await userEvent.keyboard('{ArrowDown}')
      const listbox = await within(document.body).findByRole('listbox')
      const germany = within(listbox).getByRole('option', { name: 'Germany' })
      await userEvent.keyboard('{ArrowDown}')
      await waitFor(() => expect(germany).toHaveAttribute('data-highlighted'))
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(within(document.body).queryByRole('listbox')).toBeNull())
      await expect(trigger).toHaveTextContent('France')
    })

    await step('typing a letter jumps to the matching item while closed', async () => {
      trigger.focus()
      await userEvent.keyboard('g')
      await waitFor(() => expect(trigger).toHaveTextContent('Germany'))
      expect(within(document.body).queryByRole('listbox')).toBeNull()
    })
  },
}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: 320 }}>
      <Select
        size="sm"
        aria-label="Country (sm)"
        placeholder="Choose a country"
        items={COUNTRIES}
      />
      <Select
        size="md"
        aria-label="Country (md)"
        placeholder="Choose a country"
        items={COUNTRIES}
      />
      <Select
        size="lg"
        aria-label="Country (lg)"
        placeholder="Choose a country"
        items={COUNTRIES}
      />
    </div>
  ),
}

export const Grouped: Story = {
  render: () => (
    <Select aria-label="Country" placeholder="Choose a country" items={GROUPED_COUNTRIES} />
  ),
}

/**
 * Selecting keeps the popup open, and the trigger's text is the
 * `Intl.ListFormat` conjunction of every chosen label — never Base UI's own
 * hardcoded `', '` join.
 */
export const Multiple: Story = {
  render: () => (
    <Select multiple aria-label="Countries" placeholder="Choose countries" items={COUNTRIES} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('combobox', { name: 'Countries' })
    await userEvent.click(trigger)
    const listbox = await within(document.body).findByRole('listbox')
    await userEvent.click(within(listbox).getByRole('option', { name: 'Canada' }))
    await userEvent.click(within(listbox).getByRole('option', { name: 'France' }))
    // `aria-expanded` flips to `'false'` the instant Base UI's `open` state
    // changes — well before the ~500ms exit-transition-driven `hidden`
    // attribute lands (see `Default`'s Enter step) — so it is what actually
    // catches a multi-select that wrongly closes on choice. A bare
    // `toBeVisible` cannot: the popup stays visually present through its
    // whole closing transition regardless of whether it started closing.
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(trigger).toHaveTextContent('Canada and France'))
  },
}

/**
 * An object `defaultValue` rebuilt as a fresh literal every render. Fails on
 * the label if the trigger falls back to Base UI's own resolution (raw JSON),
 * and fails on matching if the default `isItemEqualToValue` reverts to
 * `Object.is` instead of comparing by serialisation.
 */
export const ObjectValues: Story = {
  render: () => (
    <Select<Country>
      aria-label="Country (object values)"
      placeholder="Choose a country"
      items={OBJECT_COUNTRIES}
      itemToStringValue={byCode}
      defaultValue={{ code: 'fr', name: 'France' }}
    />
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('combobox', {
      name: 'Country (object values)',
    })
    // An EXACT match, not `toHaveTextContent` (a substring test): Base UI's
    // own raw-JSON fallback for an unresolved object value is literally
    // `{"code":"fr","name":"France"}`, which itself CONTAINS the substring
    // "France" — a substring assertion could never fail against that
    // fallback and so would prove nothing.
    expect(trigger.textContent).toBe('France')

    await userEvent.click(trigger)
    const listbox = await within(document.body).findByRole('listbox')
    const france = within(listbox).getByRole('option', { name: 'France' })
    // The label above comes from `findLabel`'s own serialised lookup
    // regardless of item equality, so it can't exercise
    // `isItemEqualToValue` at all. The France OPTION being marked selected
    // is what actually depends on it: this fails if equality reverts to
    // Base UI's default `Object.is`, since the `defaultValue` above is a
    // fresh object literal every render.
    await expect(france).toHaveAttribute('aria-selected', 'true')
  },
}

export const Disabled: Story = {
  args: { disabled: true, 'aria-label': 'Country' },
}

export const Invalid: Story = {
  render: (args) => (
    <Field label="Country" error="Choose a country before continuing.">
      <Select {...args} />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('combobox', { name: 'Country' })
    await expect(trigger).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByText('Choose a country before continuing.')).toBeVisible()
  },
}

export const Empty: Story = {
  render: () => <Select<string> aria-label="No matching countries" items={[]} defaultOpen />,
  play: async () => {
    const listbox = await within(document.body).findByRole('listbox')
    await expect(listbox).toHaveTextContent(DEFAULT_MESSAGES.noResults)
    // A `role="option"`, disabled and never selected — WAI-ARIA requires a
    // listbox to own at least one real option, and axe (gate 5) enforces it:
    // a labelled-group-with-no-options placeholder failed `aria-required-
    // children` the first time this story opened a genuinely empty Select.
    const placeholder = within(listbox).getByRole('option')
    await expect(placeholder).toHaveAttribute('aria-disabled', 'true')
    await expect(placeholder).not.toHaveAttribute('aria-selected')
  },
}

const warnings: string[] = []

/**
 * The §4.3.2 development warning, in a real Vite browser bundle, for both
 * ways a native `<label>` can reach the trigger: `Field.Label`'s `for`, and a
 * `<label>` wrapping the Select. This is the misuse the warning names, shown
 * so the warning can be seen firing, not as a pattern to copy.
 *
 * Fails if the warning is guarded by `typeof process`: this bundle has no
 * `process` global (only the replaced `process.env.NODE_ENV`), so that guard
 * returns early in every browser and the jsdom unit test alone cannot catch
 * it. The spy is installed in `beforeEach` because the effect fires on
 * mount, before `play` runs.
 */
export const NativeLabelWarning: Story = {
  beforeEach: () => {
    warnings.length = 0
    const original = console.error
    console.error = (...args: unknown[]) => {
      warnings.push(String(args[0]))
    }
    return () => {
      console.error = original
    }
  },
  render: () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Field.Root>
        <Field.Label>Country (label for)</Field.Label>
        <Select items={COUNTRIES} placeholder="Choose a country" />
      </Field.Root>
      <label>
        Country (wrapping label)
        <Select items={COUNTRIES} placeholder="Choose a country" />
      </label>
    </div>
  ),
  play: async () => {
    // Each Select warns once, so two warnings means both cases were caught.
    await waitFor(() =>
      expect(warnings.filter((w) => w.startsWith('Select: a native <label>'))).toHaveLength(2),
    )
  },
}

/**
 * Field's non-native-label protocol (`Field.tsx`'s doc comment), written out
 * by hand rather than produced by `<Field label>`: a `<div>` label with a
 * server-rendered id, and the trigger's `aria-labelledby` pointing at it.
 *
 * Public API only. With string values nothing else is needed: Base UI
 * resolves a string value's label from `items`, and its default
 * `Object.is` equality is correct for strings. Object values need what the
 * convenience `<Select>` supplies itself (`itemToStringValue`, a
 * serialising `isItemEqualToValue`, a label lookup), so use `<Select>` for
 * those.
 *
 * Its `play` also carries the placement assertion (R3, 5c plan): the popup's
 * top edge sits at or below the trigger's bottom edge. This is the only place
 * that assertion lives, because it is the only story built from the compound
 * parts and able to pass `positioner` — the convenience `<Select>` never
 * exposes it. jsdom cannot fail this the way a real layout engine can, which
 * is why it moved here from a unit test.
 *
 * The `paddingBlockStart` is not decorative: without genuine room ABOVE the
 * trigger, a `positioner={{ side: 'top' }}` perturbation is neutered by
 * floating-ui's own collision handling, which flips `top` back to `bottom`
 * whenever `top` would not fit — so the perturbation would pass right through
 * this assertion instead of failing it. The popup's measured height here is
 * ~176px (4 items); this leaves comfortable headroom for that check.
 */
export const HandAssembled: Story = {
  render: () => {
    const labelId = 'select-hand-assembled-label'
    return (
      <div style={{ paddingBlockStart: 320 }}>
        <Field.Root>
          <Field.Label nativeLabel={false} render={<div />} id={labelId}>
            Country
          </Field.Label>
          <Select.Root items={COUNTRIES}>
            <Select.Trigger aria-labelledby={labelId}>
              <Select.Value placeholder="Choose a country" />
              <Select.Icon />
            </Select.Trigger>
            <Select.Popup>
              <Select.List>
                {COUNTRIES.map((item) => (
                  <Select.Item key={item.value} value={item.value}>
                    {item.label}
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Root>
        </Field.Root>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('combobox', { name: 'Country' })
    await expect(trigger).toHaveTextContent('Choose a country')
    await userEvent.click(trigger)
    const listbox = await within(document.body).findByRole('listbox')
    const popup = document.body.querySelector(`.${selectPopupClass}`)
    if (popup === null) throw new Error('Select.Popup did not render into the document body')
    const popupRect = popup.getBoundingClientRect()
    const triggerRect = trigger.getBoundingClientRect()
    expect(popupRect.top).toBeGreaterThanOrEqual(triggerRect.bottom)

    // Base UI resolves the string value's label from `items`: the trigger
    // shows "France", not the raw value "fr". Fails if the hand assembly
    // needs a label lookup of its own after all.
    await userEvent.click(within(listbox).getByRole('option', { name: 'France' }))
    await waitFor(() => expect(trigger.textContent).toBe('France'))
    // Let the popup finish closing, so the story's axe scan does not catch
    // it half-way through its exit transition.
    await waitFor(() => expect(within(document.body).queryByRole('listbox')).toBeNull())
  },
}

/**
 * A form library's touched flag: set in `onBlur`, as react-hook-form's
 * `Controller` does. Shown as text so `play` reads it from the page.
 */
function TouchedSelect({
  onFocus,
  onBlur,
}: {
  onFocus: FocusEventHandler<HTMLElement>
  onBlur: FocusEventHandler<HTMLElement>
}) {
  const [touched, setTouched] = useState(false)
  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: 320 }}>
      <Field label="Country">
        <Select
          items={COUNTRIES}
          placeholder="Choose a country"
          onFocus={onFocus}
          onBlur={(event) => {
            setTouched(true)
            onBlur(event)
          }}
        />
      </Field>
      <button type="button">After</button>
      <p data-testid="touched">{touched ? 'touched' : 'untouched'}</p>
    </div>
  )
}

/**
 * `Select`'s `onFocus`/`onBlur` have focus-within semantics across the
 * trigger and the open popup. In real Chromium, because the exits under test
 * leave from inside the portalled popup, through Base UI's focus guards and
 * its outside-press handling, which jsdom does not reproduce. Each step fails
 * if the positioner's blur handler is removed (the exit is never seen) or if
 * the `focusWithin` guard on `onFocus` is removed (focus returning to the
 * trigger re-fires it).
 */
export const FocusWithin: Story = {
  args: { onFocus: fn(), onBlur: fn() },
  render: (args) => (
    <TouchedSelect
      onFocus={args.onFocus as FocusEventHandler<HTMLElement>}
      onBlur={args.onBlur as FocusEventHandler<HTMLElement>}
    />
  ),
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('combobox', { name: 'Country' })
    const after = canvas.getByRole('button', { name: 'After' })
    const touched = canvas.getByTestId('touched')
    const onFocus = args.onFocus as ReturnType<typeof fn>
    const onBlur = args.onBlur as ReturnType<typeof fn>
    const reset = () => {
      onFocus.mockClear()
      onBlur.mockClear()
    }
    const openFromKeyboard = async () => {
      trigger.focus()
      await userEvent.keyboard('{ArrowDown}')
      await within(document.body).findByRole('listbox')
      await waitFor(() => expect(trigger).not.toHaveFocus())
    }

    await step('open, select and close: no blur, one focus', async () => {
      reset()
      await openFromKeyboard()
      await userEvent.keyboard('{ArrowDown}')
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(trigger).toHaveFocus())
      await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
      await expect(onFocus).toHaveBeenCalledTimes(1)
      await expect(onBlur).not.toHaveBeenCalled()
      await expect(touched).toHaveTextContent('untouched')
      after.focus()
      await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1))
    })

    await step('Tab out of the open listbox: one blur, touched', async () => {
      reset()
      await openFromKeyboard()
      await userEvent.tab()
      await waitFor(() => expect(after).toHaveFocus())
      await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1))
      await expect(onFocus).toHaveBeenCalledTimes(1)
      await expect(touched).toHaveTextContent('touched')
    })

    await step('press an outside button while open: one blur', async () => {
      reset()
      await openFromKeyboard()
      await userEvent.click(after)
      await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
      await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1))
      await expect(onFocus).toHaveBeenCalledTimes(1)
    })

    await step('press non-focusable space while open: no blur, no second focus', async () => {
      reset()
      after.blur()
      await openFromKeyboard()
      await userEvent.click(touched)
      await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
      await waitFor(() => expect(within(document.body).queryByRole('listbox')).toBeNull())
      await expect(onFocus).toHaveBeenCalledTimes(1)
      await expect(onBlur).not.toHaveBeenCalled()
      await expect(trigger).toHaveFocus()
    })
  },
}
