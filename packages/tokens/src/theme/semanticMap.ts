import type { RampName } from './generateTheme.js'

export interface SemanticEntry {
  token: string
  ramp: RampName
  step: number | 'onSolid'
}

const s = (token: string, ramp: RampName, step: number | 'onSolid'): SemanticEntry =>
  Object.freeze({ token, ramp, step })

// Shared singleton handed straight out on `theme.semantic` — frozen array of
// frozen entries so a consumer cannot re-point a token for every theme at once.
export const SEMANTIC_MAP: readonly SemanticEntry[] = Object.freeze([
  s('color-bg-canvas', 'neutral', 1),
  s('color-bg-surface', 'neutral', 2),
  s('color-bg-raised', 'neutral', 3),
  s('color-border-subtle', 'neutral', 6),
  s('color-border-normal', 'neutral', 7),
  s('color-border-interactive', 'neutral', 8),
  s('color-text-primary', 'neutral', 12),
  s('color-text-secondary', 'neutral', 11),
  s('color-action-bg', 'brand', 9),
  s('color-action-bg-hover', 'brand', 10),
  // `-on-solid` is text drawn ON the solid background; `-text` is the ramp's
  // colour used AS text on a neutral surface. The status ramps below have
  // always drawn that line; brand previously used `-text` for the on-solid
  // role, which meant the same suffix carried opposite meanings depending on
  // the ramp. Renamed here, while no component consumes it yet.
  s('color-action-on-solid', 'brand', 'onSolid'),
  s('color-action-text', 'brand', 11),
  s('color-action-bg-subtle', 'brand', 3),
  s('color-focus-ring', 'brand', 8),
  ...(['danger', 'warning', 'success', 'info'] as const).flatMap((name) => [
    s(`color-${name}-bg`, name, 9),
    s(`color-${name}-bg-subtle`, name, 3),
    s(`color-${name}-border`, name, 7),
    s(`color-${name}-text`, name, 11),
    s(`color-${name}-on-solid`, name, 'onSolid'),
    s(`color-${name}-bg-hover`, name, 10),
  ]),
])
