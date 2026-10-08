'use client'

import { ownerWindow } from '@base-ui/utils/owner'
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

export type StorageSetter<T> = (next: T | ((prev: T) => T)) => void

type StorageKind = 'local' | 'session'

// Every browser-storage access lives in the module-level helpers below, and
// getArea is the only one that names the browser storage objects at all. The
// SSR-safety gate pins that with an AST check, so a read cannot slip into a
// hook body (ADR-0005: browser-only state resolves after hydration).

/** The storage area, or null when it is blocked (property access can throw). */
function getArea(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? localStorage : sessionStorage
  } catch {
    return null
  }
}

// Values whose write failed (quota, blocked storage) live here, so the hook
// still behaves for the rest of the page's life.
const memory = new Map<string, string>()
const listeners = new Map<string, Set<() => void>>()
const warned = new Set<string>()

const idOf = (kind: StorageKind, key: string) => `${kind}:${key}`

function readRaw(kind: StorageKind, key: string): string | null {
  const held = memory.get(idOf(kind, key))
  if (held !== undefined) return held
  try {
    return getArea(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

function notify(kind: StorageKind, key: string): void {
  listeners.get(idOf(kind, key))?.forEach((fn) => fn())
}

function writeRaw(kind: StorageKind, key: string, raw: string): void {
  const id = idOf(kind, key)
  try {
    const area = getArea(kind)
    if (!area) throw new Error('storage unavailable')
    area.setItem(key, raw)
    memory.delete(id)
  } catch {
    memory.set(id, raw)
  }
  notify(kind, key)
}

function removeRaw(kind: StorageKind, key: string): void {
  memory.delete(idOf(kind, key))
  try {
    getArea(kind)?.removeItem(key)
  } catch {
    // Nothing more to do: the memory entry is already gone.
  }
  notify(kind, key)
}

function subscribeStorage(kind: StorageKind, key: string, onChange: () => void): () => void {
  const id = idOf(kind, key)
  let set = listeners.get(id)
  if (!set) {
    set = new Set()
    listeners.set(id, set)
  }
  set.add(onChange)

  // `storage` events fire only in OTHER tabs, hence the emitter above.
  const target = ownerWindow(null)
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== getArea(kind)) return
    if (event.key === key || event.key === null) onChange()
  }
  target.addEventListener('storage', onStorage)

  return () => {
    target.removeEventListener('storage', onStorage)
    set.delete(onChange)
    if (set.size === 0) listeners.delete(id)
  }
}

/** Test-only: clears the in-memory fallback and the warn-once record. Not exported from the barrel. */
export function resetStorageStateForTests(): void {
  memory.clear()
  listeners.clear()
  warned.clear()
}

function parseRaw<T>(kind: StorageKind, key: string, raw: string | null, defaultValue: T): T {
  if (raw === null) return defaultValue
  try {
    return JSON.parse(raw) as T
  } catch {
    const id = idOf(kind, key)
    if (process.env.NODE_ENV !== 'production' && !warned.has(id)) {
      warned.add(id)
      console.warn(`[ap] storage key "${key}" holds invalid JSON; using the default value.`)
    }
    return defaultValue
  }
}

function useStorageValue<T>(kind: StorageKind, key: string, defaultValue: T): [T, StorageSetter<T>, () => void] {
  const subscribe = useCallback((onChange: () => void) => subscribeStorage(kind, key, onChange), [kind, key])
  const getSnapshot = useCallback(() => readRaw(kind, key), [kind, key])
  // The snapshot is the raw string: stable by value, so React never loops, and
  // the server snapshot (null) means the default, which is what hydration renders.
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null)
  const value = useMemo(() => parseRaw(kind, key, raw, defaultValue), [kind, key, raw, defaultValue])

  const defaultRef = useRef(defaultValue)
  useEffect(() => {
    defaultRef.current = defaultValue
  })

  const setValue = useCallback<StorageSetter<T>>(
    (next) => {
      const resolved =
        typeof next === 'function'
          ? (next as (prev: T) => T)(parseRaw(kind, key, readRaw(kind, key), defaultRef.current))
          : next
      writeRaw(kind, key, JSON.stringify(resolved))
    },
    [kind, key],
  )
  const remove = useCallback(() => removeRaw(kind, key), [kind, key])
  return [value, setValue, remove]
}

/**
 * Persists JSON state in the local storage area, shared across tabs and across
 * hooks on the same key. Resolves after hydration (the server and the
 * hydration pass render `defaultValue`). If a write fails the value is kept in
 * memory. An unparseable stored value yields `defaultValue` and warns once in
 * development.
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, StorageSetter<T>, () => void] {
  return useStorageValue('local', key, defaultValue)
}

/** Like `useLocalStorage`, for the per-tab session storage area. */
export function useSessionStorage<T>(key: string, defaultValue: T): [T, StorageSetter<T>, () => void] {
  return useStorageValue('session', key, defaultValue)
}
