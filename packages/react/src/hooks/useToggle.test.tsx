// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useToggle } from './useToggle.js'

let api: ReturnType<typeof useToggle>
function Probe({ initial }: { initial?: boolean }) {
  api = initial === undefined ? useToggle() : useToggle(initial)
  return null
}

describe('useToggle', () => {
  it('starts false by default and toggle flips it', () => {
    render(<Probe />)
    expect(api[0]).toBe(false)
    act(() => api[1]())
    expect(api[0]).toBe(true)
    act(() => api[1]())
    expect(api[0]).toBe(false)
  })

  it('honours the initial value and set(true) is idempotent', () => {
    render(<Probe initial={true} />)
    expect(api[0]).toBe(true)
    act(() => api[2](true))
    act(() => api[2](true))
    expect(api[0]).toBe(true)
    act(() => api[2](false))
    expect(api[0]).toBe(false)
  })

  it('keeps both functions stable across renders', () => {
    const { rerender } = render(<Probe />)
    const [, toggle, set] = api
    act(() => toggle())
    rerender(<Probe />)
    expect(api[1]).toBe(toggle)
    expect(api[2]).toBe(set)
  })
})
