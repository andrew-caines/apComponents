import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ICONS, IconGallery } from './IconGallery.js'

const meta = {
  // Not 'Icons/Icon set/…': the MDX page owns 'Icons/Icon set', and a docs leaf
  // cannot also be a story group.
  title: 'Icons/Gallery',
  component: IconGallery,
} satisfies Meta<typeof IconGallery>
export default meta
type Story = StoryObj<typeof meta>

const cards = (root: HTMLElement) => root.querySelectorAll('li[data-icon]')

/** Every icon in @ap/icons, outline only. */
export const Outline: Story = {
  play: async ({ canvasElement }) => {
    await expect(cards(canvasElement)).toHaveLength(ICONS.length)
    // Outline: each svg has exactly one <g> (the stroked primary layer).
    for (const svg of canvasElement.querySelectorAll('li[data-icon] svg')) {
      await expect(svg.querySelectorAll(':scope > g')).toHaveLength(1)
    }
  },
}

/** Every icon with its duotone layer on. */
export const Duotone: Story = {
  args: { initialDuoTone: true },
  play: async ({ canvasElement }) => {
    // Duotone: every built-in has a secondary layer, so each svg gains a second <g>.
    for (const svg of canvasElement.querySelectorAll('li[data-icon] svg')) {
      await expect(svg.querySelectorAll(':scope > g')).toHaveLength(2)
    }
  },
}

/** The filter narrows by icon name or export name. */
export const Filter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: 'Filter icons' }), 'check')
    const names = [...cards(canvasElement)].map((li) => li.getAttribute('data-icon'))
    await expect(names).toEqual(['check', 'check-circle'])
    await expect(canvas.getByTestId('icon-summary')).toHaveTextContent(`2 of ${ICONS.length} icons`)
  },
}
