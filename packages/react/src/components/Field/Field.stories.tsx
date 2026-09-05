import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Input } from '../Input/Input.js'
import { Field } from './Field.js'

const meta = {
  title: 'Components/Field',
  component: Field,
  args: { label: 'Email address', children: <Input placeholder="you@example.com" /> },
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithHint: Story = {
  args: { hint: 'We only use this to send receipts.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Email address' })
    // The relationship is derived by Base UI, never hand-passed.
    await expect(input).toHaveAccessibleDescription('We only use this to send receipts.')
  },
}

export const WithError: Story = {
  args: { error: 'That address is already in use.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Email address' })
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    // An error is an icon and text, never colour alone (ADR-0011 §5).
    await expect(within(canvasElement).getByText('That address is already in use.')).toBeVisible()
  },
}

export const HintAndError: Story = {
  args: { hint: 'Work addresses only.', error: 'That address is already in use.' },
}

export const Compound: Story = {
  render: () => (
    <Field.Root>
      <Field.Label>Email address</Field.Label>
      <Field.Control render={<Input placeholder="you@example.com" />} />
      <Field.Description>Assembled from the compound parts.</Field.Description>
      <Field.Error />
    </Field.Root>
  ),
}
