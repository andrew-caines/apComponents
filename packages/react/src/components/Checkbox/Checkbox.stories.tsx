import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { hoverBorderRuleApplies } from '../../../../../storybook/support/hoverRule.js'
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

/**
 * Hover changes the border of a resting box only. A checked, indeterminate or
 * invalid box keeps its own border under the pointer: `:hover:not(…)`
 * outranks `[data-checked]` and `[data-invalid]` on specificity, so the hover
 * rule has to exclude those states itself. `hoverBorderRuleApplies` explains
 * why this reads the stylesheet instead of hovering.
 */
export const HoverRule: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <Checkbox label="Resting" />
      <Checkbox label="Checked" defaultChecked />
      <Checkbox label="Indeterminate" indeterminate />
      <Field.Root invalid>
        <Checkbox label="Invalid" />
      </Field.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const box = (name: string) => canvas.getByRole('checkbox', { name })
    // Non-vacuity: without this, a stylesheet with no hover rule passes.
    await expect(hoverBorderRuleApplies(box('Resting'))).toBe(true)
    // Each fails when its `:not(…)` is removed from the hover selector.
    await expect(hoverBorderRuleApplies(box('Checked'))).toBe(false)
    await expect(hoverBorderRuleApplies(box('Indeterminate'))).toBe(false)
    await expect(hoverBorderRuleApplies(box('Invalid'))).toBe(false)
  },
}
