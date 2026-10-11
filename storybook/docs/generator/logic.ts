import { normalizeHex } from '@ap/tokens'

/** The same shape `normalizeHex` accepts: `#rgb` or `#rrggbb`, any case. */
export const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export function isValidHex(v: string): boolean {
  return HEX_PATTERN.test(v.trim())
}

export function buildSnippet(hex: string): string {
  return `import { generateTheme } from '@ap/react'\n\nexport const theme = generateTheme({ brand: '${normalizeHex(hex)}' })\n`
}

/** `?brand=` with or without the leading `#`. Anything invalid is ignored, never thrown. */
export function readBrandParam(search: string): string | null {
  const v = new URLSearchParams(search).get('brand')
  if (!v) return null
  const hex = v.startsWith('#') ? v : `#${v}`
  return isValidHex(hex) ? normalizeHex(hex) : null
}

export function brandParamValue(hex: string): string {
  return normalizeHex(hex).slice(1)
}

/**
 * Writes `?brand=` where a visitor can copy it. In Storybook the generator runs
 * in the preview iframe, and the address bar belongs to the top window: write
 * there when it is same-origin, keeping its other params (`path` among them).
 * A cross-origin top throws on access, so fall back to this window's own URL.
 * That write can throw too (a sandboxed or opaque-origin frame), and the URL is
 * only a convenience, so a failure there is swallowed rather than breaking the page.
 */
export function mirrorBrand(value: string, win: Window = window): void {
  try {
    const top = win.top
    if (top && top !== win) {
      const url = new URL(top.location.href)
      url.searchParams.set('brand', value)
      top.history.replaceState(top.history.state, '', url)
      return
    }
  } catch {
    // Cross-origin top: fall through.
  }
  try {
    const url = new URL(win.location.href)
    url.searchParams.set('brand', value)
    win.history.replaceState(win.history.state, '', url)
  } catch {
    // This window refuses the write too: leave the URL alone.
  }
}
