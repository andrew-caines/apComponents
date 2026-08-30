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

/**
 * Dark P3 declarations, over the UNION of the light and dark P3 token names.
 *
 * The dark blocks have to shadow every token the light P3 block declares, not
 * just the ones that happen to have a dark P3 value. `:root:not([data-ap-scheme
 * ="dark"])` is (0,2,0) — the same specificity as the dark *hex* media block
 * and later in source order — so in system-dark on P3 hardware, any token the
 * dark P3 blocks skip falls through to the LIGHT P3 value. For the default seed
 * that hits --ap-success-11/--ap-success-12 (light P3, no dark P3), which would
 * resolve color-success-text to the light green at 2.78:1 on the dark canvas.
 *
 * So for each token in the union: the dark ramp's P3 string when it has one,
 * otherwise the dark ramp's plain hex. Ordering stays RAMP_ORDER, step ascending.
 */
function darkP3Lines(theme: Theme): string[] {
  const lines: string[] = []
  for (const name of RAMP_ORDER) {
    const lightSteps = theme.ramps.light[name].steps
    theme.ramps.dark[name].steps.forEach((step, i) => {
      if (!step.p3 && !lightSteps[i]!.p3) return
      lines.push(`--ap-${name}-${i + 1}: ${step.p3 ?? step.hex};`)
    })
  }
  return lines
}

const block = (selector: string, lines: string[], indent: string): string =>
  lines.length === 0 ? '' : `${indent}${selector} {\n${lines.map((l) => `${indent}  ${l}`).join('\n')}\n${indent}}`

export interface CssTextOptions {
  /**
   * Root selector the tokens are declared on. Defaults to `:root`.
   *
   * Scoping rule: every `:root` in the output is replaced by this selector
   * (so `:root:not([data-ap-scheme="light"])` becomes
   * `.scope:not([data-ap-scheme="light"])`), and the bare attribute selector
   * `[data-ap-scheme="dark"]` becomes `.scope[data-ap-scheme="dark"]` — i.e.
   * the scheme attribute is expected on the scoped element itself, not on an
   * ancestor. Passing `:root` reproduces the unscoped output byte for byte.
   */
  selector?: string
}

export function toCssText(theme: Theme, options: CssTextOptions = {}): string {
  const root = options.selector ?? ':root'
  const rootNotDark = `${root}:not([data-ap-scheme="dark"])`
  const rootNotLight = `${root}:not([data-ap-scheme="light"])`
  const attrDark = root === ':root' ? '[data-ap-scheme="dark"]' : `${root}[data-ap-scheme="dark"]`

  const light = [...tier1Lines(theme, 'light'), ...tier2Lines(theme), ...scaleLines(theme, 'light')]
  const dark = darkLines(theme)
  const p3Light = p3Lines(theme, 'light')
  const p3Dark = darkP3Lines(theme)

  const parts = [
    '@layer ap.tokens, ap.components;',
    '',
    '@layer ap.tokens {',
    block(root, light, '  '),
    '',
    block(attrDark, dark, '  '),
    '',
    '  @media (prefers-color-scheme: dark) {',
    block(rootNotLight, dark, '    '),
    '  }',
    '',
    // The P3 section mirrors the structure above exactly — light, dark by
    // attribute, dark by preference — so the cascade resolves the same way for
    // P3 overrides as it does for the sRGB hexes. The light P3 block is
    // :not([data-ap-scheme="dark"]) rather than bare :root: a bare :root here
    // has the same specificity as the dark attribute block but comes later in
    // source order, so it would overwrite attribute-dark with light values.
    // Likewise dark P3 needs its own nested prefers-color-scheme block: the
    // main dark media block is (0,2,0) and would otherwise outrank a (0,1,0)
    // P3 attribute selector, leaving system-dark with no P3 at all.
    // The dark P3 blocks span the union of both modes' P3 token names (see
    // darkP3Lines) so they fully shadow the light P3 block in system-dark.
    '  @media (color-gamut: p3) {',
    block(rootNotDark, p3Light, '    '),
    block(attrDark, p3Dark, '    '),
    p3Dark.length === 0 ? '' : '    @media (prefers-color-scheme: dark) {',
    block(rootNotLight, p3Dark, '      '),
    p3Dark.length === 0 ? '' : '    }',
    '  }',
    '',
    '  @media (pointer: coarse) {',
    block(root, [`--ap-hit-target: ${theme.scales.misc['hit-target-coarse']};`], '    '),
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
