// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue.js'

function Probe({ value, delay = 100 }: { value: string; delay?: number }) {
  return <span>{useDebouncedValue(value, delay)}</span>
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useDebouncedValue', () => {
  it('equals the initial value at once', () => {
    const { container } = render(<Probe value="a" />)
    expect(container.textContent).toBe('a')
  })

  it('shows a change only at delayMs', () => {
    const { container, rerender } = render(<Probe value="a" />)
    rerender(<Probe value="b" />)
    act(() => void vi.advanceTimersByTime(99))
    expect(container.textContent).toBe('a')
    act(() => void vi.advanceTimersByTime(1))
    expect(container.textContent).toBe('b')
  })

  it('restarts the window on a second change', () => {
    const { container, rerender } = render(<Probe value="a" />)
    rerender(<Probe value="b" />)
    act(() => void vi.advanceTimersByTime(60))
    rerender(<Probe value="c" />)
    act(() => void vi.advanceTimersByTime(60))
    expect(container.textContent, 'the first timer must have been cancelled').toBe('a')
    act(() => void vi.advanceTimersByTime(40))
    expect(container.textContent).toBe('c')
  })

  it('sets no state when unmounted before the delay', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender, unmount } = render(<Probe value="a" />)
    rerender(<Probe value="b" />)
    unmount()
    act(() => void vi.advanceTimersByTime(500))
    expect(errors).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
