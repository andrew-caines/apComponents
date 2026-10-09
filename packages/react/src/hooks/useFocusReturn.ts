'use client'

import { useRef } from 'react'
import { ownerDocument } from '@base-ui/utils/owner'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect.js'

/**
 * Remembers the focused element when `active` turns true and puts focus back
 * on it when `active` turns false or the component unmounts, provided it is
 * still connected.
 *
 * Call it in the component that owns the open state, and move focus into the
 * content in an effect or later, not with `autoFocus`. `autoFocus` runs at
 * commit, before any layout effect can record the previous element.
 */
export function useFocusReturn(active: boolean): void {
  const previous = useRef<Element | null>(null)
  useIsomorphicLayoutEffect(() => {
    if (!active) return undefined
    previous.current = ownerDocument(null).activeElement
    return () => {
      const el = previous.current
      previous.current = null
      if (el && el.isConnected && typeof (el as HTMLElement).focus === 'function') {
        ;(el as HTMLElement).focus()
      }
    }
  }, [active])
}
