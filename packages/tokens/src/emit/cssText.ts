import type { Mode } from '../colour/types.js'
import type { RampName, Theme } from '../theme/generateTheme.js'

const RAMP_ORDER: RampName[] = ['brand', 'danger', 'info', 'neutral', 'success', 'warning']

function tier1Lines(theme: Theme, mode: Mode): string[] {
  const lines: string[] = []
  for (const name of RAMP_ORDER) {
    const ramp = theme.ramps[mode][name]
    ramp.steps.forEach((step, i) => lines.push(`--ap-${name}-${i + 1}: ${step.hex};`))
    lines.push(`--ap-${name}-contrast: ${ramp.onSolid};`)
  }
  return lines
}

function tier2Lines(theme: Theme): string[] {
  return theme.semantic.map((e) =>
    e.step === 'onSolid'
      ? `--ap-${e.token}: var(--ap-${e.ramp}-contrast);`
      : `--ap-${e.token}: var(--ap-${e.ramp}-${e.step});`,
  )
}

function scaleLines(theme: Theme, mode: Mode): string[] {
  const { space, text, radius, elevation, z, misc } = theme.scales
  const lines: string[] = []
  for (const [k, v] of Object.entries(space)) lines.push(`--ap-space-${k}: ${v};`)
  for (const [k, v] of Object.entries(text)) {
    lines.push(`--ap-text-${k}-size: ${v.size};`, `--ap-text-${k}-lh: ${v.lineHeight};`)
  }
  for (const [k, v] of Object.entries(radius)) lines.push(`--ap-radius-${k}: ${v};`)
  for (const [k, v] of Object.entries(elevation[mode])) lines.push(`--ap-shadow-${k}: ${v};`)
  for (const [k, v] of Object.entries(z)) lines.push(`--ap-z-${k}: ${v};`)
  lines.push(
    `--ap-font-body: ${theme.font.stack};`,
    `--ap-font-heading: var(--ap-font-body);`,
    `--ap-font-mono: ui-monospace, 'Cascadia Code', Menlo, monospace;`,
    `--ap-font-weight-regular: ${theme.font.weights.regular};`,
    `--ap-font-weight-medium: ${theme.font.weights.medium};`,
    `--ap-font-weight-semibold: ${theme.font.weights.semibold};`,
  )
  for (const [k, v] of Object.entries(misc)) {
    if (k === 'hit-target-coarse') continue // emitted under the coarse media query
    lines.push(`--ap-${k}: ${v};`)
  }
  return lines
}

/** Tokens that differ between modes: Tier 1 ramps + shadows. */
const darkLines = (theme: Theme): string[] => [
  ...tier1Lines(theme, 'dark'),
  ...Object.entries(theme.scales.elevation.dark).map(([k, v]) => `--ap-shadow-${k}: ${v};`),
]

function p3Lines(theme: Theme, mode: Mode): string[] {
  const lines: string[] = []
  for (const name of RAMP_ORDER) {
    theme.ramps[mode][name].steps.forEach((step, i) => {
      if (step.p3) lines.push(`--ap-${name}-${i + 1}: ${step.p3};`)
    })
  }
  return lines
}

const block = (selector: string, lines: string[], indent: string): string =>
  lines.length === 0 ? '' : `${indent}${selector} {\n${lines.map((l) => `${indent}  ${l}`).join('\n')}\n${indent}}`

export function toCssText(theme: Theme): string {
  const light = [...tier1Lines(theme, 'light'), ...tier2Lines(theme), ...scaleLines(theme, 'light')]
  const dark = darkLines(theme)

  const parts = [
    '@layer ap.tokens, ap.components;',
    '',
    '@layer ap.tokens {',
    block(':root', light, '  '),
    '',
    block('[data-ap-scheme="dark"]', dark, '  '),
    '',
    '  @media (prefers-color-scheme: dark) {',
    block(':root:not([data-ap-scheme="light"])', dark, '    '),
    '  }',
    '',
    '  @media (color-gamut: p3) {',
    block(':root', p3Lines(theme, 'light'), '    '),
    block('[data-ap-scheme="dark"]', p3Lines(theme, 'dark'), '    '),
    '  }',
    '',
    '  @media (pointer: coarse) {',
    block(':root', [`--ap-hit-target: ${theme.scales.misc['hit-target-coarse']};`], '    '),
    '  }',
    '}',
    '',
  ]
  return parts.filter((p) => p !== null).join('\n').replace(/\n{3,}/g, '\n\n')
}

export function toFallbackFontFaceCss(theme: Theme): string {
  const { fallbackName, metrics } = theme.font
  if (!fallbackName || !metrics) return ''
  return [
    '@font-face {',
    `  font-family: '${fallbackName}';`,
    "  src: local('Arial');",
    `  size-adjust: ${metrics.sizeAdjust};`,
    `  ascent-override: ${metrics.ascentOverride};`,
    `  descent-override: ${metrics.descentOverride};`,
    `  line-gap-override: ${metrics.lineGapOverride};`,
    '}',
    '',
  ].join('\n')
}
