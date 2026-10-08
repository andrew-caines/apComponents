// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery.js'

interface FakeList {
  matches: boolean
  listeners: Set<() => void>
  addEventListener: (type: string, fn: () => void) => void
  removeEventListener: (type: string, fn: () => void) => void
}

const lists = new Map<string, FakeList>()
const initial = new Map<string, boolean>()

function listFor(query: string): FakeList {
  let list = lists.get(query)
  if (!list) {
    const created: FakeList = {
      matches: initial.get(query) ?? false,
      listeners: new Set(),
      addEventListener: (type, fn) => {
        if (type === 'change') created.listeners.add(fn)
      },
      removeEventListener: (type, fn) => {
        if (type === 'change') created.listeners.delete(fn)
      },
    }
    lists.set(query, created)
    list = created
  }
  return list
}

function setMatches(query: string, matches: boolean) {
  const list = listFor(query)
  list.matches = matches
  act(() => list.listeners.forEach((fn) => fn()))
}

const listenerCount = (query: string) => listFor(query).listeners.size

beforeEach(() => {
  lists.clear()
  initial.clear()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => listFor(query),
  })
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)['matchMedia']
  vi.restoreAllMocks()
})

let seen: boolean[] = []
function Probe({ query, ssrDefault }: { query: string; ssrDefault: boolean }) {
  const v = useMediaQuery(query, ssrDefault)
  seen.push(v)
  return <span>{String(v)}</span>
}

describe('useMediaQuery', () => {
  beforeEach(() => {
    seen = []
  })

  it('returns the live value on the first render of a client-only mount', () => {
    initial.set('(min-width: 1px)', true)
    render(<Probe query="(min-width: 1px)" ssrDefault={false} />)
    expect(seen[0], 'a client-only mount has no server pass to match, so it must read the live value').toBe(true)
  })

  it('updates on change and unsubscribes on unmount', () => {
    const q = '(min-width: 2px)'
    const { container, unmount } = render(<Probe query={q} ssrDefault={false} />)
    expect(container.textContent).toBe('false')
    expect(listenerCount(q)).toBe(1)
    setMatches(q, true)
    expect(container.textContent).toBe('true')
    unmount()
    expect(listenerCount(q), 'unmount must remove the change listener').toBe(0)
  })

  it('re-subscribes when the query changes', () => {
    const a = '(min-width: 3px)'
    const b = '(min-width: 4px)'
    initial.set(b, true)
    const { container, rerender } = render(<Probe query={a} ssrDefault={false} />)
    expect(listenerCount(a)).toBe(1)
    rerender(<Probe query={b} ssrDefault={false} />)
    expect(listenerCount(a), 'the old query must be unsubscribed').toBe(0)
    expect(listenerCount(b)).toBe(1)
    expect(container.textContent).toBe('true')
  })

  it('hydrates with ssrDefault first, then the live value, with no hydration mismatch', () => {
    const q = '(min-width: 5px)'
    initial.set(q, true)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const html = renderToString(<Probe query={q} ssrDefault={false} />)
    expect(html).toContain('false')
    seen = []
    const onRecoverableError = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      act(() => {
        root = hydrateRoot(container, <Probe query={q} ssrDefault={false} />, { onRecoverableError })
      })
      expect(
        seen[0],
        'the first hydration render must return ssrDefault (false); returning the live snapshot there is the mismatch',
      ).toBe(false)
      expect(seen.at(-1)).toBe(true)
      expect(container.textContent).toBe('true')
      const mismatch = errors.mock.calls.filter((c) => /hydrat|mismatch/i.test(c.map(String).join(' ')))
      expect(mismatch).toEqual([])
      expect(onRecoverableError, 'no recoverable hydration error').not.toHaveBeenCalled()
    } finally {
      act(() => root?.unmount())
      container.remove()
    }
  })
})
