// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStorageStateForTests, useLocalStorage, useSessionStorage } from './useStorage.js'
import type { StorageSetter } from './useStorage.js'

let seen: unknown[] = []
let api: { set: StorageSetter<number>; remove: () => void } | null = null

function Num({ k = 'n', label = 'a' }: { k?: string; label?: string }) {
  const [v, set, remove] = useLocalStorage<number>(k, 0)
  seen.push(v)
  if (label === 'a') api = { set, remove }
  return <span data-testid={label}>{String(v)}</span>
}

const quota = () => {
  throw new DOMException('full', 'QuotaExceededError')
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetStorageStateForTests()
  seen = []
  api = null
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useLocalStorage', () => {
  it('returns the default when the key is empty', () => {
    const { container } = render(<Num />)
    expect(container.textContent).toBe('0')
  })

  it('returns the default by reference', () => {
    const def = { a: 1 }
    let got: unknown
    function Obj() {
      got = useLocalStorage('obj', def)[0]
      return null
    }
    render(<Obj />)
    expect(got, 'an empty key must yield the very same default object').toBe(def)
  })

  it('reads an existing JSON value on the first client-only render', () => {
    localStorage.setItem('n', '7')
    render(<Num />)
    expect(seen[0], 'a client-only mount has no server pass, so it reads storage immediately').toBe(7)
  })

  it('setValue writes JSON to storage and re-renders', () => {
    const { container } = render(<Num />)
    act(() => api!.set(3))
    expect(localStorage.getItem('n')).toBe('3')
    expect(container.textContent).toBe('3')
  })

  it('the updater form composes against the current value', () => {
    const { container } = render(<Num />)
    act(() => api!.set((p) => p + 1))
    act(() => api!.set((p) => p + 1))
    expect(container.textContent).toBe('2')
    expect(localStorage.getItem('n')).toBe('2')
  })

  it('the updater resolves against the stored value at call time, not a stale render value', () => {
    const { container } = render(<Num />)
    const stale = api!.set
    localStorage.setItem('n', '10')
    act(() => stale((p) => p + 1))
    expect(container.textContent).toBe('11')
  })

  it('remove() restores the default and deletes the key', () => {
    localStorage.setItem('n', '9')
    const { container } = render(<Num />)
    expect(container.textContent).toBe('9')
    act(() => api!.remove())
    expect(container.textContent).toBe('0')
    expect(localStorage.getItem('n')).toBeNull()
  })

  it('setValue and remove are stable across renders for the same key', () => {
    const sets: StorageSetter<number>[] = []
    const removes: Array<() => void> = []
    function P() {
      const [, s, r] = useLocalStorage<number>('n', 0)
      sets.push(s)
      removes.push(r)
      return null
    }
    render(<P />)
    act(() => sets[0]!(1))
    expect(sets.length).toBeGreaterThan(1)
    expect(new Set(sets).size).toBe(1)
    expect(new Set(removes).size).toBe(1)
  })

  it('two components on the same key in one tab both update', () => {
    const { getByTestId } = render(
      <>
        <Num label="a" />
        <Num label="b" />
      </>,
    )
    act(() => api!.set(4))
    expect(getByTestId('a').textContent).toBe('4')
    expect(
      getByTestId('b').textContent,
      'storage events do not fire in the writing tab, so only the same-tab emitter can update the sibling',
    ).toBe('4')
  })

  it('remove() also updates a sibling on the same key', () => {
    localStorage.setItem('n', '5')
    const { getByTestId } = render(
      <>
        <Num label="a" />
        <Num label="b" />
      </>,
    )
    act(() => api!.remove())
    expect(getByTestId('b').textContent).toBe('0')
  })

  it('re-renders on a storage event for its key, and not for another key', () => {
    const { container } = render(<Num />)
    localStorage.setItem('n', '8')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'other', storageArea: localStorage }))
    })
    expect(container.textContent, 'an event for another key must not read the key').toBe('0')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'n', storageArea: localStorage }))
    })
    expect(container.textContent).toBe('8')
  })

  it('re-renders on a storage event with a null key (clear)', () => {
    localStorage.setItem('n', '8')
    const { container } = render(<Num />)
    expect(container.textContent).toBe('8')
    localStorage.clear()
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }))
    })
    expect(container.textContent).toBe('0')
  })

  it('ignores a storage event from the other area', () => {
    const { container } = render(<Num />)
    localStorage.setItem('n', '8')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'n', storageArea: sessionStorage }))
    })
    expect(container.textContent, 'a session-area event must not wake a local-area hook').toBe('0')
  })

  it('removes its storage listener on unmount', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<Num />)
    const added = add.mock.calls.filter((c) => c[0] === 'storage')
    expect(added.length).toBe(1)
    unmount()
    const removed = remove.mock.calls.filter((c) => c[0] === 'storage')
    expect(removed.length).toBe(1)
    expect(removed[0]![1]).toBe(added[0]![1])
  })

  it('blocked storage: setValue does not throw and falls back to memory plus the emitter', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quota)
    const { getByTestId } = render(
      <>
        <Num label="a" />
        <Num label="b" />
      </>,
    )
    expect(() => act(() => api!.set(5))).not.toThrow()
    expect(getByTestId('a').textContent).toBe('5')
    expect(getByTestId('b').textContent).toBe('5')
    expect(localStorage.getItem('n')).toBeNull()
  })

  it('blocked storage: remove clears the memory fallback too', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quota)
    const { container } = render(<Num />)
    act(() => api!.set(5))
    expect(container.textContent).toBe('5')
    spy.mockRestore()
    act(() => api!.remove())
    expect(container.textContent).toBe('0')
  })

  it('a later successful write supersedes the memory fallback', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quota)
    const { container } = render(<Num />)
    act(() => api!.set(5))
    spy.mockRestore()
    act(() => api!.set(6))
    expect(container.textContent).toBe('6')
    localStorage.setItem('n', '9')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'n', storageArea: localStorage }))
    })
    expect(container.textContent, 'a stale memory entry would still say 5').toBe('9')
  })

  it('unavailable storage (property access throws): memory only, with notify', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const { getByTestId } = render(
      <>
        <Num label="a" />
        <Num label="b" />
      </>,
    )
    expect(getByTestId('a').textContent).toBe('0')
    expect(() => act(() => api!.set(2))).not.toThrow()
    expect(getByTestId('a').textContent).toBe('2')
    expect(getByTestId('b').textContent).toBe('2')
  })

  it('corrupt JSON returns the default and warns once across renders', () => {
    localStorage.setItem('n', '{')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container, rerender } = render(<Num />)
    rerender(<Num />)
    expect(container.textContent).toBe('0')
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('useSessionStorage', () => {
  let sApi: { set: StorageSetter<number> } | null = null
  function SNum() {
    const [v, set] = useSessionStorage<number>('s', 0)
    sApi = { set }
    return <span>{String(v)}</span>
  }

  it('writes to session storage, not local storage', () => {
    const { container } = render(<SNum />)
    act(() => sApi!.set(3))
    expect(sessionStorage.getItem('s')).toBe('3')
    expect(localStorage.getItem('s')).toBeNull()
    expect(container.textContent).toBe('3')
  })

  it('does not cross-talk with local storage on the same key', () => {
    function Both() {
      const [l, setL] = useLocalStorage<number>('same', 0)
      const [s, setS] = useSessionStorage<number>('same', 0)
      api = { set: setL, remove: () => {} }
      sApi = { set: setS }
      return <span>{`${l}|${s}`}</span>
    }
    const { container } = render(<Both />)
    act(() => api!.set(1))
    expect(container.textContent).toBe('1|0')
    act(() => sApi!.set(2))
    expect(container.textContent).toBe('1|2')
  })
})

describe('hydration', () => {
  function Str() {
    const [v] = useLocalStorage<string>('h', 'default')
    seen.push(v)
    return <span>{v}</span>
  }

  it('renders the default first, then the stored value, with no hydration error', () => {
    localStorage.setItem('h', '"stored"')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const html = renderToString(<Str />)
    expect(html).toContain('default')
    seen = []
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    const onRecoverableError = vi.fn()
    act(() => {
      hydrateRoot(container, <Str />, { onRecoverableError })
    })
    expect(
      seen[0],
      'the first hydration render must use the server snapshot (the default); returning stored data there is the mismatch',
    ).toBe('default')
    expect(seen.at(-1)).toBe('stored')
    expect(container.textContent).toBe('stored')
    expect(onRecoverableError).not.toHaveBeenCalled()
    const mismatch = errors.mock.calls.filter((c) => /hydrat|mismatch/i.test(c.map(String).join(' ')))
    expect(mismatch).toEqual([])
    container.remove()
  })
})

describe('value identity', () => {
  it('returns the same object across renders with an inline default and unchanged storage', () => {
    localStorage.setItem('o', '{"a":2}')
    const values: unknown[] = []
    function Obj() {
      values.push(useLocalStorage('o', { a: 1 })[0])
      return null
    }
    const { rerender } = render(<Obj />)
    rerender(<Obj />)
    rerender(<Obj />)
    expect(values.length).toBeGreaterThan(2)
    expect(values[0]).toEqual({ a: 2 })
    expect(
      new Set(values).size,
      'a fresh inline default must not re-run JSON.parse and hand back a new object each render',
    ).toBe(1)
  })
})
