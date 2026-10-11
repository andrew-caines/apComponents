import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_BRAND, generateTheme, normalizeHex } from '@ap/tokens'
import { useDebouncedValue } from '@ap/react/hooks'
import { brandParamValue, readBrandParam } from './logic.js'
import { SeedInput } from './SeedInput.js'
import { RampView } from './RampView.js'
import { ContrastTable } from './ContrastTable.js'
import { Preview } from './Preview.js'
import { Export } from './Export.js'
import '../docs.css'
import './generator.css'

export interface ThemeGeneratorProps {
  /** Starting brand. Overrides `?brand=`. Defaults to the house brand. */
  initialBrand?: string | undefined
  /** Read `?brand=` on mount and mirror changes into it. Stories turn this off. */
  syncUrl?: boolean | undefined
}

/** How long the seed must stay unchanged before the theme regenerates. */
export const SEED_DEBOUNCE_MS = 100

/**
 * Writes `?brand=` where a visitor can copy it. In Storybook the generator runs
 * in the preview iframe, and the address bar belongs to the top window: write
 * there when it is same-origin, keeping its other params (`path` among them).
 * A cross-origin top throws on access, so fall back to this window's own URL.
 */
function mirrorBrand(value: string): void {
  try {
    const top = window.top
    if (top && top !== window) {
      const url = new URL(top.location.href)
      url.searchParams.set('brand', value)
      top.history.replaceState(top.history.state, '', url)
      return
    }
  } catch {
    // Cross-origin top: fall through.
  }
  const url = new URL(window.location.href)
  url.searchParams.set('brand', value)
  window.history.replaceState(window.history.state, '', url)
}

export function ThemeGenerator({ initialBrand, syncUrl = true }: ThemeGeneratorProps) {
  const [brand, setBrand] = useState(() =>
    normalizeHex(initialBrand ?? (syncUrl ? readBrandParam(window.location.search) : null) ?? DEFAULT_BRAND),
  )
  // Picker drags fire an event per frame; only a value that has settled for
  // SEED_DEBOUNCE_MS regenerates the theme. SeedInput only ever reports a valid hex.
  const settled = useDebouncedValue(brand, SEED_DEBOUNCE_MS)
  const generations = useRef(0)
  const theme = useMemo(() => {
    generations.current += 1
    return generateTheme({ brand: settled })
  }, [settled])

  useEffect(() => {
    if (syncUrl) mirrorBrand(brandParamValue(settled))
  }, [settled, syncUrl])

  return (
    <div className="gen">
      <SeedInput value={brand} onChange={setBrand} />
      <span hidden data-testid="generations" data-count={generations.current} />
      <Preview theme={theme} />
      <RampView theme={theme} />
      <ContrastTable theme={theme} />
      <Export theme={theme} brand={settled} />
    </div>
  )
}
