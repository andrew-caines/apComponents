'use client'

import { useEffect, useState } from 'react'

/**
 * `false` during server render AND during the first client render, `true`
 * afterwards.
 *
 * Both halves matter. Returning `true` immediately on the client would make the
 * first client render differ from the server's, which is a hydration mismatch —
 * the exact failure this hook exists to prevent. The flip happens in an effect,
 * which runs only after hydration has already matched.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}
