// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { banner } from '../../notifications/api.js'
import { NotificationProvider } from '../../notifications/NotificationProvider.js'
import { LocaleProvider } from '../../providers/LocaleProvider.js'
import { BannerRegion } from './BannerRegion.js'

beforeAll(() => {
  ;(globalThis as { BASE_UI_ANIMATIONS_DISABLED?: boolean }).BASE_UI_ANIMATIONS_DISABLED = true
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mount(withRegion = true, strict = false) {
  const tree = (
    <LocaleProvider>
      <NotificationProvider>
        {withRegion ? (
          <main data-testid="host">
            <BannerRegion />
          </main>
        ) : null}
      </NotificationProvider>
    </LocaleProvider>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

describe('BannerRegion', () => {
  it('renders a banner as role=status inside the region, and an error as role=alert (fails if one role serves all)', () => {
    mount()
    act(() => {
      banner({ title: 'Maintenance tonight' })
      banner({ title: 'Save failed', severity: 'error' })
    })
    const host = screen.getByTestId('host')
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Maintenance tonight')
    expect(host.contains(status)).toBe(true)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Save failed')
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('gives warning and success role=status too (fails if only info is status)', () => {
    mount()
    act(() => {
      banner({ title: 'W', severity: 'warning' })
      banner({ title: 'S', severity: 'success' })
    })
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })

  it('replaces a same-id banner in place and appends new ids (fails if the replacement appends or moves)', () => {
    mount()
    act(() => {
      banner({ id: 'a', title: 'First' })
      banner({ id: 'b', title: 'Second' })
    })
    act(() => {
      banner({ id: 'a', title: 'First again' })
    })
    let titles = screen.getAllByRole('status').map((el) => el.textContent)
    expect(titles).toHaveLength(2)
    expect(titles[0]).toContain('First again')
    expect(titles[1]).toContain('Second')
    act(() => {
      banner({ id: 'c', title: 'Third' })
    })
    titles = screen.getAllByRole('status').map((el) => el.textContent)
    expect(titles[2]).toContain('Third')
  })

  it('removes a banner with its close button, labelled Dismiss (fails if the button is not wired)', () => {
    mount()
    act(() => {
      banner({ title: 'Bye' })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders no close button when dismissible is false (fails if the flag is ignored)', () => {
    mount()
    act(() => {
      banner({ title: 'Stuck', dismissible: false })
    })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })

  it('removes a banner through the returned close() (fails if banner-close is not handled)', () => {
    mount()
    let handle!: ReturnType<typeof banner>
    act(() => {
      handle = banner({ title: 'Temp' })
    })
    expect(screen.getByRole('status')).toBeTruthy()
    act(() => {
      handle.close()
    })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders the action as a button that calls onClick', () => {
    const onClick = vi.fn()
    mount()
    act(() => {
      banner({ title: 'T', action: { label: 'Retry', onClick } })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows a banner raised by a sibling mount effect without falling back (fails if the region registers in a passive effect)', () => {
    function Page() {
      useEffect(() => {
        banner({ title: 'From mount' })
      }, [])
      return null
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <LocaleProvider>
        <NotificationProvider>
          <Page />
          <BannerRegion />
        </NotificationProvider>
      </LocaleProvider>,
    )
    expect(screen.getByRole('status').textContent).toContain('From mount')
    expect(warn).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })

  it('still counts the region as registered under StrictMode (fails if register and unregister are unbalanced)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount(true, true)
    act(() => {
      banner({ title: 'Strict' })
    })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(warn).not.toHaveBeenCalled()
  })

  it('falls back to a toast, warning once, with no region (fails if the region check is dropped)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount(false)
    act(() => {
      banner({ title: 'X', severity: 'warning' })
    })
    const toastEl = await screen.findByRole('dialog', { name: 'X' })
    expect(toastEl.getAttribute('data-type')).toBe('warning')
    expect(screen.queryByRole('status')).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('keeps the fallback toast past 6 s (fails if the fallback drops timeout: 0 and takes the 5 s default)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.useFakeTimers()
    mount(false)
    act(() => {
      banner({ title: 'Stays', severity: 'info' })
    })
    expect(screen.getByRole('dialog', { name: 'Stays' })).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(screen.queryByRole('dialog', { name: 'Stays', hidden: true })).not.toBeNull()
  })

  it('closes a fallback toast when its action is clicked (fails if the fallback path skips the closing wrap)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onClick = vi.fn()
    mount(false)
    act(() => {
      banner({ title: 'Act', action: { label: 'Go', onClick } })
    })
    const button = await screen.findByRole('button', { name: 'Go', hidden: true })
    act(() => {
      button.click()
    })
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Act', hidden: true })).toBeNull()
  })

  it('warns once when a second region mounts, and not under StrictMode replay (fails if the count check is dropped or StrictMode double-counts)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <StrictMode>
        <LocaleProvider>
          <NotificationProvider>
            <BannerRegion />
          </NotificationProvider>
        </LocaleProvider>
      </StrictMode>,
    )
    expect(warn).not.toHaveBeenCalled()
    cleanup()
    render(
      <LocaleProvider>
        <NotificationProvider>
          <BannerRegion />
          <BannerRegion />
          <BannerRegion />
        </NotificationProvider>
      </LocaleProvider>,
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain('BannerRegion')
  })

  it('closes the fallback toast through close() (fails if banner-close skips the toast)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount(false)
    let handle!: ReturnType<typeof banner>
    act(() => {
      handle = banner({ title: 'Gone soon' })
    })
    expect(await screen.findByRole('dialog', { name: 'Gone soon' })).toBeTruthy()
    act(() => {
      handle.close()
    })
    expect(screen.queryByRole('dialog', { name: 'Gone soon' })).toBeNull()
  })

  it('is not portalled: the region is a descendant of where it renders (fails if it portals to the body)', () => {
    mount()
    const host = screen.getByTestId('host')
    expect(host.firstElementChild?.tagName).toBe('DIV')
    act(() => {
      banner({ title: 'Inline' })
    })
    expect(host.contains(screen.getByRole('status'))).toBe(true)
  })
})
