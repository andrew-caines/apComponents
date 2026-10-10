// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEventListener } from './useEventListener.js'

afterEach(() => {
  vi.restoreAllMocks()
})

const target = document.createElement('div')

function Direct({
  to = target,
  type = 'ping',
  handler,
  options,
}: {
  to?: EventTarget | null | undefined
  type?: string
  handler: (e: Event) => void
  options?: AddEventListenerOptions
}) {
  useEventListener(to, type, handler, options)
  return null
}

function ViaRef({ handler }: { handler: (e: Event) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEventListener(ref, 'click', handler)
  return <button ref={ref}>go</button>
}

describe('useEventListener', () => {
  it('listens on an EventTarget and detaches on unmount', () => {
    const handler = vi.fn()
    const { unmount } = render(<Direct handler={handler} />)
    target.dispatchEvent(new Event('ping'))
    expect(handler).toHaveBeenCalledTimes(1)
    unmount()
    target.dispatchEvent(new Event('ping'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('listens on a ref target', () => {
    const handler = vi.fn()
    const { getByText } = render(<ViaRef handler={handler} />)
    fireEvent.click(getByText('go'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('attaches nothing for a null target', () => {
    const add = vi.spyOn(EventTarget.prototype, 'addEventListener')
    render(<Direct to={null} handler={vi.fn()} />)
    expect(add.mock.calls.filter(([type]) => type === 'ping')).toHaveLength(0)
  })

  it('attaches nothing for an undefined target', () => {
    const add = vi.spyOn(EventTarget.prototype, 'addEventListener')
    function Undef() {
      useEventListener(undefined, 'ping', () => {})
      return null
    }
    render(<Undef />)
    expect(add.mock.calls.filter(([type]) => type === 'ping')).toHaveLength(0)
  })

  it('does not re-subscribe for a new handler but calls the new one', () => {
    const add = vi.spyOn(target, 'addEventListener')
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Direct handler={first} />)
    rerender(<Direct handler={second} />)
    expect(add).toHaveBeenCalledTimes(1)
    target.dispatchEvent(new Event('ping'))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('re-subscribes when type, capture, passive or once change', () => {
    const add = vi.spyOn(target, 'addEventListener')
    const h = vi.fn()
    const { rerender } = render(<Direct handler={h} />)
    expect(add).toHaveBeenCalledTimes(1)
    rerender(<Direct handler={h} type="pong" />)
    expect(add).toHaveBeenCalledTimes(2)
    rerender(<Direct handler={h} type="pong" options={{ capture: true }} />)
    expect(add).toHaveBeenCalledTimes(3)
    rerender(<Direct handler={h} type="pong" options={{ capture: true, passive: true }} />)
    expect(add).toHaveBeenCalledTimes(4)
    rerender(
      <Direct handler={h} type="pong" options={{ capture: true, passive: true, once: true }} />,
    )
    expect(add).toHaveBeenCalledTimes(5)
  })

  it('does not re-subscribe for an equal options literal', () => {
    const add = vi.spyOn(target, 'addEventListener')
    const h = vi.fn()
    const { rerender } = render(<Direct handler={h} options={{ capture: true }} />)
    rerender(<Direct handler={h} options={{ capture: true }} />)
    expect(add).toHaveBeenCalledTimes(1)
  })

  it('re-subscribes when the target changes', () => {
    const other = document.createElement('div')
    const h = vi.fn()
    const { rerender } = render(<Direct handler={h} />)
    rerender(<Direct handler={h} to={other} />)
    target.dispatchEvent(new Event('ping'))
    expect(h).not.toHaveBeenCalled()
    other.dispatchEvent(new Event('ping'))
    expect(h).toHaveBeenCalledTimes(1)
  })

  // Type test. `npm run typecheck` is the assertion: the handler's event is
  // narrowed by the event name. Two perturbations, each caught by one line:
  // - the handler goes back to `(event: Event)`: `e.key` on the 'keydown' line
  //   stops compiling (TS2339);
  // - the handler loosens to `(event: any)`: the 'click' line compiles, so its
  //   `@ts-expect-error` becomes an unused directive (TS2578).
  // Same mechanism as Select.test.tsx.
  it('types the handler event from the event name', () => {
    const seen: string[] = []
    function Typed() {
      useEventListener(window, 'keydown', (e) => seen.push(e.key)) // compiles: KeyboardEvent
      useEventListener(document, 'visibilitychange', (e) => seen.push(e.type)) // compiles: Event
      useEventListener(window, 'my-custom', (e) => seen.push(e.type)) // compiles: Event fallback
      // @ts-expect-error a click is a MouseEvent, which has no `key`
      useEventListener(window, 'click', (e) => e.key)
      return null
    }
    render(<Typed />)
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent(window, new Event('my-custom'))
    expect(seen).toEqual(['Escape', 'my-custom'])
  })
})
