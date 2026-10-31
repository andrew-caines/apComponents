/**
 * An ESM port of `use-sync-external-store/shim/with-selector`'s
 * `useSyncExternalStoreWithSelector`, with the same signature and memoisation:
 * the selection is recomputed only when the snapshot changes, and `isEqual`
 * keeps the previous selection (so no re-render) when it says nothing changed.
 * Upstream is CommonJS; see `use-sync-external-store-shim.ts` for why that
 * matters. `with-selector.test.tsx` runs the same cases against both.
 */
import { useDebugValue, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

interface Instance<Selection> {
  hasValue: boolean
  value: Selection | null
}

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection {
  const instRef = useRef<Instance<Selection> | null>(null)
  if (instRef.current === null) instRef.current = { hasValue: false, value: null }
  const inst = instRef.current

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false
    let memoizedSnapshot: Snapshot
    let memoizedSelection: Selection

    const memoizedSelector = (nextSnapshot: Snapshot): Selection => {
      if (!hasMemo) {
        hasMemo = true
        memoizedSnapshot = nextSnapshot
        const nextSelection = selector(nextSnapshot)
        if (isEqual !== undefined && inst.hasValue) {
          const current = inst.value as Selection
          if (isEqual(current, nextSelection)) {
            memoizedSelection = current
            return current
          }
        }
        memoizedSelection = nextSelection
        return nextSelection
      }
      const prevSelection = memoizedSelection
      if (Object.is(memoizedSnapshot, nextSnapshot)) return prevSelection
      const nextSelection = selector(nextSnapshot)
      if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot
        return prevSelection
      }
      memoizedSnapshot = nextSnapshot
      memoizedSelection = nextSelection
      return nextSelection
    }

    const serverSnapshot = getServerSnapshot ?? null
    return [
      () => memoizedSelector(getSnapshot()),
      serverSnapshot === null ? undefined : () => memoizedSelector(serverSnapshot()),
    ] as const
  }, [getSnapshot, getServerSnapshot, selector, isEqual])

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection)

  useEffect(() => {
    inst.hasValue = true
    inst.value = value
  }, [value])

  useDebugValue(value)
  return value
}
