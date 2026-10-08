'use client'

import { createContext, useCallback, useMemo, useRef, useState } from 'react'
import type { BannerOptions } from './types.js'

export type BannerEntry = BannerOptions & { id: string }

export interface BannerContextValue {
  banners: BannerEntry[]
  /** Counts a mounted region and returns its own unregister, so StrictMode's replay stays balanced. */
  registerRegion: () => () => void
  close: (id: string) => void
}

/** Private. Outside a provider a region renders empty. */
export const BannerContext = createContext<BannerContextValue>({
  banners: [],
  registerRegion: () => () => {},
  close: () => {},
})

/**
 * Banner state for the provider. The region count lives in a ref, not state:
 * a `banner` event is decided synchronously, and the region registers in a
 * layout effect, which runs before any passive mount effect that calls
 * `banner()`. State would only be visible after a re-render.
 */
export function useBannerState() {
  const [banners, setBanners] = useState<BannerEntry[]>([])
  const regions = useRef(0)
  const warnedRegions = useRef(false)

  const registerRegion = useCallback(() => {
    regions.current += 1
    if (regions.current > 1 && !warnedRegions.current) {
      warnedRegions.current = true
      // A bare `process.env.NODE_ENV` check: see the comment on the dev warning in Select.tsx.
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          'More than one BannerRegion is mounted, so every banner renders (and is announced) in each region. ' +
            'Render a single <BannerRegion />.',
        )
      }
    }
    let active = true
    return () => {
      if (!active) return
      active = false
      regions.current -= 1
    }
  }, [])

  const hasRegion = useCallback(() => regions.current > 0, [])

  const show = useCallback((entry: BannerEntry) => {
    setBanners((current) =>
      current.some((b) => b.id === entry.id)
        ? current.map((b) => (b.id === entry.id ? entry : b))
        : [...current, entry],
    )
  }, [])

  const close = useCallback((id: string) => {
    setBanners((current) => current.filter((b) => b.id !== id))
  }, [])

  const value = useMemo<BannerContextValue>(
    () => ({ banners, registerRegion, close }),
    [banners, registerRegion, close],
  )

  return { value, show, close, hasRegion }
}
