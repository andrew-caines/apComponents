import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Icon } from './Icon.js'
import { ICON_PATHS, type IconName } from './paths.js'

const meta = {
  title: 'Components/Icon',
  component: Icon,
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] },
  },
  args: { name: 'check' },
} satisfies Meta<typeof Icon>

export default meta
type Story = StoryObj<typeof meta>

export const Decorative: Story = {
  args: { name: 'check' },
  play: async ({ canvasElement }) => {
    // No label -> hidden from assistive technology, and no accessible name.
    // getByRole('img', ...) would never find this node, so the contract is
    // asserted directly against the rendered <svg>.
    const svg = canvasElement.querySelector('svg')!
    await expect(svg).toHaveAttribute('aria-hidden', 'true')
    await expect(svg).not.toHaveAttribute('role')
    await expect(svg).not.toHaveAttribute('aria-label')
  },
}

export const Labelled: Story = {
  args: { name: 'check', label: 'Saved' },
  play: async ({ canvasElement }) => {
    // A label makes the icon an image with an accessible name — and, never
    // both, it is no longer hidden from assistive technology.
    const img = within(canvasElement).getByRole('img', { name: 'Saved' })
    await expect(img).not.toHaveAttribute('aria-hidden')
  },
}

const NAMES = Object.keys(ICON_PATHS) as IconName[]
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const

export const AllIconsAtSeveralSizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {SIZES.map((size) => (
        <div key={size} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ width: '2.5rem', fontFamily: 'monospace' }}>{size}</span>
          {NAMES.map((name) => (
            <span key={name} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              {/* Decorative here: the adjacent text already names the icon. */}
              <Icon name={name} size={size} />
              <span style={{ fontFamily: 'monospace', fontSize: '0.75em' }}>{name}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
}
