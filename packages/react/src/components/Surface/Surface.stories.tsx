import type { Meta, StoryObj } from '@storybook/react-vite'
import { Surface } from './Surface.js'

const meta = {
  title: 'Components/Surface',
  component: Surface,
  argTypes: {
    tone: { control: 'inline-radio', options: ['canvas', 'surface', 'raised'] },
    pad: { control: 'inline-radio', options: ['none', 'sm', 'md', 'lg'] },
  },
  args: { children: 'Surface content' },
} satisfies Meta<typeof Surface>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Tones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <Surface tone="canvas">canvas</Surface>
      <Surface tone="surface">surface</Surface>
      <Surface tone="raised">raised</Surface>
    </div>
  ),
}

export const Padding: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      <Surface pad="none">none</Surface>
      <Surface pad="sm">sm</Surface>
      <Surface pad="md">md</Surface>
      <Surface pad="lg">lg</Surface>
    </div>
  ),
}

export const Nested: Story = {
  render: () => (
    <Surface tone="canvas">
      <Surface tone="surface">
        <Surface tone="raised">Three deep</Surface>
      </Surface>
    </Surface>
  ),
}
