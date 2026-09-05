import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Spinner } from './Spinner.js'

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] },
  },
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      {(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const).map((size) => (
        <Spinner key={size} size={size} />
      ))}
      <Spinner size={48} />
    </div>
  ),
}

export const Labelled: Story = {
  args: { label: 'Loading results' },
  play: async ({ canvasElement }) => {
    // Decorative by default; a label makes it an img with a name. Never both.
    const spinner = within(canvasElement).getByRole('img', { name: 'Loading results' })
    await expect(spinner).not.toHaveAttribute('aria-hidden')
  },
}

export const InheritsColour: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', color: 'crimson' }}>
      <Spinner size="lg" />
      <span style={{ color: 'rebeccapurple' }}><Spinner size="lg" /></span>
    </div>
  ),
}
