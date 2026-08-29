import type { Oklch } from './types.js'
import { oklchToLinearSrgb, round6 } from './oklch.js'

const EPS = 1e-6

/** OKLab non-linear LMS → XYZ (inverse of Ottosson M1). */
const LMS_TO_XYZ = [
  [1.2270138511, -0.5577999807, 0.281256149],
  [-0.0405801784, 1.1122568696, -0.0716766787],
  [-0.0763812845, -0.4214819784, 1.5861632204],
] as const

/** XYZ (D65) → linear Display-P3. */
const XYZ_TO_P3 = [
  [2.4934969119, -0.9313836179, -0.4027107845],
  [-0.8294889696, 1.7626640603, 0.0236246858],
  [0.0358458302, -0.0761723893, 0.956884524],
] as const

function oklchToLinearP3(colour: Oklch): { r: number; g: number; b: number } {
  const hr = (colour.h * Math.PI) / 180
  const a = colour.c * Math.cos(hr)
  const bb = colour.c * Math.sin(hr)
  const l_ = colour.l + 0.3963377774 * a + 0.2158037573 * bb
  const m_ = colour.l - 0.1055613458 * a - 0.0638541728 * bb
  const s_ = colour.l - 0.0894841775 * a - 1.291485548 * bb
  const lms = [l_ ** 3, m_ ** 3, s_ ** 3]
  const xyz = LMS_TO_XYZ.map((row) => row[0] * lms[0]! + row[1] * lms[1]! + row[2] * lms[2]!)
  const [r, g, b] = XYZ_TO_P3.map(
    (row) => row[0] * xyz[0]! + row[1] * xyz[1]! + row[2] * xyz[2]!,
  )
  return { r: r!, g: g!, b: b! }
}

const within01 = (v: { r: number; g: number; b: number }): boolean =>
  v.r >= -EPS && v.r <= 1 + EPS && v.g >= -EPS && v.g <= 1 + EPS && v.b >= -EPS && v.b <= 1 + EPS

export const inSrgb = (colour: Oklch): boolean => within01(oklchToLinearSrgb(colour))
export const inP3 = (colour: Oklch): boolean => within01(oklchToLinearP3(colour))

function clampChroma(colour: Oklch, isIn: (c: Oklch) => boolean): Oklch {
  if (isIn(colour)) return colour
  let lo = 0
  let hi = colour.c
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2
    if (isIn({ ...colour, c: mid })) lo = mid
    else hi = mid
  }
  return { ...colour, c: Math.floor(lo * 1e6) / 1e6 }
}

export const clampToSrgb = (colour: Oklch): Oklch => clampChroma(colour, inSrgb)
export const clampToP3 = (colour: Oklch): Oklch => clampChroma(colour, inP3)

const linearToP3Gamma = (u: number): number =>
  u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055

export function formatP3(colour: Oklch): string {
  const lin = oklchToLinearP3(clampToP3(colour))
  const ch = (u: number): number =>
    Math.round(Math.min(1, Math.max(0, linearToP3Gamma(u))) * 1e4) / 1e4
  return `color(display-p3 ${ch(lin.r)} ${ch(lin.g)} ${ch(lin.b)})`
}
