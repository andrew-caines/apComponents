// APCA-W3 0.0.98G-4g — constants from Myndex/SAPC-APCA (W3 licence).
const S_TRC = 2.4
const R_CO = 0.2126729
const G_CO = 0.7151522
const B_CO = 0.072175
const NORM_BG = 0.56
const NORM_TXT = 0.57
const REV_TXT = 0.62
const REV_BG = 0.65
const BLK_THRS = 0.022
const BLK_CLMP = 1.414
const SCALE = 1.14
const LO_OFFSET = 0.027
const LO_CLIP = 0.1
const DELTA_Y_MIN = 0.0005

function screenY(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`apcaLc needs #rrggbb, got: ${hex}`)
  const s = m[1]!
  const c = (p: string): number => (parseInt(p, 16) / 255) ** S_TRC
  return R_CO * c(s.slice(0, 2)) + G_CO * c(s.slice(2, 4)) + B_CO * c(s.slice(4, 6))
}

const softClamp = (y: number): number =>
  y > BLK_THRS ? y : y + (BLK_THRS - y) ** BLK_CLMP

export function apcaLc(textHex: string, bgHex: string): number {
  const yTxt = softClamp(screenY(textHex))
  const yBg = softClamp(screenY(bgHex))
  if (Math.abs(yBg - yTxt) < DELTA_Y_MIN) return 0

  let lc: number
  if (yBg > yTxt) {
    const sapc = (yBg ** NORM_BG - yTxt ** NORM_TXT) * SCALE
    lc = sapc < LO_CLIP ? 0 : sapc - LO_OFFSET
  } else {
    const sapc = (yBg ** REV_BG - yTxt ** REV_TXT) * SCALE
    lc = sapc > -LO_CLIP ? 0 : sapc + LO_OFFSET
  }
  return Math.round(lc * 100 * 1e4) / 1e4
}
