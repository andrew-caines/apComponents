import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '../Button/Button.js'
import { Icon } from '../../icons/index.js'
import { Tooltip } from './Tooltip.js'

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  argTypes: {
    side: {
      control: 'inline-radio',
      options: ['top', 'right', 'bottom', 'left'],
    },
  },
  args: {
    content: 'Saves your work to the server',
    // Placeholder child: every story renders its own trigger.
    children: <Button>Save</Button>,
  },
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

const body = () => within(document.body)

/**
 * A `Button` trigger. Keyboard focus opens the tooltip, the trigger's
 * `aria-describedby` then names it, and Escape closes it and removes the
 * attribute again. Perturbation: removing the `state.open` branch in
 * `TooltipTrigger` leaves the attribute set (or never set) and fails the
 * open and closed checks.
 */
export const Default: Story = {
  render: (args) => (
    <div style={{ padding: '4rem' }}>
      <Tooltip {...args}>
        <Button>Save</Button>
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Save' })
    await expect(trigger.getAttribute('aria-describedby')).toBeNull()

    await step(
      'focus opens the tooltip and the trigger describes itself with it',
      async () => {
        await userEvent.tab()
        await expect(trigger).toHaveFocus()
        const tip = await body().findByRole('tooltip')
        await expect(tip).toHaveTextContent('Saves your work to the server')
        await expect(tip.id).not.toBe('')
        await waitFor(() =>
          expect(trigger.getAttribute('aria-describedby')).toBe(tip.id),
        )
      },
    )

    await step('Escape closes it and removes the description', async () => {
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(body().queryByRole('tooltip')).toBeNull())
      await expect(trigger.getAttribute('aria-describedby')).toBeNull()
    })
  },
}

/**
 * An icon-only `Button`. Its own `aria-label` is its name, the tooltip is its
 * description, and the two stay separate: the tooltip text never becomes the
 * name. Perturbation: dropping the `aria-label` from the button fails the name
 * assertion; the description assertion fails if the trigger loses its
 * `aria-describedby`.
 */
export const IconButton: Story = {
  args: { content: 'Close the panel' },
  render: (args) => (
    <div style={{ padding: '4rem' }}>
      <Tooltip {...args}>
        <Button aria-label="Close" variant="ghost">
          <Icon name="close" />
        </Button>
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', {
      name: 'Close',
    })
    await userEvent.tab()
    const tip = await body().findByRole('tooltip')
    await expect(tip).toHaveTextContent('Close the panel')
    await waitFor(() =>
      expect(trigger).toHaveAccessibleDescription('Close the panel'),
    )
    await expect(trigger).toHaveAccessibleName('Close')
  },
}

/**
 * The default `side` is `top`: once open, the tooltip's bottom edge is at or
 * above the trigger's top edge. Perturbation: `side="bottom"` puts it below
 * and fails the placement assertion.
 */
export const Placement: Story = {
  render: (args) => (
    <div style={{ padding: '6rem' }}>
      <Tooltip {...args}>
        <Button>Save</Button>
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Save' })
    await userEvent.tab()
    const tip = await body().findByRole('tooltip')
    await waitFor(() => {
      // Prove Floating UI has positioned it before measuring: an unpositioned
      // popup sits near (0,0), where "above the trigger" is trivially true.
      const positioner = tip.closest('[data-side]')
      expect(positioner?.getAttribute('data-side')).toBe('top')
      const t = tip.getBoundingClientRect()
      const b = trigger.getBoundingClientRect()
      expect(t.width).toBeGreaterThan(0)
      expect(
        Math.abs(t.left + t.width / 2 - (b.left + b.width / 2)),
      ).toBeLessThan(4)
      expect(t.bottom).toBeLessThanOrEqual(b.top)
    })
  },
}

/**
 * Real-browser proof of `ApProvider`'s delay grouping (the fake-timer unit
 * test is in `ApProvider.test.tsx`). Hover the first trigger and wait out its
 * 600 ms delay; hovering the second then opens it at once, well under 200 ms.
 * Perturbation: removing `TooltipProvider` from `ApProvider` makes the second
 * wait its own ~600 ms and fails the threshold.
 */
export const DelayGroup: Story = {
  render: () => (
    <div style={{ padding: '4rem', display: 'flex', gap: '1rem' }}>
      <Tooltip content="First tip">
        <Button>First</Button>
      </Tooltip>
      <Tooltip content="Second tip">
        <Button>Second</Button>
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = canvas.getByRole('button', { name: 'First' })
    const second = canvas.getByRole('button', { name: 'Second' })

    await userEvent.hover(first)
    await body().findByText('First tip', undefined, { timeout: 3000 })

    const start = performance.now()
    await userEvent.hover(second)
    await body().findByText('Second tip', undefined, { timeout: 3000 })
    const elapsed = performance.now() - start
    await expect(elapsed).toBeLessThan(200)
  },
}

/**
 * Characterisation test for the open question in spec section 4.4.1: with one
 * tooltip open from keyboard focus, does hovering a second trigger leave both
 * visible? OBSERVED: only ONE stays visible, the second. Opening it closes
 * the first, so the assertion pins a count of one and that the survivor is the
 * second. Mechanism: every trigger calls `useDelayGroup`
 * (`tooltip/trigger/TooltipTrigger.js:106`), and the group closes the
 * previously open tooltip with reason `none`
 * (`floating-ui-react/components/FloatingDelayGroup.js:144-166`). Without
 * `ApProvider`'s provider the default group context is module-level and shared
 * by every tooltip (`FloatingDelayGroup.js:17-33`), so removing the provider
 * would NOT give two. Perturbation: passing `open` to both `Tooltip`s makes
 * both Roots controlled, which keeps two open (the group's close becomes an
 * ignored `onOpenChange` request, as the two-Roots test in
 * `TooltipParts.test.tsx` proves) and fails the count of one.
 */
export const TwoOpen: Story = {
  render: () => (
    <div style={{ padding: '4rem', display: 'flex', gap: '1rem' }}>
      <Tooltip content="First tip">
        <Button>First</Button>
      </Tooltip>
      <Tooltip content="Second tip">
        <Button>Second</Button>
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const second = canvas.getByRole('button', { name: 'Second' })
    await userEvent.tab()
    await body().findByText('First tip')

    await userEvent.hover(second)
    await body().findByText('Second tip', undefined, { timeout: 3000 })
    // Let any close of the first tooltip finish before counting.
    await new Promise((resolve) => setTimeout(resolve, 500))
    const open = body().queryAllByRole('tooltip')
    await expect(open).toHaveLength(1)
    await expect(open[0]).toHaveTextContent('Second tip')
  },
}

/**
 * Pins the documented limitation: a disabled `Button` cannot open a tooltip.
 * Neither hover nor focus opens it. Perturbation: rendering the button enabled
 * opens it and fails the assertion.
 */
export const DisabledButton: Story = {
  render: (args) => (
    <div style={{ padding: '4rem' }}>
      <Tooltip {...args}>
        <Button disabled>Save</Button>
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Save' })
    await expect(trigger).toBeDisabled()
    await userEvent.hover(trigger)
    await userEvent.tab()
    // Longer than the 600 ms open delay, so a late open would be caught.
    await new Promise((resolve) => setTimeout(resolve, 900))
    await expect(body().queryByRole('tooltip')).toBeNull()
  },
}
