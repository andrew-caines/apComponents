'use client'

import { useEffect, useState } from 'react'
import { useTimeout } from '@base-ui/utils/useTimeout'

/**
 * Returns `value` after it has stayed unchanged for `delayMs`. The first
 * render returns the initial value at once. The pending timer is cleared on
 * unmount.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  const timeout = useTimeout()
  useEffect(() => {
    timeout.start(delayMs, () => setDebounced(value))
  }, [value, delayMs, timeout])
  return debounced
}
