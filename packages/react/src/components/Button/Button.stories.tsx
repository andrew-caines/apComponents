import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Button } from './Button.js'

const meta = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'inline-radio', options: ['solid', 'outline', 'ghost'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    tone: { control: 'inline-radio', options: ['action', 'danger'] },
    disabled: { control: 'boolean' },
  },
  args: { children: 'Save changes' },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Clickable: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Save changes' })
    await step('the button is reachable and activates', async () => {
      await userEvent.click(button)
      await expect(button).toHaveFocus()
    })
  },
}
