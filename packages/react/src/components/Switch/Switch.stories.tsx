import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Field } from '../Field/Field.js'
import { Switch } from './Switch.js'

const meta = {
  title: 'Components/Switch',
  component: Switch,
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
  args: { label: 'Enable notifications' },
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <Switch size="sm" label="Small" />
      <Switch size="md" label="Medium" />
      <Switch size="lg" label="Large" />
    </div>
  ),
}

export const Disabled: Story = { args: { disabled: true } }

export const Checked: Story = { args: { defaultChecked: true } }

export const Invalid: Story = {
  render: () => (
    <Field.Root invalid>
      <Switch label="Enable two-factor authentication" />
      <Field.Error match>Two-factor authentication is required for this account.</Field.Error>
    </Field.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sw = canvas.getByRole('switch', { name: 'Enable two-factor authentication' })
    // Switch.css.ts styles no `data-invalid` selector — the wiring below is
    // Base UI's own Field.Root validation reaching the switch, present but
    // visually unstyled. Still asserted here because it is real, reachable
    // behaviour of the shipped component.
    await expect(sw).toHaveAttribute('aria-invalid', 'true')
    await expect(
      canvas.getByText('Two-factor authentication is required for this account.'),
    ).toBeVisible()
  },
}

export const Toggles: Story = {
  play: async ({ canvasElement }) => {
    const sw = within(canvasElement).getByRole('switch', { name: 'Enable notifications' })
    await expect(sw).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(sw)
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    // Back to 'false' on a second click. This replaces a
    // `not.toHaveAttribute('aria-checked', 'mixed')` that sat one line after
    // asserting the same attribute IS 'true' — an assertion that could not
    // fail, so it asserted nothing. "A switch has no third state" is a claim
    // about the PROP SURFACE, and `Switch.test.tsx` makes it where it can
    // actually be made: a compile-time test that there is no `indeterminate`
    // prop to reach a mixed state with. What a browser can usefully add is
    // that the toggle is a real round trip rather than a one-way latch.
    await userEvent.click(sw)
    await expect(sw).toHaveAttribute('aria-checked', 'false')
  },
}
