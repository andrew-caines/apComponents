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

export function ThemeGenerator({ initialBrand, syncUrl = true }: ThemeGeneratorProps) {
  const [brand, setBrand] = useState(() =>
    normalizeHex(initialBrand ?? (syncUrl ? readBrandParam(window.location.search) : null) ?? DEFAULT_BRAND),
  )
  // Picker drags fire an event per frame; only a value that has settled for
  // 100 ms regenerates the theme. SeedInput only ever reports a valid hex.
  const settled = useDebouncedValue(brand, 100)
  const generations = useRef(0)
  const theme = useMemo(() => {
    generations.current += 1
    return generateTheme({ brand: settled })
  }, [settled])

  useEffect(() => {
    if (!syncUrl) return
    const url = new URL(window.location.href)
    url.searchParams.set('brand', brandParamValue(settled))
    window.history.replaceState(null, '', url)
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
