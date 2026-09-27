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

export const Checked: Story = {
  args: { defaultChecked: true },
  play: async ({ canvasElement }) => {
    const sw = within(canvasElement).getByRole('switch', { name: 'Enable notifications' })
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    // A checked track fills edge to edge: `[data-checked]` swaps the border
    // to the checked fill, as `Checkbox` does. Without it the resting
    // `border` (`borderNormal`) draws a grey ring round the filled pill.
    // Differential, so it needs no resolved colour string. Real Chromium, so
    // `getComputedStyle` sees the cascade (jsdom cannot).
    //
    // The hovered case is not asserted here: `storybook/test`'s `userEvent`
    // dispatches synthetic events and never sets `:hover`, so a hover
    // assertion here could not fail. See the hover rule in `Switch.css.ts`.
    await expect(getComputedStyle(sw).borderColor).toBe(getComputedStyle(sw).backgroundColor)
  },
}

export const Invalid: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <Switch label="Enable notifications (resting, for comparison)" />
      <Field.Root invalid>
        <Switch label="Enable two-factor authentication" />
        <Field.Error match>Two-factor authentication is required for this account.</Field.Error>
      </Field.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const resting = canvas.getByRole('switch', {
      name: 'Enable notifications (resting, for comparison)',
    })
    const sw = canvas.getByRole('switch', { name: 'Enable two-factor authentication' })
    await expect(sw).toHaveAttribute('aria-invalid', 'true')
    await expect(
      canvas.getByText('Two-factor authentication is required for this account.'),
    ).toBeVisible()
    // Task 8 (spec §4.1.10): `Switch.css.ts` now styles `&[data-invalid]`
    // with `borderInvalid`. This project runs in a real Chromium browser
    // (unlike the jsdom unit-test project, which cannot resolve the cascade
    // at all — see `Switch.css.ts`'s `BORDER_WIDTH` note), so `getComputedStyle`
    // here reflects the real, painted border colour. The comparison is
    // differential against a resting Switch rather than a literal colour
    // value, so it does not need to know the resolved OKLCH string — only
    // that the invalid track's border is NOT the same colour as a resting
    // track's, which is exactly what a missing `[data-invalid]` rule would
    // fail to produce.
    await expect(getComputedStyle(sw).borderColor).not.toBe(getComputedStyle(resting).borderColor)
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
