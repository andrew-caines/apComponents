import type { Mode } from '../colour/types.js'
import type { Theme } from '../theme/generateTheme.js'
import { resolveSemantic } from '../theme/generateTheme.js'
import { wcagRatio } from '../colour/wcag.js'
import { apcaLc } from '../colour/apca.js'

export interface ContrastPairing {
  mode: Mode
  fg: string
  bg: string
  fgHex: string
  bgHex: string
  ratio: number
  required: number
  apca: number
  pass: boolean
}

// [foreground token, background token, required WCAG ratio]
const PAIRINGS: Array<[string, string, number]> = [
  ['color-text-primary', 'color-bg-canvas', 4.5],
  ['color-text-primary', 'color-bg-surface', 4.5],
  ['color-text-primary', 'color-bg-raised', 4.5],
  ['color-text-secondary', 'color-bg-canvas', 4.5],
  ['color-text-secondary', 'color-bg-surface', 4.5],
  ['color-action-text', 'color-action-bg', 4.5],
  // Ruling F guarantees the hover step moves away from the on-solid text
  // colour, so text on hover is never less legible than text on the solid.
  ['color-action-text', 'color-action-bg-hover', 4.5],
  ['color-border-normal', 'color-bg-canvas', 3],
  ['color-border-normal', 'color-bg-surface', 3],
  ['color-text-secondary', 'color-bg-raised', 4.5],
  ['color-border-interactive', 'color-bg-canvas', 3],
  ['color-border-interactive', 'color-bg-surface', 3],
  ['color-focus-ring', 'color-bg-canvas', 3],
  ['color-focus-ring', 'color-bg-surface', 3],
  ...(['danger', 'warning', 'success', 'info'] as const).flatMap(
    (name): Array<[string, string, number]> => [
      [`color-${name}-on-solid`, `color-${name}-bg`, 4.5],
      [`color-${name}-text`, 'color-bg-canvas', 4.5],
      [`color-${name}-text`, `color-${name}-bg-subtle`, 4.5],
      [`color-${name}-border`, 'color-bg-canvas', 3],
    ],
  ),
]

export function contrastPairings(theme: Theme): ContrastPairing[] {
  return (['light', 'dark'] as Mode[]).flatMap((mode) =>
    PAIRINGS.map(([fg, bg, required]) => {
      const fgHex = resolveSemantic(theme, mode, fg)
      const bgHex = resolveSemantic(theme, mode, bg)
      const ratio = wcagRatio(fgHex, bgHex)
      return { mode, fg, bg, fgHex, bgHex, ratio, required, apca: apcaLc(fgHex, bgHex), pass: ratio >= required }
    }),
  )
}

/**
 * Throw if any Tier 2 pairing misses its required WCAG ratio. Returns void when
 * the theme is clean — the assertion form of `contrastPairings` for consumers
 * that want a hard failure rather than a report.
 */
export function assertThemeContrast(theme: Theme): void {
  const failures = contrastPairings(theme).filter((p) => !p.pass)
  if (failures.length === 0) return
  const detail = failures
    .map(
      (p) =>
        `  [${p.mode}] ${p.fg} on ${p.bg}: ${p.fgHex} on ${p.bgHex} = ${p.ratio.toFixed(2)}:1 (needs ${p.required}:1)`,
    )
    .join('\n')
  throw new Error(`assertThemeContrast: ${failures.length} failing pairing(s)\n${detail}`)
}

export function renderContrastReport(pairings: ContrastPairing[]): string {
  const rows = pairings.map(
    (p) =>
      `| ${p.mode} | \`${p.fg}\` | \`${p.bg}\` | ${p.fgHex} on ${p.bgHex} | ${p.ratio.toFixed(2)} | ${p.required} | ${p.apca.toFixed(1)} | ${p.pass ? 'PASS' : '**FAIL**'} |`,
  )
  const failures = pairings.filter((p) => !p.pass).length
  return [
    '# Contrast report (WCAG 2.1 AA gate — ADR-0008)',
    '',
    `Pairings: ${pairings.length} · Failures: ${failures}`,
    '',
    '| Mode | Foreground | Background | Colours | Ratio | Required | APCA Lc | Result |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n')
}
