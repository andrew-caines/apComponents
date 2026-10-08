// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Button } from '../components/Button/Button.js'
import { buttonRecipe } from '../components/Button/Button.css.js'
import { LocaleProvider } from '../providers/LocaleProvider.js'
import { DEFAULT_MESSAGES } from '../providers/messages.js'
import { alert, confirm } from './api.js'
import { NotificationProvider } from './NotificationProvider.js'

// Base UI waits for getAnimations() before it reports a close as complete;
// jsdom has none. The flag makes completion immediate (see ToastParts.test.tsx).
beforeAll(() => {
  ;(globalThis as { BASE_UI_ANIMATIONS_DISABLED?: boolean }).BASE_UI_ANIMATIONS_DISABLED = true
})

afterEach(() => {
  cleanup()
})

function mount(children: React.ReactNode = null) {
  return render(
    <LocaleProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </LocaleProvider>,
  )
}

const dialog = (name: string) => screen.findByRole('alertdialog', { name })
const button = (name: string) => screen.getByRole('button', { name })

describe('DialogHost: confirm', () => {
  it('opens an alertdialog named by the title; Confirm resolves true, Cancel resolves false (fails if the answer is not wired)', async () => {
    mount()
    let p!: Promise<boolean>
    act(() => {
      p = confirm({ title: 'Delete record?' })
    })
    await dialog('Delete record?')
    fireEvent.click(button(DEFAULT_MESSAGES.confirm))
    expect(await p).toBe(true)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    act(() => {
      p = confirm({ title: 'Again?' })
    })
    await dialog('Again?')
    fireEvent.click(button(DEFAULT_MESSAGES.cancel))
    expect(await p).toBe(false)
  })

  it('resolves false on Escape (fails if only the buttons resolve)', async () => {
    mount()
    let p!: Promise<boolean>
    act(() => {
      p = confirm({ title: 'Esc?' })
    })
    const el = await dialog('Esc?')
    fireEvent.keyDown(el, { key: 'Escape' })
    expect(await p).toBe(false)
  })

  it('does not dismiss on an outside click (fails if pointer dismissal is enabled)', async () => {
    mount()
    let p!: Promise<boolean>
    const settle = vi.fn()
    act(() => {
      p = confirm({ title: 'Stay?' })
      void p.then(settle)
    })
    await dialog('Stay?')
    fireEvent.pointerDown(document.body)
    fireEvent.mouseDown(document.body)
    fireEvent.click(document.body)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(settle).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeNull()
  })

  it('focuses Confirm by default (fails if initialFocus is omitted: Cancel is the first tabbable)', async () => {
    mount()
    act(() => {
      void confirm({ title: 'Focus?' })
    })
    await dialog('Focus?')
    await waitFor(() => expect(document.activeElement).toBe(button(DEFAULT_MESSAGES.confirm)))
  })

  it('focuses Cancel when tone is danger (fails if initialFocus ignores the tone)', async () => {
    mount()
    act(() => {
      void confirm({ title: 'Danger?', tone: 'danger' })
    })
    await dialog('Danger?')
    await waitFor(() => expect(document.activeElement).toBe(button(DEFAULT_MESSAGES.cancel)))
  })

  it('gives the danger Confirm the danger button class (fails if tone is not forwarded)', async () => {
    mount()
    act(() => {
      void confirm({ title: 'Danger?', tone: 'danger' })
    })
    await dialog('Danger?')
    expect(button(DEFAULT_MESSAGES.confirm).className).toBe(
      buttonRecipe({ variant: 'solid', size: 'md', tone: 'danger' }),
    )
    expect(button(DEFAULT_MESSAGES.cancel).className).toBe(
      buttonRecipe({ variant: 'outline', size: 'md', tone: 'action' }),
    )
  })

  it('uses confirmLabel and cancelLabel over the defaults (fails if the labels are ignored)', async () => {
    mount()
    act(() => {
      void confirm({ title: 'Labels?', confirmLabel: 'Delete', cancelLabel: 'Keep' })
    })
    await dialog('Labels?')
    expect(button('Delete')).toBeTruthy()
    expect(button('Keep')).toBeTruthy()
    expect(screen.queryByRole('button', { name: DEFAULT_MESSAGES.confirm })).toBeNull()
  })

  it('shows one dialog for two same-tick calls, then the second after the first closes (fails if every queued request renders)', async () => {
    mount()
    let a!: Promise<boolean>
    let b!: Promise<boolean>
    act(() => {
      a = confirm({ title: 'First' })
      b = confirm({ title: 'Second' })
    })
    await dialog('First')
    expect(screen.getAllByRole('alertdialog', { hidden: true })).toHaveLength(1)
    expect(screen.queryByRole('alertdialog', { name: 'Second' })).toBeNull()
    fireEvent.click(button(DEFAULT_MESSAGES.confirm))
    expect(await a).toBe(true)
    await dialog('Second')
    expect(screen.getAllByRole('alertdialog', { hidden: true })).toHaveLength(1)
    fireEvent.click(button(DEFAULT_MESSAGES.cancel))
    expect(await b).toBe(false)
  })

  it('resolves every pending call false when the provider unmounts (fails if pending requests are dropped; the awaits would time out)', async () => {
    const view = mount()
    let a!: Promise<boolean>
    let b!: Promise<boolean>
    let c!: Promise<void>
    act(() => {
      a = confirm({ title: 'One' })
      b = confirm({ title: 'Two' })
      c = alert({ title: 'Three' })
    })
    await dialog('One')
    view.unmount()
    expect(await a).toBe(false)
    expect(await b).toBe(false)
    await c
  })

  it('keeps a mount-time confirm() alive under StrictMode (fails if the cleanup dismisses immediately)', async () => {
    // StrictMode replays the child's effect too, so two requests are raised.
    const raised: Promise<boolean>[] = []
    function Page() {
      useEffect(() => {
        raised.push(confirm({ title: 'Mounted?' }))
      }, [])
      return null
    }
    render(
      <StrictMode>
        <LocaleProvider>
          <NotificationProvider>
            <Page />
          </NotificationProvider>
        </LocaleProvider>
      </StrictMode>,
    )
    await dialog('Mounted?')
    fireEvent.click(button(DEFAULT_MESSAGES.confirm))
    expect(await raised[0]).toBe(true)
    await dialog('Mounted?')
    fireEvent.click(button(DEFAULT_MESSAGES.confirm))
    expect(await raised[1]).toBe(true)
  })

  it('returns focus to the button that triggered confirm() (fails if finalFocus is false)', async () => {
    mount(<Button onClick={() => void confirm({ title: 'Back?' })}>Open</Button>)
    const trigger = screen.getByRole('button', { name: 'Open' })
    trigger.focus()
    fireEvent.click(trigger)
    await dialog('Back?')
    fireEvent.click(button(DEFAULT_MESSAGES.cancel))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

describe('DialogHost: alert', () => {
  it('has one OK button that resolves the promise, focused initially (fails if the label or the resolve is missing)', async () => {
    mount()
    let p!: Promise<void>
    act(() => {
      p = alert({ title: 'Saved' })
    })
    await dialog('Saved')
    const ok = button(DEFAULT_MESSAGES.ok)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    await waitFor(() => expect(document.activeElement).toBe(ok))
    fireEvent.click(ok)
    await p
  })

  it('uses okLabel over the default (fails if the label is ignored)', async () => {
    mount()
    act(() => {
      void alert({ title: 'Saved', okLabel: 'Got it' })
    })
    await dialog('Saved')
    expect(button('Got it')).toBeTruthy()
  })
})
