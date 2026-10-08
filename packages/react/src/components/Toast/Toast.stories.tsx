import { useEffect, useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Toast as BaseToast } from '@base-ui/react/toast'
import { cssKeyframeName } from '@ap/motion'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { toast } from '../../notifications/index.js'
import { ICON_PATHS } from '../../icons/paths.js'
import { SEVERITY_ICON } from '../../notifications/severity.js'
import { vars } from '../../theme/contract.css.js'
import { Button } from '../Button/Button.js'
import { Toast } from './Toast.js'
import type { ToastPlacement } from './ToastParts.js'

/*
 * ForcedColors is not a story. Storybook's browser runner cannot emulate
 * `forced-colors: active` (it is a Playwright `emulateMedia` option that the
 * story runner does not expose), so the 1px border that keeps a toast visible
 * under forced colours is left to the fixture e2e.
 */

const meta = {
  title: 'Components/Toast',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const body = () => within(document.body)

/** The `space.4` margin the viewport keeps from the screen edge, resolved to px by laying out a probe. */
const marginPx = () => {
  const probe = document.createElement('div')
  probe.style.inlineSize = vars.space['4']
  document.body.append(probe)
  const px = probe.getBoundingClientRect().width
  probe.remove()
  return px
}

const EDGE_TOLERANCE = 2

/** Every toast Root in the page, including limited and ending ones. */
const roots = () => Array.from(document.querySelectorAll<HTMLElement>('[data-placement]'))

/**
 * The Root whose title is `title`. A high-priority toast also has a visually
 * hidden `role="alert"` copy of its title, so go through the Root.
 */
const rootTitled = (title: string) =>
  roots().find((root) => root.querySelector('[id]')?.textContent === title) ?? null

const findRoot = (title: string) =>
  waitFor(() => {
    const root = rootTitled(title)
    expect(root).not.toBeNull()
    return root as HTMLElement
  })

/** Let the entrance finish, so a bounding box is the resting one. */
const settle = async (el: HTMLElement) => {
  await Promise.all(el.getAnimations().map((animation) => animation.finished))
}

/** Close everything and wait until no Root is left, so the axe scan never sees a toast mid-exit. */
const clearToasts = async () => {
  toast.close()
  await waitFor(() => expect(roots()).toHaveLength(0), { timeout: 3000 })
}

/** The leading glyph wrapper (`toastIconRecipe`): the Root's first child, so the Close button's own icon never matches. */
const glyphOf = (root: HTMLElement) => root.firstElementChild as HTMLElement

/** Path data of the leading glyph, or null when it is a Spinner or absent. */
const glyphPath = (root: HTMLElement) => glyphOf(root).querySelector('svg path')?.getAttribute('d') ?? null

/** Wraps a play so the shared manager's toasts are cleared even when an assertion throws. */
const cleanPlay =
  <Args extends unknown[]>(run: (...args: Args) => Promise<void>) =>
  async (...args: Args) => {
    try {
      await run(...args)
    } finally {
      toast.close()
      await waitFor(() => expect(roots()).toHaveLength(0), { timeout: 3000 }).catch(() => {})
    }
  }

const animationName = (el: HTMLElement) => getComputedStyle(el).animationName

/** Sets the page direction for the story and restores it on unmount. */
function PageDirection({ dir, children }: { dir: 'ltr' | 'rtl'; children: ReactNode }) {
  useEffect(() => {
    const previous = document.documentElement.dir
    document.documentElement.dir = dir
    return () => {
      document.documentElement.dir = previous
    }
  }, [dir])
  return <>{children}</>
}

/**
 * A hand-assembled stack from the public parts, under its own Base UI provider
 * (which shadows the global one for this subtree). `Show <label>` adds one toast.
 */
function Assembled({
  placement,
  label,
  withActions = false,
}: {
  placement: ToastPlacement
  label: string
  withActions?: boolean
}) {
  return (
    <BaseToast.Provider>
      <AssembledInner placement={placement} label={label} withActions={withActions} />
    </BaseToast.Provider>
  )
}

function AssembledInner({
  placement,
  label,
  withActions,
}: {
  placement: ToastPlacement
  label: string
  withActions: boolean
}) {
  const { toasts, add } = BaseToast.useToastManager()
  return (
    <>
      <Button
        onClick={() =>
          add({
            title: label,
            description: 'Assembled from the parts.',
            timeout: 0,
            ...(withActions ? { actionProps: { children: 'Undo' } } : {}),
          })
        }
      >
        {`Show ${label}`}
      </Button>
      <Toast.Viewport placement={placement}>
        {toasts.map((item) => (
          <Toast.Root key={item.id} toast={item} placement={placement}>
            <Toast.Title />
            <Toast.Description />
            {withActions ? <Toast.Action render={<Button size="sm" variant="outline" />} /> : null}
            <Toast.Close render={<Button size="sm" variant="ghost" />} />
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </>
  )
}

/**
 * One button per severity. Each toast shows its glyph, and the error toast's
 * border-inline-start colour differs from the info toast's, so the
 * `[data-type]` accents are really applied. Perturbations: removing the
 * severity glyph from `ToastList.tsx` fails the glyph-path check; dropping the
 * `[data-type="error"]` rule in `Toast.css.ts` leaves the error edge on the
 * info colour and fails the colour comparison.
 */
export const Severities: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem' }}>
      <Button onClick={() => toast.info('Info title')}>Info</Button>
      <Button onClick={() => toast.success('Success title')}>Success</Button>
      <Button onClick={() => toast.warning('Warning title')}>Warning</Button>
      <Button onClick={() => toast.error('Error title')}>Error</Button>
    </div>
  ),
  play: cleanPlay(async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const edge: Record<string, string> = {}

    for (const [name, title] of [
      ['Info', 'Info title'],
      ['Success', 'Success title'],
      ['Warning', 'Warning title'],
      ['Error', 'Error title'],
    ] as const) {
      await userEvent.click(canvas.getByRole('button', { name }))
      const root = await findRoot(title)
      await expect(root.getAttribute('data-type')).toBe(name.toLowerCase())
      // The leading glyph is decorative, but it must be there and be this severity's.
      const glyph = glyphOf(root).querySelector('svg')
      await expect(glyph?.getAttribute('aria-hidden')).toBe('true')
      await expect(glyphPath(root)).toBe(ICON_PATHS[SEVERITY_ICON[name.toLowerCase() as keyof typeof SEVERITY_ICON]])
      const style = getComputedStyle(root)
      await expect(style.borderInlineStartWidth).toBe('4px')
      edge[name] = style.borderInlineStartColor
      await clearToasts()
    }

    await expect(edge['Error']).not.toBe(edge['Info'])
  }),
}

/** A story per placement: the toast sits `margin` from the named edges, and centred when `center`. */
function placementStory(placement: ToastPlacement): Story {
  const [block, inline] = placement.split('-') as ['top' | 'bottom', 'start' | 'center' | 'end']
  return {
    parameters: { notifications: { placement } },
    render: () => (
      <div style={{ padding: '1rem' }}>
        <Button onClick={() => toast({ title: 'Placed', timeout: 0 })}>Show toast</Button>
      </div>
    ),
    play: cleanPlay(async ({ canvasElement }) => {
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show toast' }))
      const root = await findRoot('Placed')
      await settle(root)

      const rect = root.getBoundingClientRect()
      const width = document.documentElement.clientWidth
      const height = document.documentElement.clientHeight
      const margin = marginPx()

      const fromBlockEdge = block === 'top' ? rect.top : height - rect.bottom
      await expect(Math.abs(fromBlockEdge - margin)).toBeLessThanOrEqual(EDGE_TOLERANCE)

      if (inline === 'center') {
        await expect(Math.abs(rect.left + rect.width / 2 - width / 2)).toBeLessThanOrEqual(
          EDGE_TOLERANCE,
        )
      } else {
        // The page is left-to-right, so start is the physical left-hand edge.
        const fromInlineEdge = inline === 'start' ? rect.left : width - rect.right
        await expect(Math.abs(fromInlineEdge - margin)).toBeLessThanOrEqual(EDGE_TOLERANCE)
      }
    }),
  }
}

/**
 * Top, start-aligned. Perturbation: removing `insetInlineStart` from the
 * `top-start` variant in `Toast.css.ts` drops the box away from the start
 * edge and fails the distance check. The other five placement stories fail
 * the same way when their variant is deleted or given a physical inset.
 */
export const PlacementTopStart: Story = placementStory('top-start')
/** Top, centred. Perturbation: dropping `marginInline: 'auto'` from the `top-center` variant fails the centre-line check. */
export const PlacementTopCenter: Story = placementStory('top-center')
/** Top, end-aligned. Perturbation: swapping `top-end`'s `insetInlineEnd` for `insetInlineStart` fails the end-edge check. */
export const PlacementTopEnd: Story = placementStory('top-end')
/** Bottom, start-aligned. Perturbation: deleting the `bottom-start` variant fails the bottom-edge check. */
export const PlacementBottomStart: Story = placementStory('bottom-start')
/** Bottom, centred. Perturbation: dropping `marginInline: 'auto'` from the `bottom-center` variant fails the centre-line check. */
export const PlacementBottomCenter: Story = placementStory('bottom-center')
/** Bottom, end-aligned (the default). Perturbation: swapping `bottom-end`'s `insetInlineEnd` for `insetInlineStart` fails the end-edge check. */
export const PlacementBottomEnd: Story = placementStory('bottom-end')

/**
 * Review Focus 5. The page is right-to-left and the placement is `bottom-end`.
 * The toast sits at the physical left-hand edge, does not use `toast.slide-in` (a
 * physical `translateX(100%)` would fly it in from the wrong edge), and a
 * short drag toward the physical left-hand side sets `data-swipe-direction="left"`,
 * which proves `ToastList` read the direction from the DOM. Then two
 * hand-assembled toasts are checked while the page is flipped to left-to-right:
 * `bottom-end` uses `toast.slide-in` and `bottom-start` does not.
 * Perturbation: dropping the `[data-placement$="-end"]:dir(rtl)` override in
 * `Toast.css.ts` leaves `toast.slide-in` on the right-to-left toast and fails
 * the first animation-name check.
 */
export const RightToLeft: Story = {
  decorators: [
    (Story) => (
      <PageDirection dir="rtl">
        <Story />
      </PageDirection>
    ),
  ],
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem' }}>
      <Button onClick={() => toast({ title: 'Docked', timeout: 0 })}>Show docked</Button>
      <Assembled placement="bottom-end" label="end probe" />
      <Assembled placement="bottom-start" label="start probe" />
    </div>
  ),
  play: cleanPlay(async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'))
    const slideIn = cssKeyframeName('toast.slide-in')

    await userEvent.click(canvas.getByRole('button', { name: 'Show docked' }))
    const root = await findRoot('Docked')
    await expect(animationName(root)).not.toBe(slideIn)
    await expect(animationName(root)).toBe(cssKeyframeName('enter.fade-rise'))
    await settle(root)
    // `end` in a right-to-left page is the physical left-hand edge.
    await expect(
      Math.abs(root.getBoundingClientRect().left - marginPx()),
    ).toBeLessThanOrEqual(EDGE_TOLERANCE)

    // Swipe direction, read from the page direction (`ToastList` reads the viewport's parent once).
    const rect = root.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const user = userEvent.setup()
    await user.pointer([
      { keys: '[MouseLeft>]', target: root, coords: { clientX: x, clientY: y } },
      { target: root, coords: { clientX: x - 10, clientY: y } },
      { target: root, coords: { clientX: x - 20, clientY: y } },
    ])
    await waitFor(() => expect(root.getAttribute('data-swipe-direction')).toBe('left'))
    await user.pointer({ keys: '[/MouseLeft]' })
    await clearToasts()

    // The same parts, with the page direction flipped under them.
    await userEvent.click(canvas.getByRole('button', { name: 'Show end probe' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Show start probe' }))
    const end = await findRoot('end probe')
    const start = await findRoot('start probe')
    await expect(animationName(end)).toBe(cssKeyframeName('enter.fade-rise'))
    await expect(animationName(start)).toBe(cssKeyframeName('enter.fade-rise'))

    document.documentElement.dir = 'ltr'
    try {
      await expect(animationName(end)).toBe(slideIn)
      await expect(animationName(start)).not.toBe(slideIn)
    } finally {
      document.documentElement.dir = 'rtl'
    }

    for (const probe of [end, start]) {
      await userEvent.click(within(probe).getByLabelText('Dismiss'))
    }
    await waitFor(() => expect(roots()).toHaveLength(0), { timeout: 3000 })
  }),
}

/**
 * The exit runs on `[data-ending-style]`. After Close is clicked the Root is
 * still in the DOM, carries that attribute, and its computed
 * `animation-name` is the exit keyframe (`toast.slide-out` at `bottom-end`
 * in a left-to-right page); only then is it removed
 * (`toast/root/ToastRoot.js:106-114` waits on `getAnimations()`). A
 * MutationObserver samples the name at the instant the attribute appears.
 * Perturbation: keying the exit rules on `[data-closed]` instead of
 * `[data-ending-style]` leaves the entrance animation on the ending Root and
 * fails the name check.
 */
export const Motion: Story = {
  render: () => (
    <div style={{ padding: '1rem' }}>
      <Button onClick={() => toast({ title: 'Leaving', timeout: 0 })}>Show toast</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show toast' }))
    const root = await findRoot('Leaving')
    await settle(root)
    await expect(animationName(root)).toBe(cssKeyframeName('toast.slide-in'))

    let nameWhenEnding: string | undefined
    const observer = new MutationObserver(() => {
      if (nameWhenEnding === undefined && root.hasAttribute('data-ending-style')) {
        nameWhenEnding = animationName(root)
      }
    })
    observer.observe(root, { attributes: true, attributeFilter: ['data-ending-style'] })

    // Base UI marks the close button aria-hidden until the stack is expanded
    // (`toast/close/ToastClose.js:49`).
    await userEvent.click(within(root).getByLabelText('Dismiss'))

    await waitFor(() => expect(nameWhenEnding).toBeDefined())
    observer.disconnect()
    await expect(nameWhenEnding).toBe(cssKeyframeName('toast.slide-out'))
    await waitFor(() => expect(root.isConnected).toBe(false))
  },
}

/**
 * Five toasts leave three visible: the two oldest are `[data-limited]`, hidden
 * with `display: none` and `inert` (`toast/root/ToastRoot.js:431`). Closing a
 * visible toast reveals the next oldest. Perturbation: removing the
 * `[data-limited]` rule from `Toast.css.ts` leaves all five displayed and
 * fails the display check.
 */
export const Overflow: Story = {
  render: () => (
    <div style={{ padding: '1rem' }}>
      <Button
        onClick={() => {
          for (let n = 1; n <= 5; n += 1) toast({ title: `Toast ${n}`, timeout: 0 })
        }}
      >
        Show five
      </Button>
    </div>
  ),
  play: cleanPlay(async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show five' }))
    await waitFor(() => expect(roots()).toHaveLength(5))

    const limited = roots().filter((root) => root.hasAttribute('data-limited'))
    await expect(limited).toHaveLength(2)
    await expect(limited).toContain(rootTitled('Toast 1'))
    await expect(limited).toContain(rootTitled('Toast 2'))
    for (const root of limited) {
      await expect(getComputedStyle(root).display).toBe('none')
      await expect(root.hasAttribute('inert')).toBe(true)
    }
    await expect(body().getAllByRole('dialog')).toHaveLength(3)

    const newest = rootTitled('Toast 5') as HTMLElement
    await userEvent.click(within(newest).getByLabelText('Dismiss'))
    await waitFor(() => expect(newest.isConnected).toBe(false))
    await waitFor(() => expect(body().getAllByRole('dialog')).toHaveLength(3))
    const revealed = rootTitled('Toast 2') as HTMLElement
    await expect(revealed.hasAttribute('data-limited')).toBe(false)
    await expect(getComputedStyle(revealed).display).not.toBe('none')
  }),
}

/**
 * At `bottom-end` a drag of 80px toward the inline end dismisses the toast.
 * Base UI starts a drag on `pointerdown` and calls `setPointerCapture`
 * (`toast/root/ToastRoot.js:227-271`), follows `pointermove`, and on release
 * closes it when the displacement passes 40px (`:33`, `:210-217`). The play
 * drives it with `userEvent.pointer`. First a 20px drag is released: the
 * toast stays, and its entrance must not replay (no `animationstart` after the
 * entrance has settled), because `[data-swiping]` holds the animation at
 * `animation-duration: 0s` rather than switching its name. Perturbation:
 * changing that rule to `animation: 'none'` restarts the entrance on release
 * and fails the no-`animationstart` check.
 */
export const Swipe: Story = {
  render: () => (
    <div style={{ padding: '1rem' }}>
      <Button onClick={() => toast({ title: 'Swipe me', timeout: 0 })}>Show toast</Button>
    </div>
  ),
  play: cleanPlay(async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show toast' }))
    const root = await findRoot('Swipe me')
    await settle(root)

    const rect = root.getBoundingClientRect()
    const y = rect.top + rect.height / 2
    // Away from the buttons: a swipe ignores a press that starts on one.
    const x = rect.left + 60
    // Read before swiping: `[data-swiping]` holds the duration at 0s.
    const entryMs = parseFloat(getComputedStyle(root).animationDuration) * 1000
    await expect(entryMs).toBeGreaterThan(0)
    let restarts = 0
    root.addEventListener('animationstart', () => {
      restarts += 1
    })

    // One `setup()` instance: pressed-button state does not survive across `userEvent.pointer` calls.
    const user = userEvent.setup()
    await user.pointer([
      { keys: '[MouseLeft>]', target: root, coords: { clientX: x, clientY: y } },
      { target: root, coords: { clientX: x + 10, clientY: y } },
      { target: root, coords: { clientX: x + 20, clientY: y } },
    ])
    await waitFor(() => expect(root.getAttribute('data-swipe-direction')).toBe('right'))
    await user.pointer({ keys: '[/MouseLeft]' })
    // Bound for "does not happen": a replay would start within a frame of the
    // release and run for the entry duration, so wait that long plus 200ms.
    await new Promise((resolve) => setTimeout(resolve, entryMs + 200))
    await expect(root.isConnected).toBe(true)
    await expect(root.hasAttribute('data-ending-style')).toBe(false)
    await expect(restarts).toBe(0)

    // The first `pointermove` re-bases the drag origin (`ToastRoot.js:280-287`),
    // so a lead-in move precedes the 80px.
    await user.pointer([
      { keys: '[MouseLeft>]', target: root, coords: { clientX: x, clientY: y } },
      { target: root, coords: { clientX: x + 1, clientY: y } },
      { target: root, coords: { clientX: x + 41, clientY: y } },
      { target: root, coords: { clientX: x + 81, clientY: y } },
    ])
    await user.pointer({ keys: '[/MouseLeft]' })
    await waitFor(() => expect(root.isConnected).toBe(false), { timeout: 3000 })
  }),
}

/**
 * A hand-assembled toast whose `Action` and `Close` take `render={<Button />}`
 * logs no console error. Perturbation: passing a non-button element to
 * `render` on `Action` without `nativeButton={false}` makes Base UI log its
 * native-button mismatch error and fails the spy check.
 */
export const WithButtonParts: Story = {
  render: () => (
    <div style={{ padding: '1rem' }}>
      <Assembled placement="bottom-end" label="parts" withActions />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const errors = spyOn(console, 'error')
    try {
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show parts' }))
      const root = await findRoot('parts')
      await expect(within(root).getByRole('button', { name: 'Undo' })).toBeInTheDocument()
      await expect(
        within(root).getByLabelText('Dismiss'),
      ).toBeInTheDocument()
      await expect(errors).not.toHaveBeenCalled()
      await userEvent.click(within(root).getByLabelText('Dismiss'))
      await waitFor(() => expect(root.isConnected).toBe(false), { timeout: 3000 })
    } finally {
      errors.mockRestore()
    }
  },
}

/**
 * `toast.promise` on a promise that rejects after 300 ms. The loading toast
 * shows a spinner, then it becomes an error toast with `role="alertdialog"`
 * (high priority, `toast/root/ToastRoot.js:420`), titled and still there.
 * Perturbations: rendering the severity icon for `loading` in `ToastList.tsx`
 * fails the spinner check; in `severity.ts`, dropping the error branch's priority
 * mapping leaves the settled toast `role="dialog"` and fails the role query.
 */
export const PromiseRejects: Story = {
  render: () => {
    const [busy, setBusy] = useState(false)
    return (
      <div style={{ padding: '1rem' }}>
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true)
            toast
              .promise(
                new Promise<void>((_, reject) => setTimeout(() => reject(new Error('no')), 300)),
                { loading: 'Saving', success: 'Saved', error: 'Save failed' },
              )
              .catch(() => {})
              .finally(() => setBusy(false))
          }}
        >
          Save
        </Button>
      </div>
    )
  },
  play: cleanPlay(async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Save' }))
    const loading = await findRoot('Saving')
    await expect(loading.getAttribute('data-type')).toBe('loading')
    // The leading glyph is the Spinner (a circle, no severity path), not the Close icon.
    await expect(glyphOf(loading).querySelector('svg circle')).not.toBeNull()
    await expect(glyphPath(loading)).toBeNull()

    // The error toast's Root is aria-hidden while the viewport is unfocused
    // (`ToastRoot.js:425`), so it is found by its attributes, not by role query.
    const failed = await waitFor(() => {
      const root = rootTitled('Save failed')
      expect(root).not.toBeNull()
      return root as HTMLElement
    })
    await expect(failed.getAttribute('role')).toBe('alertdialog')
    await expect(failed.getAttribute('data-type')).toBe('error')
    await expect(glyphPath(failed)).toBe(ICON_PATHS[SEVERITY_ICON.error])
  }),
}
