import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Icon } from '../../icons/Icon.js'
import { Input } from './Input.js'

const meta = {
  title: 'Components/Input',
  component: Input,
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { placeholder: 'you@example.com' },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 320 }}>
      <Input size="sm" placeholder="sm" />
      <Input size="md" placeholder="md" />
      <Input size="lg" placeholder="lg" />
    </div>
  ),
}

export const DecorativeIcon: Story = {
  args: { startIcon: { icon: <Icon name="info" />, color: 'info' } },
}

export const ActionableIcon: Story = {
  // The union requires `label` whenever `onClick` is present: an interactive
  // adornment carries its accessible name in the type (ADR-0011 §6.2).
  args: { endIcon: { icon: <Icon name="close" />, onClick: () => {}, label: 'Clear' } },
  play: async ({ canvasElement }) => {
    const clear = within(canvasElement).getByRole('button', { name: 'Clear' })
    await expect(clear).toHaveAttribute('type', 'button')
  },
}

export const Loading: Story = {
  args: { loading: true, defaultValue: 'checking@example.com' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox')
    // A pending control stays submittable: read-only and busy, never disabled.
    await expect(input).toHaveAttribute('aria-busy', 'true')
    await expect(input).toHaveAttribute('readonly')
    await expect(input).not.toBeDisabled()
  },
}

export const Disabled: Story = { args: { disabled: true } }
