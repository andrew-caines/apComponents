'use client'

import { useEffect, useState, type RefObject } from 'react'

/**
 * Tracks the content box of `ref`'s element. Returns `undefined` until the
 * observer first reports, and always where `ResizeObserver` does not exist
 * (the server, older browsers). The ref must be attached when the hook's
 * effect runs; a node that mounts later is observed only after a dependency
 * changes.
 */
export function useResizeObserver(
  ref: RefObject<Element | null>,
): { width: number; height: number } | undefined {
  const [size, setSize] = useState<{ width: number; height: number } | undefined>(undefined)
  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      )
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return size
}
