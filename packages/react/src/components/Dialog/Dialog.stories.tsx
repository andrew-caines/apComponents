import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, waitForElementToBeRemoved, within } from 'storybook/test'
import { Button } from '../Button/Button.js'
import { Dialog } from './Dialog.js'

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'xl', 'fit'] },
    layout: { control: 'inline-radio', options: ['auto', 'dialog'] },
    dismissible: { control: 'boolean' },
  },
  args: {
    title: 'Delete employee',
    description: 'This removes their profile and all associated records.',
    trigger: <Button tone="danger">Delete…</Button>,
    children: <p>This cannot be undone.</p>,
  },
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}

export const Opened: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Delete…' })
    await step('opens, names itself, and returns focus on dismiss', async () => {
      await userEvent.click(trigger)
      // The popup is portalled to the body, so query the document, not the canvas.
      const dialog = await within(document.body).findByRole('dialog')
      await expect(dialog).toHaveAccessibleName('Delete employee')
      await userEvent.keyboard('{Escape}')
      // Base UI keeps the popup mounted through its exit animation
      // (`Dialog.css.ts`'s `exit.fade`, 120ms) and returns focus only once it
      // is actually removed, so the assertion has to wait for that removal
      // rather than checking focus the instant Escape is dispatched.
      await waitForElementToBeRemoved(dialog)
      await waitFor(() => expect(trigger).toHaveFocus())
    })
  },
}

export const OpenForA11yScan: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Delete…' })
    await userEvent.click(trigger)
    // Deliberately left open. The addon-a11y scan runs in an afterEach, i.e.
    // after this play function returns — so any story whose play closes its
    // dialog is scanned only in the closed state, and the closed state proves
    // nothing: the focus trap, the dialog's accessible name and the
    // background's aria-hidden treatment all only exist while it is open.
    // This story is the replacement for the open-dialog scan that
    // showcase/e2e/a11y.spec.ts used to perform before Phase 5a retired it.
    // Do NOT "tidy" this by adding a step that closes the dialog before
    // returning — that would delete this coverage, not clean it up, and the
    // story would keep passing while scanning nothing that matters.
    // The popup is portalled to the body, so query the document, not the canvas.
    await within(document.body).findByRole('dialog')
  },
}

export const WithFooter: Story = {
  args: {
    footer: (
      <>
        <Dialog.Close render={<Button variant="ghost">Cancel</Button>} />
        <Dialog.Close render={<Button tone="danger">Delete</Button>} />
      </>
    ),
  },
}

export const NotDismissible: Story = { args: { dismissible: false } }

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {(['sm', 'md', 'lg', 'xl', 'fit'] as const).map((size) => (
        <Dialog key={size} size={size} title={`Size ${size}`} trigger={<Button>{size}</Button>}>
          <p>A {size} dialog.</p>
        </Dialog>
      ))}
    </div>
  ),
}
