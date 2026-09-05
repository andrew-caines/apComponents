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
