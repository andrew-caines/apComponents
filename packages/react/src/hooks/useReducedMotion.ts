'use client'

import { useMediaQuery } from './useMediaQuery.js'

/**
 * `true` when the user asks the system for reduced motion. Assumes `false`
 * on the server and during hydration, then resolves to the live value.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)', false)
}
