// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCopyToClipboard } from './useCopyToClipboard.js'

let result: ReturnType<typeof useCopyToClipboard>

function Probe({ resetMs }: { resetMs?: number }) {
  result = useCopyToClipboard(resetMs === undefined ? undefined : { resetMs })
  return <span>{String(result[0])}</span>
}

const stubClipboard = (writeText: (t: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(navigator, 'clipboard')
  vi.restoreAllMocks()
})

describe('useCopyToClipboard', () => {
  it('writes the text, sets copied, resolves true, and resets after 2000 ms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    render(<Probe />)
    let ok: boolean | undefined
    await act(async () => {
      ok = await result[1]('hello')
    })
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(ok).toBe(true)
    expect(result[0]).toBe(true)
    act(() => void vi.advanceTimersByTime(1999))
    expect(result[0]).toBe(true)
    act(() => void vi.advanceTimersByTime(1))
    expect(result[0]).toBe(false)
  })

  it('honours resetMs', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined))
    render(<Probe resetMs={500} />)
    await act(async () => {
      await result[1]('x')
    })
    act(() => void vi.advanceTimersByTime(500))
    expect(result[0]).toBe(false)
  })

  it('restarts the timer when copy is called again inside the window', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined))
    render(<Probe resetMs={1000} />)
    await act(async () => {
      await result[1]('a')
    })
    act(() => void vi.advanceTimersByTime(800))
    await act(async () => {
      await result[1]('b')
    })
    act(() => void vi.advanceTimersByTime(800))
    expect(result[0], 'the first timer must have been cancelled').toBe(true)
    act(() => void vi.advanceTimersByTime(200))
    expect(result[0]).toBe(false)
  })

  it('resolves false and leaves copied false when navigator.clipboard is missing', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    render(<Probe />)
    let ok: boolean | undefined
    await act(async () => {
      ok = await result[1]('x')
    })
    expect(ok).toBe(false)
    expect(result[0]).toBe(false)
  })

  it('resolves false and leaves copied false when writeText rejects', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    render(<Probe />)
    let ok: boolean | undefined
    await act(async () => {
      ok = await result[1]('x')
    })
    expect(ok).toBe(false)
    expect(result[0]).toBe(false)
  })

  it('does not set state or start a timer when unmounted while writeText is pending', async () => {
    let resolve!: () => void
    stubClipboard(() => new Promise<void>((r) => (resolve = r)))
    const { unmount } = render(<Probe />)
    const pending = result[1]('x')
    unmount()
    resolve()
    expect(await pending).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not set state or start a timer when unmounted while writeText is pending and then rejects', async () => {
    let reject!: (e: Error) => void
    stubClipboard(() => new Promise<void>((_, r) => (reject = r)))
    const { unmount } = render(<Probe />)
    const pending = result[1]('x')
    unmount()
    reject(new Error('denied'))
    expect(await pending).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
