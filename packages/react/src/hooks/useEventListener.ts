'use client'

import { useEffect, type RefObject } from 'react'
import { useStableCallback } from '@base-ui/utils/useStableCallback'

/**
 * Attaches `handler` for `type` on `target` (an EventTarget or a ref to one).
 * A `null` or `undefined` target attaches nothing. A new handler does not
 * re-subscribe; a new target, type, `capture`, `passive` or `once` does.
 * A ref target must be attached when the hook's effect runs; a node that
 * mounts later is listened to only after a dependency changes.
 */
export function useEventListener<K extends string>(
  target: EventTarget | RefObject<EventTarget | null> | null | undefined,
  type: K,
  handler: (event: Event) => void,
  options?: AddEventListenerOptions,
): void {
  const onEvent = useStableCallback(handler)
  const capture = options?.capture
  const passive = options?.passive
  const once = options?.once
  useEffect(() => {
    const resolved = target && 'current' in target ? target.current : target
    if (!resolved) return undefined
    const listenerOptions: AddEventListenerOptions = {
      ...(capture === undefined ? {} : { capture }),
      ...(passive === undefined ? {} : { passive }),
      ...(once === undefined ? {} : { once }),
    }
    const listener = (event: Event) => onEvent(event)
    resolved.addEventListener(type, listener, listenerOptions)
    return () => resolved.removeEventListener(type, listener, listenerOptions)
  }, [target, type, capture, passive, once, onEvent])
}
