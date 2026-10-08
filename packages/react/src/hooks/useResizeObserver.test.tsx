// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useResizeObserver } from './useResizeObserver.js'

const instances: FakeResizeObserver[] = []

class FakeResizeObserver {
  observed: Element[] = []
  disconnected = false
  constructor(public callback: (entries: ResizeObserverEntry[]) => void) {
    instances.push(this)
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true
  }
  trigger(entries: Array<{ contentRect: { width: number; height: number } }>) {
    this.callback(entries as unknown as ResizeObserverEntry[])
  }
}

beforeEach(() => {
  instances.length = 0
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function Probe() {
  const ref = useRef<HTMLDivElement>(null)
  const size = useResizeObserver(ref)
  return (
    <div ref={ref} data-size={size ? `${size.width}x${size.height}` : 'none'}>
      x
    </div>
  )
}

describe('useResizeObserver', () => {
  it('is undefined before any callback and reports contentRect after trigger', () => {
    const { container } = render(<Probe />)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('data-size')).toBe('none')
    expect(instances).toHaveLength(1)
    expect(instances[0]!.observed).toEqual([el])
    act(() => instances[0]!.trigger([{ contentRect: { width: 120, height: 30 } }]))
    expect(el.getAttribute('data-size')).toBe('120x30')
  })

  it('disconnects on unmount', () => {
    const { unmount } = render(<Probe />)
    unmount()
    expect(instances[0]!.disconnected).toBe(true)
  })

  it('returns undefined and does not throw when ResizeObserver is absent', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const { container } = render(<Probe />)
    expect((container.firstElementChild as HTMLElement).getAttribute('data-size')).toBe('none')
    expect(instances).toHaveLength(0)
  })
})
