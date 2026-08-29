const channel = (hexPair: string): number => {
  const u = parseInt(hexPair, 16) / 255
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`relativeLuminance needs #rrggbb, got: ${hex}`)
  const s = m[1]!
  return (
    0.2126 * channel(s.slice(0, 2)) +
    0.7152 * channel(s.slice(2, 4)) +
    0.0722 * channel(s.slice(4, 6))
  )
}

export function wcagRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  const [dark, light] = la < lb ? [la, lb] : [lb, la]
  return Math.round(((light + 0.05) / (dark + 0.05)) * 1e4) / 1e4
}
