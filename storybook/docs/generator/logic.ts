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
