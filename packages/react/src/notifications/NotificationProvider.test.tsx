// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../providers/LocaleProvider.js'
import { announce, toast } from './api.js'
import { NotificationProvider } from './NotificationProvider.js'

// Base UI waits for getAnimations() before removing an ended toast; jsdom has
// none. The flag makes removal immediate (see ToastParts.test.tsx).
beforeAll(() => {
  ;(globalThis as { BASE_UI_ANIMATIONS_DISABLED?: boolean }).BASE_UI_ANIMATIONS_DISABLED = true
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mount(children: ReactNode = null) {
  return render(
    <LocaleProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </LocaleProvider>,
  )
}

/** Our own regions: the toast viewport is also aria-live polite, but has a role. */
const liveRegion = (politeness: 'polite' | 'assertive') =>
  document.querySelector(`div[aria-live="${politeness}"]:not([role])`) as HTMLElement

/**
 * The title text of every aria-hidden alertdialog. Testing Library does not
 * compute a name through an aria-hidden Root (ToastRoot.js:425), so read the
 * `aria-labelledby` target directly.
 */
function alertdialogTitles(): string[] {
  return screen
    .queryAllByRole('alertdialog', { hidden: true })
    .map((el) => document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent ?? '')
}

describe('NotificationProvider', () => {
  it('shows a module-scope toast() as a dialog named by its title (fails with no Relay)', async () => {
    mount()
    act(() => {
      toast({ title: 'Saved' })
    })
    expect(await screen.findByRole('dialog', { name: 'Saved' })).toBeTruthy()
  })

  it('shows a toast raised by a mount effect that runs BEFORE the provider (fails if the relay subscribes in useEffect)', async () => {
    // The layout-vs-passive discriminator. Page comes earlier in tree order, so
    // its passive effect runs before any passive effect the provider registers.
    function Page() {
      useEffect(() => {
        toast({ title: 'From mount' })
      }, [])
      return null
    }
    render(
      <LocaleProvider>
        <Page />
        <NotificationProvider>{null}</NotificationProvider>
      </LocaleProvider>,
    )
    expect(await screen.findByRole('dialog', { name: 'From mount' })).toBeTruthy()
  })

  it('shows a toast raised from a child mount useEffect (fails with no Relay, or Relay after the children subscribing in useEffect)', async () => {
    // A regression pin, NOT the layout-vs-passive discriminator: Relay is an
    // earlier sibling of the children, so its passive effect would run first
    // even as a plain useEffect. See the test above for that.
    function Page() {
      useEffect(() => {
        toast({ title: 'From child' })
      }, [])
      return null
    }
    mount(<Page />)
    expect(await screen.findByRole('dialog', { name: 'From child' })).toBeTruthy()
  })

  it('keeps an error toast past 6 s and dismisses an info toast (fails if error takes the 5 s default)', async () => {
    vi.useFakeTimers()
    mount()
    act(() => {
      toast.error('Failed')
      toast.info('Note')
    })
    expect(screen.getByRole('dialog', { name: 'Note' })).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(alertdialogTitles()).toEqual(['Failed'])
    expect(screen.queryByRole('dialog', { name: 'Note' })).toBeNull()
  })

  it('makes a rejected toast.promise a titled, persistent alertdialog (fails if options reach Base UI unmapped)', async () => {
    vi.useFakeTimers()
    mount()
    let settled: Promise<unknown> = Promise.resolve()
    act(() => {
      settled = toast
        .promise(Promise.reject(new Error('nope')), {
          loading: 'Saving',
          success: 'Saved',
          error: 'Could not save',
        })
        .catch(() => {})
    })
    await act(async () => {
      await settled
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(alertdialogTitles()).toEqual(['Could not save'])
  })

  it('updates in place when the id repeats (fails if a repeated id appends a second toast)', async () => {
    mount()
    act(() => {
      toast({ id: 'a', title: 'One' })
    })
    await screen.findByText('One')
    act(() => {
      toast({ id: 'a', title: 'Two' })
    })
    expect(await screen.findByText('Two')).toBeTruthy()
    expect(screen.queryByText('One')).toBeNull()
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1)
  })

  it('flags only the oldest of four toasts as limited (fails if the newest is flagged)', async () => {
    mount()
    act(() => {
      for (const n of ['1', '2', '3', '4']) toast({ title: `T${n}`, timeout: 0 })
    })
    await screen.findByText('T4')
    const roots = screen.getAllByRole('dialog', { hidden: true })
    expect(roots).toHaveLength(4)
    const limited = roots.filter((r) => r.hasAttribute('data-limited'))
    expect(limited).toHaveLength(1)
    expect(limited[0]!.textContent).toContain('T1')
    const newest = roots.find((r) => r.textContent?.includes('T4'))!
    expect(newest.hasAttribute('data-limited')).toBe(false)
  })

  it('renders one toast, one pair of live regions and one warning when nested (fails without the context check)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <LocaleProvider>
        <NotificationProvider>
          <NotificationProvider>
            <span>kid</span>
          </NotificationProvider>
        </NotificationProvider>
      </LocaleProvider>,
    )
    expect(screen.getByText('kid')).toBeTruthy()
    act(() => {
      toast({ title: 'Once' })
    })
    await screen.findByText('Once')
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1)
    expect(document.querySelectorAll('div[aria-live="polite"]:not([role])')).toHaveLength(1)
    expect(document.querySelectorAll('div[aria-live="assertive"]')).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  describe('announce', () => {
    it('writes to the polite region after a frame, clearing first (fails if set with no clear)', async () => {
      vi.useFakeTimers()
      mount()
      const region = liveRegion('polite')
      expect(region.textContent).toBe('')
      act(() => announce('Saved'))
      expect(region.textContent).toBe('')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50)
      })
      expect(region.textContent).toBe('Saved')
      // Announcing the same text again must pass through '' so it is re-read.
      const seen: string[] = []
      const observer = new MutationObserver(() => seen.push(region.textContent ?? ''))
      observer.observe(region, { childList: true, characterData: true, subtree: true })
      act(() => announce('Saved'))
      expect(region.textContent).toBe('')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50)
      })
      expect(region.textContent).toBe('Saved')
      observer.disconnect()
    })

    it('targets the assertive region (fails if politeness is ignored and the polite region is written)', async () => {
      vi.useFakeTimers()
      mount()
      act(() => announce('Failed', { politeness: 'assertive' }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50)
      })
      expect(liveRegion('assertive').textContent).toBe('Failed')
      expect(liveRegion('polite').textContent).toBe('')
    })

    it('empties the region after 5000 ms (fails if the clear timer is dropped or longer than 5 s)', async () => {
      vi.useFakeTimers()
      mount()
      act(() => announce('Saved'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50)
      })
      expect(liveRegion('polite').textContent).toBe('Saved')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })
      expect(liveRegion('polite').textContent).toBe('')
    })

    it('cancels the pending animation frame it scheduled on unmount (fails if the unmount cleanup does not cancel the frame)', () => {
      vi.useFakeTimers()
      const frames: number[] = []
      const realRaf = globalThis.requestAnimationFrame
      vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
        const id = realRaf(cb)
        frames.push(id)
        return id
      })
      const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame')
      const view = mount()
      act(() => announce('Saved'))
      expect(frames).toHaveLength(1)
      view.unmount()
      expect(cancel).toHaveBeenCalledWith(frames[0])
    })

    it('clears the pending 5 s timer it scheduled on unmount (fails if the unmount cleanup does not clear the timer)', async () => {
      vi.useFakeTimers()
      const view = mount()
      act(() => announce('Saved'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50)
      })
      const clear = vi.spyOn(globalThis, 'clearTimeout')
      const before = vi.getTimerCount()
      expect(before).toBeGreaterThan(0)
      view.unmount()
      expect(clear).toHaveBeenCalled()
      expect(vi.getTimerCount()).toBeLessThan(before)
    })

    it('runs a toast action then closes that toast (fails if the action does not close its toast)', async () => {
      const onClick = vi.fn()
      mount()
      act(() => {
        toast({ title: 'Undo?', timeout: 0, action: { label: 'Undo', onClick } })
      })
      const button = await screen.findByRole('button', { name: 'Undo', hidden: true })
      act(() => {
        button.click()
      })
      expect(onClick).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('dialog', { name: 'Undo?', hidden: true })).toBeNull()
    })
  })
})
