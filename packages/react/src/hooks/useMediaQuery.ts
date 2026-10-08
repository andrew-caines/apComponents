'use client'

import { useCallback, useSyncExternalStore } from 'react'

function subscribeMediaQuery(query: string, onChange: () => void): () => void {
  const list = window.matchMedia(query)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function readMediaQuery(query: string): boolean {
  return window.matchMedia(query).matches
}

/**
 * Tracks a CSS media query.
 *
 * ADR-0005: browser-only state resolves after hydration, never during render.
 * The server has no viewport, so it cannot know the answer; `ssrDefault` is
 * what the server renders AND what the hydration pass renders, so the two
 * match. Right after hydration React re-renders with the live value. A
 * client-only mount has no server pass to match and reads the live value
 * straight away.
 *
 * `ssrDefault` is required, not optional: every caller must decide what the
 * server should assume (for example, `false` for a desktop-only layout), and a
 * silent default would hide that choice.
 */
export function useMediaQuery(query: string, ssrDefault: boolean): boolean {
  const subscribe = useCallback((onChange: () => void) => subscribeMediaQuery(query, onChange), [query])
  const getSnapshot = useCallback(() => readMediaQuery(query), [query])
  return useSyncExternalStore(subscribe, getSnapshot, () => ssrDefault)
}
