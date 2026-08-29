import { FONT_FALLBACKS } from './metrics.generated.js'

export type KnownFamily = 'Inter' | 'Roboto' | 'Open Sans' | 'Poppins' | 'Manrope'

export interface FallbackMetrics {
  sizeAdjust: string
  ascentOverride: string
  descentOverride: string
  lineGapOverride: string
}

export interface ResolvedFont {
  family: string
  stack: string
  fallbackName: string | null
  metrics: FallbackMetrics | null
  weights: { regular: 400; medium: 500; semibold: 600 }
}

const WEIGHTS = { regular: 400, medium: 500, semibold: 600 } as const

const isKnown = (family: string): family is KnownFamily => family in FONT_FALLBACKS

export function resolveFont(input?: { family: string; metrics?: FallbackMetrics }): ResolvedFont {
  const family = input?.family ?? 'Inter'
  const metrics = input?.metrics ?? (isKnown(family) ? FONT_FALLBACKS[family] : null)
  const fallbackName = metrics ? `${family} Fallback` : null
  const stack = fallbackName
    ? `'${family}', '${fallbackName}', system-ui, sans-serif`
    : `'${family}', system-ui, sans-serif`
  return { family, stack, fallbackName, metrics, weights: WEIGHTS }
}
