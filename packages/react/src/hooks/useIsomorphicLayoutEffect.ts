'use client'

import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` warns when it runs on the server, because there is no
 * layout to measure. This picks `useEffect` there instead.
 *
 * The check is `typeof document !== 'undefined'` rather than a `window` test
 * because that is the condition React itself uses, and it is evaluated once at
 * module load — not during render, where reading a browser global is banned
 * (ADR-0005).
 */
export const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect
