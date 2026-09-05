import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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
  args: { onClick: fn() },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Save changes' })
    await step('clicking the button invokes the handler', async () => {
      await userEvent.click(button)
      await expect(args.onClick).toHaveBeenCalled()
    })
  },
}

const VARIANTS = ['solid', 'outline', 'ghost'] as const
const TONES = ['action', 'danger'] as const
const SIZES = ['sm', 'md', 'lg'] as const

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {TONES.map((tone) => (
        <div key={tone} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} tone={tone}>
              {variant} {tone}
            </Button>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {SIZES.map((size) => (
          <Button key={size} size={size}>{size}</Button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button disabled>Disabled</Button>
        <Button variant="outline" disabled>Disabled outline</Button>
      </div>
    </div>
  ),
}

export const AsLink: Story = {
  render: () => <Button render={<a href="#top" />}>A real anchor</Button>,
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'A real anchor' })
    // Button derives nativeButton from the render element, so an anchor keeps
    // its link role and gains no tabindex. See CONTRIBUTING, "Base UI's render
    // prop and the nativeButton/anchor-role trap".
    await expect(link).not.toHaveAttribute('tabindex')
    await expect(link).toHaveAttribute('href', '#top')
  },
}
