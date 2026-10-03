import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '../Button/Button.js'
import { Input } from '../Input/Input.js'
import { Popover } from './Popover.js'
import { popoverPopupClass } from './Popover.css.js'

const meta = {
  title: 'Components/Popover',
  component: Popover,
  argTypes: {
    side: {
      control: 'inline-radio',
      options: ['top', 'right', 'bottom', 'left'],
    },
  },
  args: {
    title: 'Rename file',
    description: 'Choose a new name for this file.',
    // Placeholders: every story renders its own trigger and body.
    trigger: <Button>Rename</Button>,
    children: null,
  },
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

const body = () => within(document.body)

/** Wait for the popup to be gone, so the story's axe scan never sees it mid-exit. */
const expectClosed = () => waitFor(() => expect(body().queryByRole('dialog')).toBeNull())

/**
 * A titled popover with a description and an input. Clicking the trigger moves
 * focus to the first tabbable in the popup (the input), and Escape closes it
 * and returns focus to the trigger. Perturbation: opening it by hover instead
 * of click (`openOnHover` and a hover) leaves focus on the trigger and fails
 * the focus-moved check.
 */
export const Default: Story = {
  render: (args) => (
    <div style={{ padding: '4rem' }}>
      <Popover {...args} trigger={<Button>Rename</Button>}>
        <Input aria-label="New name" />
      </Popover>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Rename' })

    await step('click opens it and moves focus inside', async () => {
      await userEvent.click(trigger)
      const dialog = await body().findByRole('dialog', { name: 'Rename file' })
      await expect(dialog).toHaveAccessibleDescription('Choose a new name for this file.')
      await waitFor(() => expect(body().getByRole('textbox', { name: 'New name' })).toHaveFocus())
    })

    await step('Escape closes it and returns focus to the trigger', async () => {
      await userEvent.keyboard('{Escape}')
      await expectClosed()
      await waitFor(() => expect(trigger).toHaveFocus())
    })
  },
}

/**
 * Tab past the last focusable element in a non-modal popover closes it
 * (Base UI's `closeOnFocusOut`). Perturbation: `TabOutTrapped` below, the
 * hand-assembled `modal="trap-focus"` variant with a `Popover.Close`, keeps
 * focus inside on the same Tab, so this assertion fails there.
 */
export const TabOut: Story = {
  render: (args) => (
    <div style={{ padding: '4rem' }}>
      <Popover {...args} trigger={<Button>Rename</Button>}>
        <Input aria-label="New name" />
      </Popover>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Rename' })
    await userEvent.click(trigger)
    await body().findByRole('dialog')
    await waitFor(() => expect(body().getByRole('textbox', { name: 'New name' })).toHaveFocus())

    await userEvent.tab()
    await expectClosed()
  },
}

/**
 * The control for `TabOut`: the same popup assembled from public parts with
 * `modal="trap-focus"` and a `Popover.Close`. Tab from the last element wraps
 * inside, so the popup stays open. Perturbation: dropping `modal` (back to
 * the non-modal default) closes it on Tab and fails the stays-open check.
 */
export const TabOutTrapped: Story = {
  render: () => (
    <div style={{ padding: '4rem' }}>
      <Popover.Root modal="trap-focus">
        <Popover.Trigger render={<Button>Rename</Button>} />
        <Popover.Popup aria-label="Rename file">
          <Input aria-label="New name" />
          <Popover.Close>Done</Popover.Close>
        </Popover.Popup>
      </Popover.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Rename' })
    await userEvent.click(trigger)
    const dialog = await body().findByRole('dialog')
    const done = within(dialog).getByRole('button', { name: 'Done' })
    await waitFor(() => expect(body().getByRole('textbox', { name: 'New name' })).toHaveFocus())

    await userEvent.tab()
    await waitFor(() => expect(done).toHaveFocus())
    await userEvent.tab()
    // Past the last element focus wraps inside rather than leaving. Give a
    // close time to show up, then check the popup is still open and focused.
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(body().getByRole('dialog')).toBeInTheDocument()
    await expect(dialog.contains(document.activeElement)).toBe(true)

    // Close it so the story's axe scan does not catch it open.
    await userEvent.click(done)
    await expectClosed()
  },
}

/**
 * `aria-label` only, no visible title: the dialog's accessible name is the
 * label. Perturbation: removing the `aria-label` leaves the dialog unnamed and
 * fails the name assertion (and the story's axe scan).
 */
export const Unlabelled: Story = {
  render: () => (
    <div style={{ padding: '4rem' }}>
      <Popover aria-label="Filter options" trigger={<Button>Filter</Button>}>
        <Input aria-label="Keyword" />
      </Popover>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Filter' }))
    const dialog = await body().findByRole('dialog')
    await expect(dialog).toHaveAccessibleName('Filter options')
    await userEvent.keyboard('{Escape}')
    await expectClosed()
  },
}

/**
 * `dismissible` adds an icon dismiss button, named "Close" from the message
 * registry. Clicking it closes the popover. Perturbation: dropping
 * `dismissible` removes the button and fails the lookup.
 */
export const Dismissible: Story = {
  render: (args) => (
    <div style={{ padding: '4rem' }}>
      <Popover {...args} dismissible trigger={<Button>Rename</Button>}>
        <Input aria-label="New name" />
      </Popover>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rename' }))
    const dialog = await body().findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await expectClosed()
  },
}

/**
 * `openOnHover`: hovering opens it and focus stays on the trigger. A keyboard
 * user then opens it with Enter, which moves focus inside. Perturbation:
 * removing `openOnHover` means the hover never opens it and fails the first
 * check; making the hover step a click moves focus inside and fails the
 * focus-stays check.
 */
export const HoverInfotip: Story = {
  render: () => (
    <div style={{ padding: '4rem' }}>
      <Popover
        title="About this field"
        description="Names must be unique."
        openOnHover
        trigger={<Button>Info</Button>}
      >
        <Input aria-label="Name" />
      </Popover>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Info' })

    await step('hover opens it without moving focus', async () => {
      trigger.focus()
      await userEvent.hover(trigger)
      await body().findByRole('dialog', undefined, { timeout: 3000 })
      // Focus stays put even after Base UI has had time to move it.
      await new Promise((resolve) => setTimeout(resolve, 300))
      await expect(trigger).toHaveFocus()
    })

    await step('Escape closes, then Enter opens with focus inside', async () => {
      await userEvent.keyboard('{Escape}')
      await expectClosed()
      await userEvent.unhover(trigger)
      trigger.focus()
      await expect(trigger).toHaveFocus()
      await userEvent.keyboard('{Enter}')
      await body().findByRole('dialog')
      await waitFor(() => expect(body().getByRole('textbox', { name: 'Name' })).toHaveFocus())
      await userEvent.keyboard('{Escape}')
      await expectClosed()
    })
  },
}

/**
 * The default `side` is `bottom`: once open and positioned, the popup's top
 * edge is at or below the trigger's bottom edge. Perturbation: `side="top"`
 * puts it above and fails the edge assertion.
 */
export const Placement: Story = {
  render: (args) => (
    <div style={{ padding: '10rem 6rem' }}>
      <Popover {...args} trigger={<Button>Rename</Button>}>
        <Input aria-label="New name" />
      </Popover>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Rename' })
    await userEvent.click(trigger)
    const dialog = await body().findByRole('dialog')
    await waitFor(() => {
      // Prove Floating UI has positioned it before measuring: an unpositioned
      // popup sits near (0,0), where an edge comparison can pass whatever the side.
      const positioner = dialog.closest('[data-side]')
      expect(positioner?.getAttribute('data-side')).toBe('bottom')
      const p = dialog.getBoundingClientRect()
      const b = trigger.getBoundingClientRect()
      expect(p.width).toBeGreaterThan(0)
      expect(Math.abs(p.left + p.width / 2 - (b.left + b.width / 2))).toBeLessThan(
        Math.max(4, p.width / 2),
      )
      expect(p.top).toBeGreaterThanOrEqual(b.bottom)
    })
    await userEvent.keyboard('{Escape}')
    await expectClosed()
  },
}

/**
 * Two sibling popovers cannot stay open together: pressing B's trigger is an
 * outside press for A, so A closes and B opens. Perturbation: none can keep
 * both open without changing Base UI's dismissal, so the proof is that the
 * assertion tracks which one is open: asserting A's title after the click
 * fails.
 */
export const SiblingsClose: Story = {
  render: () => (
    <div style={{ padding: '4rem', display: 'flex', gap: '1rem' }}>
      <Popover title="Popover A" trigger={<Button>Open A</Button>}>
        <Input aria-label="A field" />
      </Popover>
      <Popover title="Popover B" trigger={<Button>Open B</Button>}>
        <Input aria-label="B field" />
      </Popover>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open A' }))
    await body().findByRole('dialog', { name: 'Popover A' })

    await userEvent.click(canvas.getByRole('button', { name: 'Open B' }))
    await body().findByRole('dialog', { name: 'Popover B' })
    await waitFor(() => expect(body().queryByRole('dialog', { name: 'Popover A' })).toBeNull())
    await expect(body().getAllByRole('dialog')).toHaveLength(1)

    await userEvent.keyboard('{Escape}')
    await expectClosed()
  },
}

/**
 * Built from the public parts only, with no convenience component, to prove
 * the parts compose on their own and the title still names the dialog.
 * Perturbation: omitting `Popover.Title` leaves the dialog unnamed and fails
 * the name assertion. The class check fails if `Popover.Popup` stops applying
 * its recipe.
 */
export const HandAssembled: Story = {
  render: () => (
    <div style={{ padding: '4rem' }}>
      <Popover.Root>
        <Popover.Trigger render={<Button>Rename</Button>} />
        <Popover.Popup>
          <Popover.Title>Rename file</Popover.Title>
          <Popover.Description>Choose a new name for this file.</Popover.Description>
          <Input aria-label="New name" />
          <Popover.Dismiss />
        </Popover.Popup>
      </Popover.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rename' }))
    const dialog = await body().findByRole('dialog', { name: 'Rename file' })
    await expect(dialog.classList.contains(popoverPopupClass)).toBe(true)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await expectClosed()
  },
}
