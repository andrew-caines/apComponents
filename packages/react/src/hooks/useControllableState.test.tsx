// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useControllableState } from './useControllableState.js'

type Api = ReturnType<typeof useControllableState<number>>
let api: Api

function Probe(props: { value?: number | undefined; onChange?: (v: number) => void }) {
  api = useControllableState<number>({
    ...(props.value !== undefined ? { value: props.value } : {}),
    defaultValue: 0,
    onChange: props.onChange,
  })
  return <span>{api[0]}</span>
}

describe('useControllableState', () => {
  it('uncontrolled: updates the value and fires onChange once', () => {
    const onChange = vi.fn()
    const { container } = render(<Probe onChange={onChange} />)
    act(() => api[1](5))
    expect(container.textContent).toBe('5')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('controlled: value waits for the parent, onChange still fires', () => {
    const onChange = vi.fn()
    const { container, rerender } = render(<Probe value={1} onChange={onChange} />)
    act(() => api[1](2))
    expect(container.textContent).toBe('1')
    expect(onChange).toHaveBeenCalledWith(2)
    rerender(<Probe value={2} onChange={onChange} />)
    expect(container.textContent).toBe('2')
  })

  it('setting the same value does not fire onChange', () => {
    const onChange = vi.fn()
    render(<Probe onChange={onChange} />)
    act(() => api[1](0))
    expect(onChange, 'a no-op set must not report a change (the Object.is check)').not.toHaveBeenCalled()
  })

  it('composes two updater calls in one handler (uncontrolled)', () => {
    const { container } = render(<Probe />)
    act(() => {
      api[1]((p) => p + 1)
      api[1]((p) => p + 1)
    })
    expect(container.textContent).toBe('2')
  })

  it('keeps setValue referentially stable across a re-render', () => {
    const { rerender } = render(<Probe />)
    const first = api[1]
    rerender(<Probe onChange={() => {}} />)
    expect(api[1]).toBe(first)
  })
})
