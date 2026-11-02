import { DEFAULT_VIEWBOX, HALO_STROKE, SECONDARY_OPACITY, STROKE } from './constants.js'
import type { IconDefinition } from './types.js'

const paths = (ds: readonly string[], indent: string): string[] =>
  ds.map((d) => `${indent}<path d="${d}"/>`)

/** Serialise a definition to a standalone SVG file. Internal: not exported from the entry. */
export function toSvg(def: IconDefinition, opts: { duoTone: boolean }): string {
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="${def.viewBox ?? DEFAULT_VIEWBOX}" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">`,
  ]
  // Secondary paints first, then primary, matching the React renderer.
  if (opts.duoTone && def.secondary !== undefined) {
    if (def.secondary === 'halo') {
      lines.push(
        `  <g stroke-width="${HALO_STROKE}" stroke-opacity="${SECONDARY_OPACITY}">`,
        ...paths(def.primary, '    '),
        '  </g>',
      )
    } else {
      lines.push(
        `  <g fill="currentColor" fill-opacity="${SECONDARY_OPACITY}" stroke="none">`,
        ...paths(def.secondary, '    '),
        '  </g>',
      )
    }
  }
  lines.push(...paths(def.primary, '  '), '</svg>', '')
  return lines.join('\n')
}
