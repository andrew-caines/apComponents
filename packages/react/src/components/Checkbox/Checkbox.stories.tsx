import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Field } from '../Field/Field.js'
import { Checkbox } from './Checkbox.js'

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    indeterminate: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { label: 'Send me product updates' },
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <Checkbox size="sm" label="Small" />
      <Checkbox size="md" label="Medium" />
      <Checkbox size="lg" label="Large" />
    </div>
  ),
}

export const Disabled: Story = { args: { disabled: true } }

/**
 * A dedicated story rather than a transient state inside a `play`: axe scans
 * the DOM after `play` finishes, so a state worth scanning has to be the one
 * a story is left in, not one it passes through.
 */
export const Indeterminate: Story = {
  args: { label: 'Select all', indeterminate: true },
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole('checkbox', { name: 'Select all' })
    await expect(box).toHaveAttribute('aria-checked', 'mixed')
  },
}

export const Invalid: Story = {
  render: () => (
    <Field.Root invalid>
      <Checkbox label="I agree to the terms" />
      <Field.Error match>You must agree before continuing.</Field.Error>
    </Field.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const box = canvas.getByRole('checkbox', { name: 'I agree to the terms' })
    await expect(box).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByText('You must agree before continuing.')).toBeVisible()
  },
}

export const Toggles: Story = {
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole('checkbox', { name: 'Send me product updates' })
    await expect(box).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(box)
    await expect(box).toHaveAttribute('aria-checked', 'true')
  },
}
