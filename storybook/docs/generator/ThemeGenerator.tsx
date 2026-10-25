import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_BRAND, generateTheme, normalizeHex } from '@ap/tokens'
import { useDebouncedValue } from '@ap/react/hooks'
import { brandParamValue, mirrorBrand, readBrandParam } from './logic.js'
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

export function ThemeGenerator({ initialBrand, syncUrl = true }: ThemeGeneratorProps) {
  const [brand, setBrand] = useState(() =>
    normalizeHex(initialBrand ?? (syncUrl ? readBrandParam(window.location.search) : null) ?? DEFAULT_BRAND),
  )
  // Picker drags fire an event per frame; only a value that has settled for
  // SEED_DEBOUNCE_MS regenerates the theme. SeedInput only ever reports a valid hex.
  const settled = useDebouncedValue(brand, SEED_DEBOUNCE_MS)
  const theme = useMemo(() => generateTheme({ brand: settled }), [settled])
  // A test hook counting theme generations. Counted in an effect, written straight to
  // the DOM, so render stays pure.
  const generations = useRef(0)
  const counter = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    generations.current += 1
    if (counter.current) counter.current.dataset.count = String(generations.current)
  }, [theme])

  // Mirror only once the visitor has changed the brand. Writing on mount would
  // add `brand=` to a URL nobody edited, and would overwrite a top-window
  // `brand=` that this iframe did not read (a revisit).
  const firstBrand = useRef(brand)
  const edited = useRef(false)
  useEffect(() => {
    if (!syncUrl) return
    if (!edited.current && settled === firstBrand.current) return
    edited.current = true
    mirrorBrand(brandParamValue(settled))
  }, [settled, syncUrl])

  return (
    <div className="gen">
      <SeedInput value={brand} onChange={setBrand} />
      <span hidden ref={counter} data-testid="generations" />
      <Preview theme={theme} />
      <RampView theme={theme} />
      <ContrastTable theme={theme} />
      <Export theme={theme} brand={settled} />
    </div>
  )
}
