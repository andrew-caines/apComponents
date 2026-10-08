'use client'

import { useEffect, type RefObject } from 'react'
import { ownerDocument } from '@base-ui/utils/owner'
import { useStableCallback } from '@base-ui/utils/useStableCallback'

export interface UseClickOutsideOptions {
  /** When false, nothing is attached. Defaults to true. */
  enabled?: boolean | undefined
}

/**
 * Calls `handler` for a `pointerdown` that lands outside `ref`. Uses the
 * event's composed path, so an element inside an open shadow root under `ref`
 * counts as inside (the event target is retargeted to the shadow host, which
 * a plain containment check on the target would get wrong).
 */
export function useClickOutside(
  ref: RefObject<Element | null>,
  handler: (event: PointerEvent) => void,
  options?: UseClickOutsideOptions,
): void {
  const enabled = options?.enabled ?? true
  const onOutside = useStableCallback(handler)
  useEffect(() => {
    const node = ref.current
    if (!enabled || !node) return undefined
    const doc = ownerDocument(node)
    const listener = (event: Event) => {
      const current = ref.current
      if (!current || event.composedPath().includes(current)) return
      onOutside(event as PointerEvent)
    }
    doc.addEventListener('pointerdown', listener)
    return () => doc.removeEventListener('pointerdown', listener)
  }, [ref, enabled, onOutside])
}
