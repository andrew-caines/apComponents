// @vitest-environment jsdom
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../providers/LocaleProvider.js'
import { Button } from '../Button/Button.js'
import { Popover } from './Popover.js'
import { popoverHeaderClass } from './Popover.css.js'

/** As in Tooltip.test.tsx: generated ids differ between renders, nothing else may. */
function normaliseIds(html: string): string {
  return html
    .replace(/\bid="[^"]*"/g, 'id="ID"')
    .replace(/\baria-(labelledby|describedby|controls|owns)="[^"]*"/g, 'aria-$1="ID"')
}

/** Open and past Base UI's enter transition, whose transient attributes differ run to run. */
async function settled() {
  const popup = await waitFor(() => screen.getByRole('dialog'))
  await waitFor(() => expect(popup.hasAttribute('data-starting-style')).toBe(false))
  await waitFor(() => expect(document.querySelector('[style*="transition"]')).toBeNull())
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Popover (convenience)', () => {
  // Each `@ts-expect-error` is enforced by `npm run typecheck`: if the line
  // stops erroring (the union loosens, or `modal` is no longer omitted) the
  // directive becomes an unused suppression and typecheck fails on THIS line.
  it('requires exactly one name, and refuses modal, at compile time', () => {
    const trigger = <button type="button">Open</button>
    const elements = [
      // @ts-expect-error neither title nor aria-label
      <Popover trigger={trigger}>x</Popover>,
      // @ts-expect-error both title and aria-label
      <Popover trigger={trigger} title="A" aria-label="B">
        x
      </Popover>,
      // @ts-expect-error modal is deliberately not offered
      <Popover trigger={trigger} title="A" modal>
        x
      </Popover>,
      <Popover trigger={trigger} title="A">
        x
      </Popover>,
      <Popover trigger={trigger} aria-label="B">
        x
      </Popover>,
    ]
    expect(elements).toHaveLength(5)
  })

  // Fails if `aria-label` is dropped instead of routed to the popup: the
  // dialog would have no name.
  it('names an untitled popup by aria-label and renders no heading', async () => {
    render(
      <Popover aria-label="Colour" trigger={<button type="button">Open</button>}>
        body
      </Popover>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const popup = await waitFor(() => screen.getByRole('dialog', { name: 'Colour' }))
    expect(popup.getAttribute('aria-label')).toBe('Colour')
    expect(screen.queryByRole('heading')).toBeNull()
  })

  // Fails if the dismiss renders unconditionally, or never.
  it('renders the dismiss button only when dismissible', async () => {
    render(
      <Popover title="A" trigger={<button type="button">Open</button>}>
        body
      </Popover>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    cleanup()

    // The dismiss button reads messages.close, so it needs a LocaleProvider.

    render(
      <LocaleProvider>
        <Popover title="A" dismissible trigger={<button type="button">Open</button>}>
          body
        </Popover>
      </LocaleProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  // Fails if `openOnHover` and `delay` are routed to the Root, where Base UI
  // ignores them: hover would then not open it at all.
  it('passes openOnHover and delay to the trigger', async () => {
    vi.useFakeTimers()
    render(
      <Popover title="A" openOnHover delay={0} trigger={<button type="button">Open</button>}>
        body
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.mouseEnter(trigger)
    fireEvent.mouseMove(trigger)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })

  // The counterpart: without `delay`, the default 300 ms applies on hover.
  // Fails if a default delay of 0 is injected.
  it('waits the default delay on hover when none is given', async () => {
    vi.useFakeTimers()
    render(
      <Popover title="A" openOnHover trigger={<button type="button">Open</button>}>
        body
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.mouseEnter(trigger)
    fireEvent.mouseMove(trigger)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // Fails if `closeDelay` is routed to the Root, where Base UI ignores it:
  // the popover would then close at the default delay, before 500 ms.
  it('passes closeDelay to the trigger', async () => {
    vi.useFakeTimers()
    render(
      <Popover
        title="A"
        openOnHover
        delay={0}
        closeDelay={500}
        trigger={<button type="button">Open</button>}
      >
        body
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.mouseEnter(trigger)
    fireEvent.mouseMove(trigger)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.queryByRole('dialog')).not.toBeNull()
    fireEvent.mouseLeave(trigger)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(screen.queryByRole('dialog')).not.toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // Fails if the convenience adds, drops or reorders any element, attribute
  // or class relative to the parts assembled by hand.
  it('renders the same DOM as the hand-assembled parts', async () => {
    // The dismiss button reads messages.close, so it needs a LocaleProvider.
    render(
      <LocaleProvider>
        <Popover
          title="Filters"
          description="Narrow the list"
          dismissible
          side="top"
          trigger={
            <button type="button" data-x="1">
              Open
            </button>
          }
        >
          <p>body</p>
        </Popover>
      </LocaleProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    await settled()
    const a = normaliseIds(document.body.innerHTML)
    cleanup()

    // The dismiss button reads messages.close, so it needs a LocaleProvider.

    render(
      <LocaleProvider>
        <Popover.Root>
          <Popover.Trigger
            render={
              <button type="button" data-x="1">
                Open
              </button>
            }
          />
          <Popover.Popup positioner={{ side: 'top' }}>
            <div className={popoverHeaderClass}>
              <Popover.Title>Filters</Popover.Title>
              <Popover.Dismiss />
            </div>
            <Popover.Description>Narrow the list</Popover.Description>
            <p>body</p>
          </Popover.Popup>
        </Popover.Root>
      </LocaleProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    await settled()
    const b = normaliseIds(document.body.innerHTML)

    expect(a).toBe(b)
    expect(a).toContain('role="dialog"')
  })
})

describe('Popover with a Button trigger', () => {
  // Perturbation: removing Button's `[NATIVE_BUTTON_DERIVABLE]` marker makes
  // the derived `nativeButton` false, so Base UI logs and adds `role="button"`.
  it('renders a native button and logs nothing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <LocaleProvider>
          <Popover title="T" trigger={<Button>Open</Button>}>
            x
          </Popover>
        </LocaleProvider>,
      )
      const trigger = screen.getByRole('button', { name: 'Open' })
      expect(trigger.getAttribute('type')).toBe('button')
      expect(trigger.hasAttribute('role')).toBe(false)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
      cleanup()
    }
  })
})
