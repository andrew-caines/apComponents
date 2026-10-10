// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIntersectionObserver } from './useIntersectionObserver.js'

const instances: FakeIntersectionObserver[] = []

class FakeIntersectionObserver {
  observed: Element[] = []
  disconnected = false
  constructor(
    public callback: (entries: IntersectionObserverEntry[]) => void,
    public options: IntersectionObserverInit | undefined,
  ) {
    instances.push(this)
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true
  }
  trigger(entries: Array<{ isIntersecting: boolean; intersectionRatio: number }>) {
    this.callback(entries as unknown as IntersectionObserverEntry[])
  }
}

beforeEach(() => {
  instances.length = 0
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function Probe({
  threshold,
  rootMargin,
}: {
  threshold?: number | readonly number[]
  rootMargin?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const entry = useIntersectionObserver(ref, {
    ...(threshold === undefined ? {} : { threshold }),
    ...(rootMargin === undefined ? {} : { rootMargin }),
  })
  return (
    <div ref={ref} data-r={entry ? `${entry.isIntersecting}:${entry.intersectionRatio}` : 'none'}>
      x
    </div>
  )
}

describe('useIntersectionObserver', () => {
  it('is undefined before any callback and returns the entry after trigger', () => {
    const { container } = render(<Probe threshold={0.5} />)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('data-r')).toBe('none')
    expect(instances[0]!.observed).toEqual([el])
    expect(instances[0]!.options?.threshold).toBe(0.5)
    act(() => instances[0]!.trigger([{ isIntersecting: true, intersectionRatio: 0.75 }]))
    expect(el.getAttribute('data-r')).toBe('true:0.75')
  })

  it('resets a stale entry when the observer is rebuilt', () => {
    const { container, rerender } = render(<Probe threshold={0.5} />)
    const el = container.firstElementChild as HTMLElement
    act(() => instances[0]!.trigger([{ isIntersecting: true, intersectionRatio: 0.75 }]))
    expect(el.getAttribute('data-r')).toBe('true:0.75')
    rerender(<Probe threshold={[0, 1]} />)
    expect(el.getAttribute('data-r'), 'the old observer entry must not outlive its observer').toBe('none')
  })

  it('disconnects on unmount', () => {
    const { unmount } = render(<Probe />)
    unmount()
    expect(instances[0]!.disconnected).toBe(true)
  })

  it('returns undefined and does not throw when IntersectionObserver is absent', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { container } = render(<Probe />)
    expect((container.firstElementChild as HTMLElement).getAttribute('data-r')).toBe('none')
    expect(instances).toHaveLength(0)
  })

  it('re-observes when threshold changes from 0.5 to [0, 1]', () => {
    const { rerender } = render(<Probe threshold={0.5} />)
    rerender(<Probe threshold={[0, 1]} />)
    expect(instances).toHaveLength(2)
    expect(instances[0]!.disconnected).toBe(true)
    expect(instances[1]!.options?.threshold).toEqual([0, 1])
  })

  it('does not re-observe for an equal array literal', () => {
    const { rerender } = render(<Probe threshold={[0, 1]} />)
    rerender(<Probe threshold={[0, 1]} />)
    expect(instances).toHaveLength(1)
    expect(instances[0]!.disconnected).toBe(false)
  })

  it('re-observes when rootMargin changes', () => {
    const { rerender } = render(<Probe rootMargin="0px" />)
    rerender(<Probe rootMargin="10px" />)
    expect(instances).toHaveLength(2)
  })
})
