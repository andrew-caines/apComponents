// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { announce } from '../notifications/api.js'
import { NotificationProvider } from '../notifications/NotificationProvider.js'
import { LocaleProvider } from '../providers/LocaleProvider.js'
import { useAnnounce } from './useAnnounce.js'

beforeAll(() => {
  ;(globalThis as { BASE_UI_ANIMATIONS_DISABLED?: boolean }).BASE_UI_ANIMATIONS_DISABLED = true
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

let hookResult: ReturnType<typeof useAnnounce>
function Probe() {
  hookResult = useAnnounce()
  return null
}

function mount() {
  return render(
    <LocaleProvider>
      <NotificationProvider>
        <Probe />
      </NotificationProvider>
    </LocaleProvider>,
  )
}

describe('useAnnounce', () => {
  it('throws outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(
      'useAnnounce must be used inside <NotificationProvider> (or <ApProvider>).',
    )
  })

  it('writes the polite region inside NotificationProvider', async () => {
    vi.useFakeTimers()
    mount()
    const region = document.querySelector('div[aria-live="polite"]:not([role])') as HTMLElement
    expect(region.textContent).toBe('')
    act(() => hookResult('Saved'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    expect(region.textContent).toBe('Saved')
  })

  it('returns the exported announce', () => {
    mount()
    expect(hookResult).toBe(announce)
  })
})
