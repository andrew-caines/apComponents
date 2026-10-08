import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { banner, toast } from '../../notifications/index.js'
import { Button } from '../Button/Button.js'
import { BannerRegion } from './BannerRegion.js'

const meta = {
  title: 'Components/Banner',
  component: BannerRegion,
} satisfies Meta<typeof BannerRegion>

export default meta
type Story = StoryObj<typeof meta>

const body = () => within(document.body)

/** Raises banners from a mount effect, the way a page does, and closes them on unmount. */
function Raise({ onRaise }: { onRaise: () => Array<{ close(): void }> }) {
  useEffect(() => {
    const handles = onRaise()
    return () => handles.forEach((handle) => handle.close())
    // The set is raised once per mount.
  }, [])
  return null
}

/**
 * Each severity in a region at the top of the story. Info, success and warning
 * are `role="status"`, error is `role="alert"`, and each shows its title,
 * description and a dismiss button. Dismissing one removes it.
 * Perturbation: rendering every banner with `role="status"` in
 * `BannerRegion.tsx` leaves no `alert` and fails the role query.
 */
export const Default: Story = {
  render: () => (
    <div style={{ padding: '1rem' }}>
      <BannerRegion />
      <Raise
        onRaise={() => [
          banner({ title: 'Info banner', description: 'For your information.', severity: 'info' }),
          banner({ title: 'Success banner', description: 'It worked.', severity: 'success' }),
          banner({ title: 'Warning banner', description: 'Take care.', severity: 'warning' }),
          banner({ title: 'Error banner', description: 'It failed.', severity: 'error' }),
        ]}
      />
    </div>
  ),
  play: async () => {
    const statuses = await body().findAllByRole('status')
    await waitFor(() =>
      expect(statuses.map((el) => el.textContent)).toEqual([
        expect.stringContaining('Info banner'),
        expect.stringContaining('Success banner'),
        expect.stringContaining('Warning banner'),
      ]),
    )
    const alert = await body().findByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toHaveTextContent('Error banner')
    await expect(alert).toHaveTextContent('It failed.')
    for (const el of [...statuses, alert]) await expect(el).toBeVisible()

    await userEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(body().queryByRole('alert')).toBeNull())
    await expect(body().getAllByRole('status')).toHaveLength(3)
  },
}

/**
 * Raising a banner with the same id replaces it in place: still one banner,
 * with the new content. Perturbation: appending instead of replacing in
 * `banners.ts` leaves two banners and fails the count.
 */
export const Replace: Story = {
  render: () => {
    const [count, setCount] = useState(0)
    return (
      <div style={{ padding: '1rem' }}>
        <BannerRegion />
        <Button
          onClick={() => {
            const next = count + 1
            setCount(next)
            banner({ id: 'sync', title: `Sync attempt ${next}`, severity: 'warning' })
          }}
        >
          Raise
        </Button>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const raise = within(canvasElement).getByRole('button', { name: 'Raise' })
    await userEvent.click(raise)
    await expect(await body().findByRole('status')).toHaveTextContent('Sync attempt 1')

    await userEvent.click(raise)
    await waitFor(() => expect(body().getByRole('status')).toHaveTextContent('Sync attempt 2'))
    await expect(body().getAllByRole('status')).toHaveLength(1)
    await expect(body().queryByText('Sync attempt 1')).toBeNull()

    await userEvent.click(within(body().getByRole('status')).getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(body().queryByRole('status')).toBeNull())
  },
}

/**
 * `dismissible: false` renders no dismiss button, and the banner stays.
 * Perturbation: ignoring `dismissible` in `BannerRegion.tsx` renders the
 * button and fails the absence check.
 */
export const NotDismissible: Story = {
  render: () => (
    <div style={{ padding: '1rem' }}>
      <BannerRegion />
      <Raise
        onRaise={() => [
          banner({
            title: 'Maintenance tonight',
            description: 'Read-only from 22:00.',
            severity: 'info',
            dismissible: false,
          }),
        ]}
      />
    </div>
  ),
  play: async () => {
    const status = await body().findByRole('status')
    await expect(status).toBeVisible()
    await expect(status).toHaveTextContent('Maintenance tonight')
    await expect(status).toHaveTextContent('Read-only from 22:00.')
    await expect(within(status).queryByRole('button')).toBeNull()
  },
}

/**
 * No `BannerRegion` in the story: `banner()` falls back to a toast, with the
 * same title and content (and a development warning, silenced here).
 * Perturbation: dropping the fallback in `NotificationProvider.tsx` shows
 * nothing and fails the toast lookup.
 */
export const FallbackToToast: Story = {
  render: () => (
    <div style={{ padding: '1rem' }}>
      <Button onClick={() => banner({ title: 'No region here', description: 'Shown as a toast.' })}>
        Raise
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Raise' }))
      const dialog = await body().findByRole('dialog', { name: 'No region here' })
      // The toast fades in from opacity 0, which `toBeVisible` counts as hidden.
      await waitFor(() => expect(dialog).toBeVisible())
      await expect(dialog).toHaveTextContent('Shown as a toast.')
      await expect(body().queryByRole('status')).toBeNull()
    } finally {
      warn.mockRestore()
      toast.close()
      await waitFor(() => expect(body().queryByRole('dialog')).toBeNull(), { timeout: 3000 })
    }
  },
}
