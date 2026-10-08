'use client'

import { useCallback, useRef } from 'react'
import { useControlled } from '@base-ui/utils/useControlled'
import { useStableCallback } from '@base-ui/utils/useStableCallback'
import { useValueAsRef } from '@base-ui/utils/useValueAsRef'

export interface UseControllableStateOptions<T> {
  value?: T | undefined
  defaultValue: T
  onChange?: ((value: T) => void) | undefined
  name?: string | undefined
}

/**
 * State that is controlled when `value` is supplied and uncontrolled
 * otherwise. `onChange` fires in both modes whenever the value changes.
 * The setter accepts a value or an updater, resolves updaters against the
 * latest value, ignores a same-value set, and is referentially stable.
 */
export function useControllableState<T>(
  options: UseControllableStateOptions<T>,
): [T, (next: T | ((prev: T) => T)) => void] {
  const { value: controlledValue, defaultValue, onChange, name } = options
  const [value, setUncontrolled] = useControlled<T>({
    controlled: controlledValue,
    default: defaultValue,
    name: name ?? 'useControllableState',
  })
  const isControlled = useRef(controlledValue !== undefined).current
  const handleChange = useStableCallback(onChange)
  const latest = useValueAsRef(value)

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = latest.current
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(current) : next
      if (Object.is(resolved, current)) return
      if (!isControlled) {
        // Keep the ref ahead of the render so a second updater in the same
        // handler composes with the first.
        latest.current = resolved
        setUncontrolled(resolved)
      }
      handleChange(resolved)
    },
    [latest, isControlled, setUncontrolled, handleChange],
  )

  return [value, setValue]
}
