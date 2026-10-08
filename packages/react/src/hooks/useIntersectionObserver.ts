'use client'

import { useEffect, useState, type RefObject } from 'react'

export interface UseIntersectionObserverOptions {
  root?: Element | null | undefined
  rootMargin?: string | undefined
  threshold?: number | readonly number[] | undefined
}

/**
 * Returns the latest `IntersectionObserverEntry` for `ref`'s element, or
 * `undefined` until the observer first reports and wherever
 * `IntersectionObserver` does not exist. The observer is rebuilt when
 * `root`, `rootMargin` or the threshold values change; a new array literal
 * with equal values does not rebuild it. The ref must be attached when the
 * hook's effect runs; a node that mounts later is observed only after a
 * dependency changes.
 */
export function useIntersectionObserver(
  ref: RefObject<Element | null>,
  options?: UseIntersectionObserverOptions,
): IntersectionObserverEntry | undefined {
  const [entry, setEntry] = useState<IntersectionObserverEntry | undefined>(undefined)
  const root = options?.root
  const rootMargin = options?.rootMargin
  const threshold = options?.threshold
  const thresholdKey = String(threshold)
  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const init: IntersectionObserverInit = {
      ...(root === undefined ? {} : { root }),
      ...(rootMargin === undefined ? {} : { rootMargin }),
      ...(threshold === undefined ? {} : { threshold: threshold as number | number[] }),
    }
    const observer = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) setEntry(last)
    }, init)
    observer.observe(node)
    return () => observer.disconnect()
    // `threshold` is keyed by its string form so an equal array literal is stable.
  }, [ref, root, rootMargin, thresholdKey])
  return entry
}
