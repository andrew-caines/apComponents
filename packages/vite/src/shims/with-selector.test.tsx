// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { createElement, type FC } from 'react'
import { renderToString } from 'react-dom/server'
import { useSyncExternalStore as upstreamShim } from 'use-sync-external-store/shim'
import { useSyncExternalStoreWithSelector as upstream } from 'use-sync-external-store/shim/with-selector'
import { describe, expect, it } from 'vitest'
import { useSyncExternalStore as portShim } from './use-sync-external-store-shim.js'
import { useSyncExternalStoreWithSelector as port } from './with-selector.js'

type Impl = typeof upstream

interface State {
  count: number
  label: string
}

function createStore(initial: State) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next: State) {
      state = next
      for (const l of listeners) l()
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

/** Renders a component selecting `count` through `impl`, and counts its renders. */
function mount(impl: Impl, store: ReturnType<typeof createStore>, isEqual?: (a: number, b: number) => boolean) {
  const renders = { n: 0 }
  const Probe: FC = () => {
    renders.n++
    const count = impl(store.subscribe, store.get, store.get, (s: State) => s.count, isEqual)
    return createElement('span', { 'data-testid': 'v' }, String(count))
  }
  const view = render(createElement(Probe))
  return { renders, text: () => view.getByTestId('v').textContent }
}

describe.each([
  ['upstream', upstream],
  ['port', port],
] as const)('useSyncExternalStoreWithSelector (%s)', (_name, impl) => {
  it('returns the selected slice on the client', () => {
    const store = createStore({ count: 1, label: 'a' })
    expect(mount(impl, store).text()).toBe('1')
  })

  it('re-renders when the selection changes', () => {
    const store = createStore({ count: 1, label: 'a' })
    const m = mount(impl, store)
    act(() => store.set({ count: 2, label: 'a' }))
    expect(m.text()).toBe('2')
  })

  // An object selection is a new reference every time, so only `isEqual` can
  // stop the re-render; a primitive would be stopped by Object.is alone.
  const mountObject = (store: ReturnType<typeof createStore>, isEqual?: (a: { count: number }, b: { count: number }) => boolean) => {
    const renders = { n: 0 }
    const Probe: FC = () => {
      renders.n++
      const sel = impl(store.subscribe, store.get, store.get, (s: State) => ({ count: s.count }), isEqual)
      return createElement('span', null, String(sel.count))
    }
    render(createElement(Probe))
    return renders
  }

  it('does not re-render when isEqual says the selection is unchanged', () => {
    const store = createStore({ count: 1, label: 'a' })
    const renders = mountObject(store, (a, b) => a.count === b.count)
    const before = renders.n
    act(() => store.set({ count: 1, label: 'changed' }))
    expect(renders.n).toBe(before)
  })

  it('re-renders for a new object selection when there is no isEqual', () => {
    const store = createStore({ count: 1, label: 'a' })
    const renders = mountObject(store)
    const before = renders.n
    act(() => store.set({ count: 1, label: 'changed' }))
    expect(renders.n).toBeGreaterThan(before)
  })

  it('uses getServerSnapshot during server render', () => {
    const client = { count: 1, label: 'client' }
    const server = { count: 9, label: 'server' }
    const Probe: FC = () => {
      const count = impl(
        () => () => {},
        () => client,
        () => server,
        (s: State) => s.count,
      )
      return createElement('span', null, String(count))
    }
    expect(renderToString(createElement(Probe))).toBe('<span>9</span>')
  })
})

describe('use-sync-external-store/shim replacement', () => {
  it("is React's own useSyncExternalStore, like upstream's on React 19", () => {
    expect(portShim).toBe(upstreamShim)
  })
})
