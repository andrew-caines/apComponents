import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { RadioGroup } from './RadioGroup.js'

const CONTACT_OPTIONS = [
  { value: 'email', label: 'Email', hint: 'We reply within one business day.' },
  { value: 'sms', label: 'Text message', hint: 'Standard rates may apply.' },
  { value: 'none', label: 'Do not contact me' },
] as const

const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
  args: {
    label: 'How should we reach you?',
    name: 'contact',
    options: CONTACT_OPTIONS,
    defaultValue: 'email',
  },
} satisfies Meta<typeof RadioGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <RadioGroup
        size="sm"
        label="Small"
        name="size-sm"
        options={CONTACT_OPTIONS}
        defaultValue="email"
      />
      <RadioGroup
        size="md"
        label="Medium"
        name="size-md"
        options={CONTACT_OPTIONS}
        defaultValue="email"
      />
      <RadioGroup
        size="lg"
        label="Large"
        name="size-lg"
        options={CONTACT_OPTIONS}
        defaultValue="email"
      />
    </div>
  ),
}

export const Disabled: Story = { args: { disabled: true } }

/**
 * No `Invalid` story: `data-invalid` is styled in `RadioGroup.css.ts`, but
 * there is no route to set it through this component's public API. The
 * `Field.Root` that would carry `invalid` is created INSIDE
 * `RadioGroupRoot` (`RadioGroupParts.tsx`), wrapping the underlying
 * `BaseRadioGroup`, and takes no props from the caller — an outer
 * `<Field.Root invalid>` wrapped around `<RadioGroup />` would only shadow
 * that inner context, never reach it, since `Field.Root` always mounts a
 * fresh `FieldRootContext.Provider`. This was flagged in Task 4's review and
 * confirmed here rather than worked around; see the task report.
 */

export const ArrowKeyNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const email = canvas.getByRole('radio', { name: 'Email' })
    const text = canvas.getByRole('radio', { name: 'Text message' })
    // Each option's accessible name is its own label, never the group's.
    await expect(email).toHaveAccessibleName('Email')
    await expect(text).toHaveAccessibleName('Text message')

    email.focus()
    // Base UI's composite root defers the focus move to a microtask
    // (`queueMicrotask` in `internals/composite/root/useCompositeRoot.js`),
    // and selection follows FOCUS rather than the keypress itself — so a
    // synchronous assertion immediately after the key press reads one
    // microtask too early. `RadioGroup.test.tsx`'s own arrow-key test hit
    // this and had to become async with `await waitFor` for exactly this
    // reason; this play function does the same rather than asserting
    // synchronously.
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(text).toHaveAttribute('aria-checked', 'true'))
    // MOVED, not added: the previously-selected option gave up its
    // selection.
    await expect(email).toHaveAttribute('aria-checked', 'false')
    await expect(text).toHaveFocus()
  },
}
