export { generateTheme, resolveSemantic } from './theme/generateTheme.js'
export type { Theme, ThemeSeed, RampName } from './theme/generateTheme.js'
export { SEMANTIC_MAP } from './theme/semanticMap.js'
export type { SemanticEntry } from './theme/semanticMap.js'
export type { Oklch, Mode } from './colour/types.js'
export { hexToOklch, oklchToHex, normalizeHex } from './colour/oklch.js'
export { wcagRatio } from './colour/wcag.js'
export { apcaLc } from './colour/apca.js'
export { breakpoints, media } from './breakpoints.js'
export { resolveFont } from './typography/fonts.js'
export type { ResolvedFont, FallbackMetrics, KnownFamily } from './typography/fonts.js'
export { toCssText, toFallbackFontFaceCss } from './emit/cssText.js'
export { DURATION, EASE, REDUCED_MOTION_DURATION } from './scales/motion.js'
export type { CssTextOptions } from './emit/cssText.js'
export type { Ramp, RampStep } from './colour/ramp.js'

/** Placeholder default brand until the seed decision (design doc §9.1). */
export const DEFAULT_BRAND = '#2e5fd9'
export {
  contrastPairings,
  renderContrastReport,
  assertThemeContrast,
} from './emit/contrastReport.js'
export type { ContrastPairing } from './emit/contrastReport.js'
