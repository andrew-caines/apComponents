'use client'

import { usePreviousValue } from '@base-ui/utils/usePreviousValue'

/**
 * The previous DISTINCT value: it changes only when `value` changes, so an
 * unrelated re-render with the same value still returns the earlier value.
 * `null` until the value has changed once.
 */
export function usePrevious<T>(value: T): T | null {
  return usePreviousValue(value)
}
