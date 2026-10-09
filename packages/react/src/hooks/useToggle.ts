'use client'

import { useCallback, useState } from 'react'

/** A boolean with a stable `toggle` and a stable, idempotent `set`. */
export function useToggle(initial: boolean = false): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initial)
  const toggle = useCallback(() => setValue((prev) => !prev), [])
  const set = useCallback((next: boolean) => setValue(next), [])
  return [value, toggle, set]
}
