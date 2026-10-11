import { hexToOklch, normalizeHex } from '@ap/tokens'

// Only for the Colour theory guide's comparison strip: a naive HSL ramp, to
// show why the engine does not build ramps this way.
const toHex = (n: number): string => Math.round(n * 255).toString(16).padStart(2, '0')

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number): number => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

function hexToHs(hex: string): { h: number; s: number } {
  const full = normalizeHex(hex)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0 }
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s }
}

/** `steps` colours at the seed's HSL hue and saturation, lightness evenly spaced 0.95 → 0.15. */
export function hslRamp(hex: string, steps: number): string[] {
  if (steps < 2) throw new RangeError('hslRamp needs at least 2 steps')
  const { h, s } = hexToHs(hex)
  return Array.from({ length: steps }, (_, i) => hslToHex(h, s, 0.95 - (0.8 * i) / (steps - 1)))
}

export function oklchLightness(hex: string): number {
  return hexToOklch(hex).l
}
