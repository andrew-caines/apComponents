// Dev-only script: regenerates examples/colours/index.html.
// Run: npm run gen:colour-demo   — commit the output. Never edited by hand.
//
// The page is generated rather than hand-written for one reason: every token
// name, every hex label and every contrast ratio comes from the token source,
// so the page cannot claim something the tokens do not say. The *visual*
// colour, though, comes from the linked theme.css at render time — so if the
// generated stylesheet and the token source ever disagree, the swatch and its
// own label disagree visibly, and gen-colour-demo's verification pass fails.
import { mkdirSync, writeFileSync } from 'node:fs'
import {
  DEFAULT_BRAND,
  SEMANTIC_MAP,
  contrastPairings,
  generateTheme,
  resolveSemantic,
  wcagRatio,
  type Mode,
} from '@ap/tokens'
import { ICON_PATHS, type IconName } from '../packages/react/src/icons/paths.js'

const theme = generateTheme({ brand: DEFAULT_BRAND })
const MODES = ['light', 'dark'] as const
const ROLES = ['action', 'danger', 'warning', 'success', 'info'] as const

const hex = (mode: Mode, token: string) => resolveSemantic(theme, mode, token)
const v = (token: string) => `var(--ap-${token})`

// The gate's own pairing list, keyed for lookup. A pairing the gate enforces
// is labelled as such on the page; one it does not is still measured, but
// marked, so the page never implies coverage the suite does not have.
const gated = new Set(
  contrastPairings(theme).map((p) => `${p.mode}|${p.fg}|${p.bg}`),
)
const GATE_PAIRINGS = contrastPairings(theme)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A label whose value differs per mode: emit both, let CSS show one. */
function dual(render: (mode: Mode) => string): string {
  return MODES.map((m) => `<span class="only-${m}">${render(m)}</span>`).join('')
}

function icon(name: IconName, size = 'md'): string {
  return (
    `<svg style="width:var(--ap-icon-${size});height:var(--ap-icon-${size});flex:none" ` +
    `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
    `<path d="${ICON_PATHS[name]}"/></svg>`
  )
}

/** Measured ratio badge for a foreground/background token pair. */
function ratioBadge(fg: string, bg: string): string {
  return dual((mode) => {
    const r = wcagRatio(hex(mode, fg), hex(mode, bg))
    const isGated = gated.has(`${mode}|${fg}|${bg}`)
    const cls = r >= 4.5 ? 'ok' : r >= 3 ? 'mid' : 'low'
    return (
      `<span class="badge ${cls}" title="${esc(hex(mode, fg))} on ${esc(hex(mode, bg))}">` +
      `${r.toFixed(2)}:1${isGated ? ' <b>gated</b>' : ''}</span>`
    )
  })
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

const GROUPS: Array<[string, (t: string) => boolean]> = [
  ['Surfaces', (t) => t.startsWith('color-bg-')],
  ['Text', (t) => t.startsWith('color-text-')],
  ['Borders & focus', (t) => t.startsWith('color-border-') || t === 'color-focus-ring'],
  ...ROLES.map(
    (r): [string, (t: string) => boolean] => [r, (t) => t.startsWith(`color-${r}-`)],
  ),
]

function palette(): string {
  const blocks = GROUPS.map(([title, match]) => {
    const tokens = SEMANTIC_MAP.map((e) => e.token).filter(match)
    const cells = tokens
      .map(
        (t) =>
          `<div class="cell" data-token="${t}">
             <div class="swatch" style="background:${v(t)}"></div>
             <span class="tag mono">${esc(t.replace('color-', ''))}</span>
             <span class="tag mono dim">${dual((m) => esc(hex(m, t)))}</span>
           </div>`,
      )
      .join('')
    return `<h3>${esc(title)}</h3><div class="row">${cells}</div>`
  })
  return blocks.join('')
}

/** Foreground tokens that are meant to be drawn as text/icons. */
const FOREGROUNDS = [
  'color-text-primary',
  'color-text-secondary',
  'color-action-text',
  ...ROLES.filter((r) => r !== 'action').map((r) => `color-${r}-text`),
]
const SURFACES = ['color-bg-canvas', 'color-bg-surface', 'color-bg-raised']

function textOnSurfaces(): string {
  const head = `<tr><th>Foreground</th>${SURFACES.map(
    (s) => `<th>${esc(s.replace('color-bg-', ''))}</th>`,
  ).join('')}<th>own subtle</th></tr>`

  const rows = FOREGROUNDS.map((fg) => {
    const role = fg.match(/^color-(\w+)-text$/)?.[1]
    const own =
      role && role !== 'text' && SEMANTIC_MAP.some((e) => e.token === `color-${role}-bg-subtle`)
        ? `color-${role}-bg-subtle`
        : null
    const cells = [...SURFACES, own]
      .map((bg) => {
        if (!bg) return '<td class="tag dim">—</td>'
        return `<td>
          <div class="spec" style="background:${v(bg)};color:${v(fg)}" data-token="${fg}">
            ${icon('alert-circle')}<span>Handgloves</span>
          </div>
          ${ratioBadge(fg, bg)}
        </td>`
      })
      .join('')
    return `<tr><td class="tag mono">${esc(fg.replace('color-', ''))}</td>${cells}</tr>`
  }).join('')

  return `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`
}

function iconsRow(): string {
  return `<div class="row center">${FOREGROUNDS.map(
    (fg) => `<div class="cell" data-token="${fg}" style="color:${v(fg)};align-items:center">
       <span class="tag mono" style="color:var(--ap-color-text-secondary)">${esc(
         fg.replace('color-', '').replace('-text', ''),
       )}</span>
       ${icon('alert-circle', 'xl')}
     </div>`,
  ).join('')}</div>`
}

function solids(): string {
  const rows = ROLES.flatMap((role) =>
    ['bg', 'bg-hover'].map((step) => {
      const bg = `color-${role}-${step}`
      const fg = `color-${role}-on-solid`
      return `<tr>
        <td class="tag mono">${esc(role)} ${esc(step)}</td>
        <td><div class="spec pill" style="background:${v(bg)};color:${v(fg)}" data-token="${bg}">
          ${icon('check')}<span>Confirm</span>
        </div></td>
        <td data-token="${fg}">${ratioBadge(fg, bg)}</td>
      </tr>`
    }),
  ).join('')
  return `<table><thead><tr><th>Fill</th><th>on-solid text + icon</th><th>Contrast</th></tr></thead><tbody>${rows}</tbody></table>`
}

function banners(): string {
  const copy: Record<string, [string, string, IconName]> = {
    danger: ['Payment failed', 'The card issuer declined this charge. No money moved.', 'alert-circle'],
    warning: ['Approaching your limit', 'You have used 92% of the seats on this plan.', 'alert-circle'],
    success: ['Changes published', 'Your edits are live for everyone on the workspace.', 'check'],
    info: ['Scheduled maintenance', 'Reports will be read-only on Sunday from 02:00 UTC.', 'info'],
  }
  return Object.entries(copy)
    .map(([role, [title, body, glyph]]) => {
      const bg = `color-${role}-bg-subtle`
      const fg = `color-${role}-text`
      return `<div class="banner" data-token="${bg}"
        style="background:${v(bg)};color:${v(fg)};border-color:${v(`color-${role}-border`)}">
        <span data-token="${`color-${role}-border`}">${icon(glyph, 'lg')}</span>
        <div>
          <strong>${esc(title)}</strong>
          <p style="color:var(--ap-color-text-secondary)">${esc(body)}</p>
        </div>
        ${ratioBadge(fg, bg)}
      </div>`
    })
    .join('')
}

function buttons(): string {
  const kinds = ROLES.map((role) => {
    const solid = `background:${v(`color-${role}-bg`)};color:${v(`color-${role}-on-solid`)};border-color:transparent`
    const subtle = `background:${v(`color-${role}-bg-subtle`)};color:${v(`color-${role}-text`)};border-color:transparent`
    const outline = `background:transparent;color:${v(`color-${role}-text`)};border-color:${v('color-border-interactive')}`
    return `<div class="cell">
      <span class="tag mono">${esc(role)}</span>
      <span class="row center" style="gap:var(--ap-space-3)">
        <button class="btn" style="${solid}">${icon('check')} Solid</button>
        <button class="btn" style="${subtle}">${icon('check')} Subtle</button>
        <button class="btn" style="${outline}">${icon('check')} Outline</button>
      </span>
    </div>`
  }).join('')
  return `<div class="stack">${kinds}</div>`
}

function bordersAndFocus(): string {
  const cells = ['color-border-subtle', 'color-border-normal', 'color-border-interactive']
    .map(
      (t) => `<div class="cell" data-token="${t}" style="align-items:center">
        <span class="tag mono">${esc(t.replace('color-border-', ''))}</span>
        <div class="swatch" style="background:var(--ap-color-bg-surface);border:2px solid ${v(t)}"></div>
        ${ratioBadge(t, 'color-bg-canvas')}
      </div>`,
    )
    .join('')
  const focus = `<div class="cell" data-token="color-focus-ring" style="align-items:center">
      <span class="tag mono">focus-ring</span>
      <button class="btn" style="background:var(--ap-color-action-bg);color:var(--ap-color-action-on-solid);
        border-color:transparent;outline:3px solid ${v('color-focus-ring')};outline-offset:2px">Focused</button>
      ${ratioBadge('color-focus-ring', 'color-bg-canvas')}
    </div>`
  return `<div class="row center">${cells}${focus}</div>`
}

function gateTable(): string {
  const byMode = (mode: Mode) =>
    GATE_PAIRINGS.filter((p) => p.mode === mode)
      .map(
        (p) => `<tr class="only-${mode}">
          <td class="tag mono">${esc(p.fg.replace('color-', ''))}</td>
          <td class="tag mono">${esc(p.bg.replace('color-', ''))}</td>
          <td><span class="spec sm" style="background:${p.bgHex};color:${p.fgHex}">Handgloves ${icon('check')}</span></td>
          <td class="tag mono">${p.ratio.toFixed(2)}</td>
          <td class="tag mono dim">${p.required}</td>
          <td class="tag mono dim">${p.apca.toFixed(1)}</td>
          <td><span class="badge ${p.pass ? 'ok' : 'low'}">${p.pass ? 'PASS' : 'FAIL'}</span></td>
        </tr>`,
      )
      .join('')
  return `<table><thead><tr>
      <th>Foreground</th><th>Background</th><th>Specimen</th>
      <th>Ratio</th><th>Needs</th><th>APCA Lc</th><th></th>
    </tr></thead><tbody>${MODES.map(byMode).join('')}</tbody></table>`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const STYLE = `
  :root { color-scheme: light dark; }
  body {
    margin: 0; padding: var(--ap-space-7);
    background: var(--ap-color-bg-canvas); color: var(--ap-color-text-primary);
    font-family: var(--ap-font-body);
    font-size: var(--ap-text-md-size); line-height: var(--ap-text-md-lh);
  }
  h1 { font-size: var(--ap-text-2xl-size); line-height: var(--ap-text-2xl-lh); margin: 0 0 var(--ap-space-2); }
  .sub { color: var(--ap-color-text-secondary); margin: 0 0 var(--ap-space-7); max-width: 76ch; }
  section { margin-block-end: var(--ap-space-8); }
  h2 {
    font-size: var(--ap-text-sm-size); text-transform: uppercase; letter-spacing: .08em;
    color: var(--ap-color-text-secondary); margin: 0 0 var(--ap-space-4);
    padding-block-end: var(--ap-space-2); border-block-end: 1px solid var(--ap-color-border-subtle);
  }
  h3 { font-size: var(--ap-text-sm-size); margin: var(--ap-space-5) 0 var(--ap-space-3); font-weight: 600; }
  .note { font-size: var(--ap-text-sm-size); color: var(--ap-color-text-secondary); margin: 0 0 var(--ap-space-4); max-width: 76ch; }
  .row { display: flex; gap: var(--ap-space-5); flex-wrap: wrap; align-items: flex-start; }
  .row.center { align-items: center; }
  .stack { display: flex; flex-direction: column; gap: var(--ap-space-4); }
  .cell { display: flex; flex-direction: column; gap: var(--ap-space-2); }
  .swatch { width: 72px; height: 48px; border-radius: var(--ap-radius-md); border: 1px solid var(--ap-color-border-subtle); }
  .tag { font-size: var(--ap-text-xs-size); line-height: var(--ap-text-xs-lh); color: var(--ap-color-text-secondary); }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .dim { opacity: .65; }
  table { border-collapse: collapse; width: 100%; }
  td, th { text-align: start; padding: var(--ap-space-3); vertical-align: middle; }
  th { font-size: var(--ap-text-xs-size); text-transform: uppercase; letter-spacing: .08em;
       color: var(--ap-color-text-secondary); border-block-end: 1px solid var(--ap-color-border-normal); }
  tbody tr + tr td { border-block-start: 1px solid var(--ap-color-border-subtle); }
  .spec {
    display: inline-flex; align-items: center; gap: var(--ap-space-2);
    padding: var(--ap-space-2) var(--ap-space-3); border-radius: var(--ap-radius-md);
  }
  .spec.sm { font-size: var(--ap-text-sm-size); }
  .spec.pill { border-radius: var(--ap-radius-full); padding-inline: var(--ap-space-4); }
  .badge {
    display: inline-block; margin-block-start: var(--ap-space-2);
    font-size: var(--ap-text-xs-size); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    padding: 2px var(--ap-space-2); border-radius: var(--ap-radius-sm);
    background: var(--ap-color-bg-raised); color: var(--ap-color-text-secondary);
    border: 1px solid var(--ap-color-border-subtle);
  }
  .badge b { font-weight: 600; opacity: .75; }
  .badge.ok { color: var(--ap-color-success-text); }
  .badge.mid { color: var(--ap-color-warning-text); }
  .badge.low { color: var(--ap-color-danger-text); }
  .banner {
    display: flex; gap: var(--ap-space-3); align-items: flex-start;
    padding: var(--ap-space-4); border-radius: var(--ap-radius-lg);
    border: 1px solid; margin-block-end: var(--ap-space-3); max-width: 72ch;
  }
  .banner p { margin: var(--ap-space-1) 0 0; font-size: var(--ap-text-sm-size); line-height: var(--ap-text-sm-lh); }
  .btn {
    display: inline-flex; align-items: center; gap: var(--ap-space-2);
    border: 1px solid; border-radius: var(--ap-radius-md);
    padding: var(--ap-space-2) var(--ap-space-4);
    font-family: inherit; font-size: var(--ap-text-md-size); cursor: pointer;
  }
  /* Mode-dependent LABELS only. The colours themselves come from theme.css and
     switch on their own; these selectors mirror theme.css's exactly so a label
     can never describe the mode the page is not in. */
  .only-dark { display: none; }
  [data-ap-scheme="dark"] .only-light { display: none; }
  [data-ap-scheme="dark"] .only-dark { display: inline; }
  tr.only-dark { display: none; }
  [data-ap-scheme="dark"] tr.only-light { display: none; }
  [data-ap-scheme="dark"] tr.only-dark { display: table-row; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-ap-scheme="light"]) .only-light { display: none; }
    :root:not([data-ap-scheme="light"]) .only-dark { display: inline; }
    :root:not([data-ap-scheme="light"]) tr.only-light { display: none; }
    :root:not([data-ap-scheme="light"]) tr.only-dark { display: table-row; }
  }
`

const html = `<meta charset="utf-8">
<title>Colour tokens</title>
<link rel="stylesheet" href="../../packages/react/src/theme/fonts.css">
<link rel="stylesheet" href="../../packages/react/src/theme/theme.css">
<style>${STYLE}</style>

<h1>Colour tokens</h1>
<p class="sub">GENERATED by <code>scripts/gen-colour-demo.ts</code> — do not edit.
   Regenerate with <code>npm run gen:colour-demo</code>. Token names, hex labels and every
   contrast ratio come from the token source; the colour you see comes from the linked
   <code>theme.css</code>. Ratios marked <b>gated</b> are the pairings the WCAG gate asserts on
   in CI — the rest are measured here but not enforced. Switch your OS theme to see dark.</p>

<section id="palette">
  <h2>Every colour token</h2>
  <p class="note">Enumerated from <code>SEMANTIC_MAP</code>, so a token added to the theme appears
     here without anyone remembering to add it.</p>
  ${palette()}
</section>

<section>
  <h2>Text and icons on each surface</h2>
  <p class="note">The same specimen — icon plus label, both taking their colour from the
     foreground token via <code>currentColor</code> — drawn on each background it is allowed to
     appear on.</p>
  ${textOnSurfaces()}
</section>

<section>
  <h2>Icons alone, at each foreground colour</h2>
  ${iconsRow()}
</section>

<section>
  <h2>Solid fills — text and icon flip to on-solid</h2>
  <p class="note">Nothing tells the icon its colour. It inherits <code>on-solid</code> from the
     chip along with the label, which is why the hover step has to stay legible too.</p>
  ${solids()}
</section>

<section>
  <h2>In context — status banners</h2>
  ${banners()}
</section>

<section>
  <h2>In context — buttons per role</h2>
  ${buttons()}
</section>

<section>
  <h2>Borders and the focus ring</h2>
  ${bordersAndFocus()}
</section>

<section id="gate">
  <h2>The gated pairings — what CI actually asserts</h2>
  <p class="note">Straight from <code>contrastPairings()</code>, the same function
     <code>contrast.gate.test.ts</code> asserts on. If this table is green, that gate is green.</p>
  ${gateTable()}
</section>
`

mkdirSync('examples/colours', { recursive: true })
writeFileSync('examples/colours/index.html', html)

const failures = GATE_PAIRINGS.filter((p) => !p.pass)
console.log(
  `colours/index.html written — ${SEMANTIC_MAP.length} tokens, ` +
    `${GATE_PAIRINGS.length} gated pairings, ${failures.length} failing`,
)
if (failures.length) {
  throw new Error(
    `theme has failing pairings:\n${failures
      .map((p) => `  [${p.mode}] ${p.fg} on ${p.bg} = ${p.ratio.toFixed(2)} (needs ${p.required})`)
      .join('\n')}`,
  )
}

// ---------------------------------------------------------------------------
// Verification. Generating a page that *looks* right proves nothing: these
// three checks are why this script is worth running.
// ---------------------------------------------------------------------------
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const FIXTURE = resolve('fixtures/ssr-app')
if (!existsSync(resolve(FIXTURE, 'node_modules/playwright'))) {
  console.log('playwright not installed — skipping verification and screenshots.')
  console.log('run `npm run fixture:install` to enable them.')
  process.exit(0)
}
const require_ = createRequire(pathToFileURL(resolve(FIXTURE, 'package.json')))
const { chromium } = require_('playwright') as typeof import('playwright')

/** Every --ap-color-* the generated stylesheet actually declares. */
const declared = new Set(
  [...readFileSync('packages/react/src/theme/theme.css', 'utf8').matchAll(/--ap-(color-[a-z0-9-]+)\s*:/g)]
    .map((m) => m[1]!),
)

function hexToRgb(h: string): string {
  const n = parseInt(h.replace('#', ''), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

const PAGE = pathToFileURL(resolve('examples/colours/index.html')).href
const browser = await chromium.launch()
let problems = 0
try {
  for (const mode of MODES) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: mode,
    })
    await page.goto(PAGE, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)

    const probe = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ap-color-bg-canvas').trim(),
    )
    if (!probe) throw new Error('theme.css did not load')

    // 1. Completeness — every declared colour token is shown somewhere.
    const shown: string[] = await page.$$eval('[data-token]', (els) =>
      els.map((e) => e.getAttribute('data-token')!),
    )
    const missing = [...declared].filter((t) => !shown.includes(t))
    if (missing.length) {
      problems += missing.length
      console.log(`[${mode}] MISSING from the page: ${missing.join(', ')}`)
    }

    // 2. Painted == specified — the swatch's real colour against the token source.
    const painted: Array<{ token: string; rgb: string }> = await page.$$eval(
      '#palette [data-token]',
      (els) =>
        els.map((e) => ({
          token: e.getAttribute('data-token')!,
          rgb: getComputedStyle(e.querySelector('.swatch')!).backgroundColor,
        })),
    )
    const wrong = painted.filter((p) => p.rgb !== hexToRgb(hex(mode, p.token)))
    if (wrong.length) {
      problems += wrong.length
      for (const w of wrong) {
        console.log(`[${mode}] ${w.token}: painted ${w.rgb}, token says ${hexToRgb(hex(mode, w.token))}`)
      }
    }

    // 3. Page and gate agree on how many pairings there are.
    const visibleRows = await page.$$eval(`#gate tbody tr.only-${mode}`, (r) => r.length)
    const expected = GATE_PAIRINGS.filter((p) => p.mode === mode).length
    if (visibleRows !== expected) {
      problems += 1
      console.log(`[${mode}] gate table has ${visibleRows} rows, contrastPairings has ${expected}`)
    }

    await page.screenshot({ path: `examples/colours/colours-${mode}.png`, fullPage: true })
    console.log(
      `[${mode}] ${declared.size} declared / ${new Set(shown).size} shown · ` +
        `${painted.length} swatches verified against the token source · ${visibleRows} gate rows`,
    )
    await page.close()
  }
} finally {
  await browser.close()
}
if (problems) throw new Error(`${problems} verification problem(s) — see above`)
console.log('verification clean')
