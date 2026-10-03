import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { hoverBorderRuleApplies } from '../../../../../storybook/support/hoverRule.js'
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
 * Rendered in the invalid state rather than driven into it from a `play`: axe
 * scans the DOM a story is LEFT in after `play` finishes, so a state worth
 * scanning has to be the state the story renders. Same reasoning as
 * `Checkbox`'s `Indeterminate`.
 *
 * `invalid` on the component, not an outer `<Field.Root invalid>` the way
 * `Checkbox` and `Switch` reach the same state. `RadioGroup` mounts its own
 * `Field.Root` internally (`RadioGroupParts.tsx` explains why it has to), and
 * `Field.Root` always mounts a fresh `FieldRootContext.Provider`, so an outer
 * one is SHADOWED rather than merged. This story existed as a comment
 * explaining its own absence until that passthrough was added.
 *
 * The message is a plain sibling, with no hand-written `aria-describedby`: a
 * group's error copy is the consumer's to place, and `Field.Error` cannot be
 * used here because the `Field.Root` it would register into is internal. The
 * invalid state itself is carried by the control border AND by this visible
 * copy, never by colour alone (ADR-0011 §5).
 */
export const Invalid: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <RadioGroup
        label="How should we reach you?"
        name="contact-invalid"
        options={CONTACT_OPTIONS}
        invalid
      />
      <p>Choose a contact method before continuing.</p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Every option, not just the first: `invalid` sits on the group's own
    // Field.Root, so a fix that reached one control and not the rest would be
    // a real defect this would catch.
    for (const option of canvas.getAllByRole('radio')) {
      await expect(option).toHaveAttribute('data-invalid')
    }
    await expect(canvas.getByText('Choose a contact method before continuing.')).toBeVisible()
  },
}

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

/**
 * Hover changes the border of a resting option only. A checked or invalid
 * option keeps its own border under the pointer: `:hover:not(…)` outranks
 * `[data-checked]` and `[data-invalid]` on specificity, so the hover rule has
 * to exclude those states itself. `hoverBorderRuleApplies` explains why this
 * reads the stylesheet instead of hovering.
 */
export const HoverRule: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <RadioGroup
        label="How should we reach you?"
        name="contact-hover"
        options={CONTACT_OPTIONS}
        defaultValue="email"
      />
      <RadioGroup
        label="Preferred contact method"
        name="contact-hover-invalid"
        options={CONTACT_OPTIONS}
        invalid
      />
      <p>Choose a preferred contact method before continuing.</p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const valid = within(canvas.getByRole('radiogroup', { name: 'How should we reach you?' }))
    const invalid = within(canvas.getByRole('radiogroup', { name: 'Preferred contact method' }))
    // Non-vacuity: without this, a stylesheet with no hover rule passes.
    await expect(hoverBorderRuleApplies(valid.getByRole('radio', { name: 'Text message' }))).toBe(
      true,
    )
    // Each fails when its `:not(…)` is removed from the hover selector.
    await expect(hoverBorderRuleApplies(valid.getByRole('radio', { name: 'Email' }))).toBe(false)
    await expect(hoverBorderRuleApplies(invalid.getByRole('radio', { name: 'Text message' }))).toBe(
      false,
    )
  },
}
