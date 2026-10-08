import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '../components/Button/Button.js'
import { alert, announce, confirm } from './index.js'

/*
 * ReducedMotion is not a story. Searching `*.stories.tsx` for
 * `prefers-reduced-motion` finds no existing reduced-motion story: the token
 * layer cuts `vars.duration.*` to 1ms under reduced motion (`theme.css`), and
 * `packages/motion`'s `reduced-motion.gate.test.ts` covers that. Storybook's
 * browser runner cannot emulate the media feature either.
 */

const meta = {
  title: 'Notifications/Dialogs and announcements',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Every alert dialog in the page, including one that is mid-exit. */
const dialogs = () => Array.from(document.querySelectorAll<HTMLElement>('[role="alertdialog"]'))

const findDialog = () =>
  waitFor(() => {
    const found = dialogs()
    expect(found).toHaveLength(1)
    return found[0] as HTMLElement
  })

/**
 * Closes whatever dialog is open until none is left, so a failed play never
 * leaves one open (or queued) for the next story. Escape resolves a confirm
 * with false and closes an alert.
 */
const clearDialogs = async () => {
  for (let n = 0; n < 5 && dialogs().length > 0; n += 1) {
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(dialogs()).toHaveLength(0), { timeout: 1500 }).catch(() => {})
  }
}

/** Wraps a play so dialogs are cleared even when an assertion throws. */
const cleanPlay =
  <Args extends unknown[]>(run: (...args: Args) => Promise<void>) =>
  async (...args: Args) => {
    try {
      await run(...args)
    } finally {
      await clearDialogs()
    }
  }

/** The longest `animation-duration` or `transition-duration` on the element, in ms. */
const motionMs = (el: HTMLElement) => {
  const style = getComputedStyle(el)
  const parse = (list: string) =>
    Math.max(
      0,
      ...list.split(',').map((part) => (part.trim().endsWith('ms') ? parseFloat(part) : parseFloat(part) * 1000)),
    )
  return Math.max(parse(style.animationDuration), parse(style.transitionDuration))
}

function ConfirmDemo({ tone }: { tone?: 'danger' }) {
  const [result, setResult] = useState('pending')
  return (
    <div style={{ padding: '1rem' }}>
      <Button
        onClick={async () => {
          const ok = await confirm({
            title: 'Delete employee',
            description: 'This cannot be undone.',
            ...(tone ? { tone } : {}),
          })
          setResult(String(ok))
        }}
      >
        Delete
      </Button>
      <p data-testid="result">{result}</p>
    </div>
  )
}

/**
 * `confirm()` opens an `alertdialog` with Confirm focused. A click on the
 * backdrop leaves it open (`disablePointerDismissal`, forced by
 * `AlertDialog.Root`: fact 16). Escape closes it, resolves `false`, and focus
 * returns to "Delete". Perturbation: building `DialogHost` on `Dialog.Root`
 * instead of `AlertDialog.Root` makes the backdrop click close the dialog and
 * fails the still-open check (and the `alertdialog` role query).
 */
export const Confirm: Story = {
  render: () => <ConfirmDemo />,
  play: cleanPlay(async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Delete' })
    await userEvent.click(trigger)

    const dialog = await findDialog()
    await expect(dialog).toHaveAccessibleName('Delete employee')
    const confirmButton = within(dialog).getByRole('button', { name: 'Confirm' })
    await waitFor(() => expect(confirmButton).toHaveFocus())

    // A point beside the popup, still inside the viewport, is a backdrop press.
    const rect = dialog.getBoundingClientRect()
    const x = Math.max(2, rect.left / 2)
    const y = rect.top + rect.height / 2
    const outside = document.elementFromPoint(x, y) as HTMLElement
    await expect(dialog.contains(outside)).toBe(false)
    await userEvent.click(outside)
    // Negative check, bounded by the dialog's real motion duration plus a 200ms margin.
    await new Promise((resolve) => setTimeout(resolve, motionMs(dialog) + 200))
    await expect(dialogs()).toHaveLength(1)
    await expect(canvas.getByTestId('result')).toHaveTextContent('pending')

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(canvas.getByTestId('result')).toHaveTextContent('false'))
    await waitFor(() => expect(dialogs()).toHaveLength(0))
    await waitFor(() => expect(trigger).toHaveFocus())
  }),
}

/**
 * `tone: 'danger'` focuses Cancel (the safe choice) and fills Confirm with the
 * danger background. The play compares against a danger and an action Button
 * rendered in the canvas. Perturbation: dropping the `tone` from the host's
 * confirm Button fails the background comparison; pointing `initialFocus` back
 * at the confirm ref fails the Cancel focus check.
 */
export const DangerConfirm: Story = {
  render: () => (
    <div>
      <ConfirmDemo tone="danger" />
      <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
        <Button tone="danger">Danger reference</Button>
        <Button tone="action">Action reference</Button>
      </div>
    </div>
  ),
  play: cleanPlay(async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }))
    const dialog = await findDialog()
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
    await waitFor(() => expect(cancel).toHaveFocus())

    const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor
    const confirmBg = bg(within(dialog).getByRole('button', { name: 'Confirm' }))
    const danger = bg(canvas.getByRole('button', { name: 'Danger reference', hidden: true }))
    const action = bg(canvas.getByRole('button', { name: 'Action reference', hidden: true }))
    await expect(danger).not.toBe(action)
    await expect(confirmBg).toBe(danger)
  }),
}

function QueuedDemo() {
  const [log, setLog] = useState<string[]>([])
  return (
    <div style={{ padding: '1rem' }}>
      <Button
        onClick={() => {
          for (const title of ['First', 'Second']) {
            void confirm({ title }).then((ok) => setLog((prev) => [...prev, `${title}:${ok}`]))
          }
        }}
      >
        Ask twice
      </Button>
      <p data-testid="log">{log.join(',')}</p>
    </div>
  )
}

/**
 * One click fires two confirms. Only the first shows. Answering it brings up
 * the second only after the first has finished leaving, so the two are never
 * in the DOM together. The second is cancelled, and the log reads both answers
 * in order. Perturbation: shifting the queue in `onOpenChange` instead of
 * `onOpenChangeComplete` in `DialogHost.tsx` drops the first without its exit
 * and fails the exit-seen check.
 */
export const Queued: Story = {
  render: () => <QueuedDemo />,
  play: cleanPlay(async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Ask twice' }))

    const first = await findDialog()
    await expect(first).toHaveAccessibleName('First')
    // Sample the DOM on every mutation: the first must be seen exiting, and
    // must already be gone from the DOM when the second first appears.
    let firstExited = false
    let firstGoneWhenSecondAppeared: boolean | undefined
    const observer = new MutationObserver(() => {
      if (first.hasAttribute('data-ending-style')) firstExited = true
      if (firstGoneWhenSecondAppeared === undefined && dialogs().some((el) => el !== first)) {
        firstGoneWhenSecondAppeared = !first.isConnected
      }
    })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true })
    await userEvent.click(within(first).getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(canvas.getByTestId('log')).toHaveTextContent('First:true'))
    await waitFor(() => expect(firstGoneWhenSecondAppeared).toBeDefined())
    observer.disconnect()
    await expect(firstExited).toBe(true)
    await expect(firstGoneWhenSecondAppeared).toBe(true)
    const second = await findDialog()
    await expect(second).toHaveAccessibleName('Second')
    await userEvent.click(within(second).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(canvas.getByTestId('log')).toHaveTextContent('First:true,Second:false'))
    await waitFor(() => expect(dialogs()).toHaveLength(0))
  }),
}

function AlertDemo() {
  const [done, setDone] = useState('waiting')
  return (
    <div style={{ padding: '1rem' }}>
      <Button
        onClick={async () => {
          await alert({ title: 'Saved', description: 'Your changes are saved.' })
          setDone('acknowledged')
        }}
      >
        Notify
      </Button>
      <p data-testid="done">{done}</p>
    </div>
  )
}

/**
 * `alert()` focuses OK, and Enter on it resolves the promise, closes the
 * dialog and returns focus to the trigger. Perturbation: removing
 * `request.resolve()` from the host's `answer` leaves the text on "waiting"
 * and fails the resolution check; making `okRef` unreachable (no ref on the
 * OK Button) moves focus to the first tabbable and fails the focus check only
 * if that is not OK, so the resolution check is the load-bearing one.
 */
export const Alert: Story = {
  render: () => <AlertDemo />,
  play: cleanPlay(async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Notify' })
    await userEvent.click(trigger)
    const dialog = await findDialog()
    const ok = within(dialog).getByRole('button', { name: 'OK' })
    await waitFor(() => expect(ok).toHaveFocus())
    await expect(canvas.getByTestId('done')).toHaveTextContent('waiting')

    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(canvas.getByTestId('done')).toHaveTextContent('acknowledged'))
    await waitFor(() => expect(dialogs()).toHaveLength(0))
    await waitFor(() => expect(trigger).toHaveFocus())
  }),
}

/** The provider's polite live region. The toast viewport is also `aria-live="polite"`, but it has a role. */
const politeRegion = () =>
  document.querySelector<HTMLElement>('div[aria-live="polite"][aria-atomic="true"]:not([role])')

/**
 * `announce()` shows nothing, but within a frame the polite region's text is
 * the message, and the region is visually hidden: a 1x1 box clipped with
 * `clip-path`. Perturbation: dropping `visuallyHiddenClass` from `LiveRegions`
 * fails the size and clip-path checks; removing the `set(message)` in the
 * animation frame fails the text check.
 */
export const Announce: Story = {
  render: () => (
    <div style={{ padding: '1rem' }}>
      <Button onClick={() => announce('Three results found')}>Announce</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(politeRegion()).not.toBeNull()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Announce' }))
    await waitFor(() => expect(politeRegion()?.textContent).toBe('Three results found'), { timeout: 500 })

    const region = politeRegion() as HTMLElement
    const box = region.getBoundingClientRect()
    await expect(box.width).toBe(1)
    await expect(box.height).toBe(1)
    await expect(getComputedStyle(region).clipPath).toBe('inset(50%)')
  },
}
