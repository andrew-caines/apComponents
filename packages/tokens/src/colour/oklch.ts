import type { Oklch } from './types.js'

export const round6 = (n: number): number => Math.round(n * 1e6) / 1e6

const srgbToLinear = (u: number): number =>
  u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4

const linearToSrgb = (u: number): number =>
  u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055

/**
 * Validate a hex colour and put it in canonical form: lowercase, six digits,
 * `#rgb` shorthand expanded textually. Expansion has to be textual — round
 * tripping through OKLCH is not identity-safe for every input.
 */
export function normalizeHex(hex: string): string {
  const m = /^#(?:([0-9a-f]{3})|([0-9a-f]{6}))$/i.exec(hex.trim())
  if (!m) throw new Error(`Invalid hex colour: ${hex}`)
  const full = m[1] ? [...m[1]].map((ch) => ch + ch).join('') : m[2]!
  return `#${full.toLowerCase()}`
}

export function hexToOklch(hex: string): Oklch {
  const full = normalizeHex(hex).slice(1)
  const r = srgbToLinear(parseInt(full.slice(0, 2), 16) / 255)
  const g = srgbToLinear(parseInt(full.slice(2, 4), 16) / 255)
  const b = srgbToLinear(parseInt(full.slice(4, 6), 16) / 255)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l + 0.793617785 * m_ - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m_ + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m_ - 0.808675766 * s

  const c = Math.hypot(a, bb)
  let h = (Math.atan2(bb, a) * 180) / Math.PI
  if (h < 0) h += 360
  // hue of an achromatic colour is numerically meaningless noise — pin it
  return { l: round6(L), c: round6(c), h: c < 1e-6 ? 0 : round6(h) }
}

export function oklchToLinearSrgb(colour: Oklch): { r: number; g: number; b: number } {
  const hr = (colour.h * Math.PI) / 180
  const a = colour.c * Math.cos(hr)
  const bb = colour.c * Math.sin(hr)

  const l_ = colour.l + 0.3963377774 * a + 0.2158037573 * bb
  const m_ = colour.l - 0.1055613458 * a - 0.0638541728 * bb
  const s_ = colour.l - 0.0894841775 * a - 1.291485548 * bb

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

export function oklchToHex(colour: Oklch): string {
  const lin = oklchToLinearSrgb(colour)
  const to255 = (u: number): string =>
    Math.round(Math.min(1, Math.max(0, linearToSrgb(u))) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to255(lin.r)}${to255(lin.g)}${to255(lin.b)}`
}
