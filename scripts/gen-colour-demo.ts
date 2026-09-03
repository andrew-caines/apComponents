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
import { clampToSrgb } from '../packages/tokens/src/colour/gamut.js'
import {
  DEFAULT_BRAND,
  SEMANTIC_MAP,
  contrastPairings,
  generateTheme,
  oklchToHex,
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
    const onSolid = v(`color-${role}-on-solid`)
    // Backgrounds travel as --rest-bg / --hover-bg, never as an inline
    // `background`: an inline declaration beats every stylesheet rule, so a
    // :hover rule could never win against one. The verification pass caught
    // exactly that — live hover sat on the resting colour and never moved.
    const solid = `--rest-bg:${v(`color-${role}-bg`)};color:${onSolid};border-color:transparent`
    // The pinned specimen: the value :hover resolves to, held open so the shift
    // is visible side by side instead of only under a cursor.
    const solidHover = `--rest-bg:${v(`color-${role}-bg-hover`)};color:${onSolid};border-color:transparent`
    const subtle = `--rest-bg:${v(`color-${role}-bg-subtle`)};color:${v(`color-${role}-text`)};border-color:transparent`
    const outline = `--rest-bg:transparent;color:${v(`color-${role}-text`)};border-color:${v('color-border-interactive')}`
    return `<div class="cell">
      <span class="tag mono">${esc(role)}</span>
      <span class="row center" style="gap:var(--ap-space-3)">
        <button class="btn" style="${solid};--hover-bg:${v(`color-${role}-bg-hover`)}">${icon('check')} Solid</button>
        <button class="btn pinned" data-token="color-${role}-bg-hover" style="${solidHover}">${icon('check')} Solid · hover</button>
        <button class="btn" style="${subtle}">${icon('check')} Subtle</button>
        <button class="btn" style="${outline};--hover-bg:${v(`color-${role}-bg-subtle`)}">${icon('check')} Outline</button>
      </span>
    </div>`
  }).join('')
  return `<div class="stack">${kinds}</div>`
}

const LEGAL =
  'Rates shown exclude VAT. Cancel any time before the renewal date; refunds are ' +
  'pro-rated to the day. Terms apply.'

/** The size ladder around the floor, so the choice of 11px is visible. */
function finePrintSizes(): string {
  const rows = [
    ['12px', 'text-xs — the smallest step in the ramp'],
    ['11px', 'text-fine-print — the floor'],
    ['10px', '0.625rem — below the floor'],
    ['9px', 'not legible'],
  ]
    .map(
      ([px, note]) => `<tr>
        <td class="tag mono">${px}</td>
        <td style="font-size:${px};line-height:16px;max-width:64ch">${esc(LEGAL)}</td>
        <td class="tag dim">${esc(note)}</td>
      </tr>`,
    )
    .join('')
  return `<table><thead><tr><th>Size</th><th>Specimen</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
}

/** Foregrounds that are legal at this size, and the ones that are not. */
const FINE_PRINT_OK = FOREGROUNDS
const FINE_PRINT_NOT = ['color-border-normal', 'color-border-interactive', 'color-focus-ring']

function finePrintColours(): string {
  const cell = (fg: string, bad: boolean) => `<tr>
      <td class="tag mono">${esc(fg.replace('color-', ''))}</td>
      <td data-token="${fg}">
        <span style="font-size:var(--ap-text-fine-print-size);line-height:var(--ap-text-fine-print-lh);
                     color:${v(fg)};max-width:64ch;display:inline-block">${esc(LEGAL)}</span>
      </td>
      <td>${ratioBadge(fg, 'color-bg-canvas')}</td>
      <td class="tag ${bad ? 'mono' : 'dim'}">${bad ? '<b>not a text colour</b>' : 'ok at any size'}</td>
    </tr>`
  return `<table><thead><tr><th>Foreground</th><th>Fine print on canvas</th><th>Contrast</th><th></th></tr></thead><tbody>
      ${FINE_PRINT_OK.map((f) => cell(f, false)).join('')}
      ${FINE_PRINT_NOT.map((f) => cell(f, true)).join('')}
    </tbody></table>`
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
      <button class="btn" style="--rest-bg:var(--ap-color-action-bg);color:var(--ap-color-action-on-solid);
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
  /* Live hover, so the pinned specimen beside it can be checked against the
     real thing rather than taken on trust. --hover-bg is set per button; a
     button without one simply does not move. */
  .btn { background: var(--rest-bg, transparent); }
  .btn:hover { background: var(--hover-bg, var(--rest-bg, transparent)); }
  .btn.pinned { position: relative; }
  .btn.pinned::after {
    content: ''; position: absolute; inset: -3px; border-radius: inherit;
    border: 1px dashed var(--ap-color-border-interactive); pointer-events: none;
  }
  /* An explicit choice sets data-ap-scheme, exactly as ThemeProvider does, so
     color-scheme has to be pinned too or form controls and scrollbars keep
     following the OS. */
  :root[data-ap-scheme="light"] { color-scheme: light; }
  :root[data-ap-scheme="dark"] { color-scheme: dark; }
  .toolbar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; gap: var(--ap-space-4);
    margin: 0 calc(-1 * var(--ap-space-7)) var(--ap-space-7);
    padding: var(--ap-space-3) var(--ap-space-7);
    background: var(--ap-color-bg-surface);
    border-block-end: 1px solid var(--ap-color-border-subtle);
  }
  .seg { display: inline-flex; border: 1px solid var(--ap-color-border-normal); border-radius: var(--ap-radius-md); overflow: hidden; }
  .seg button {
    font: inherit; font-size: var(--ap-text-sm-size); cursor: pointer;
    padding: var(--ap-space-2) var(--ap-space-4); border: 0;
    background: transparent; color: var(--ap-color-text-secondary);
  }
  .seg button + button { border-inline-start: 1px solid var(--ap-color-border-subtle); }
  .seg button[aria-pressed="true"] {
    background: var(--ap-color-action-bg); color: var(--ap-color-action-on-solid);
  }
  .seg button:focus-visible { outline: 2px solid var(--ap-color-focus-ring); outline-offset: -2px; }

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

<div class="toolbar">
  <div class="seg" id="scheme" role="group" aria-label="Colour scheme">
    <button type="button" data-scheme="light" aria-pressed="false">Light</button>
    <button type="button" data-scheme="system" aria-pressed="true">System</button>
    <button type="button" data-scheme="dark" aria-pressed="false">Dark</button>
  </div>
  <span class="tag">Sets <code>data-ap-scheme</code> on the root, the same attribute
    <code>ThemeProvider</code> writes &mdash; so the hex and ratio labels follow it too.</span>
</div>

<h1>Colour tokens</h1>
<p class="sub">GENERATED by <code>scripts/gen-colour-demo.ts</code> — do not edit.
   Regenerate with <code>npm run gen:colour-demo</code>. Token names, hex labels and every
   contrast ratio come from the token source; the colour you see comes from the linked
   <code>theme.css</code>. Ratios marked <b>gated</b> are the pairings the WCAG gate asserts on
   in CI — the rest are measured here but not enforced. The toggle above overrides your OS
   preference; every hex and ratio label below follows it.</p>

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

<section id="buttons">
  <h2>In context — buttons per role</h2>
  <p class="note">The dashed button in each row is <code>-bg-hover</code> held open, so the
     hover shift is visible without a cursor on it. Hovering any Solid or Outline button
     applies the same value live — the pinned specimen is there to be checked against the
     real thing, not taken on trust. Note that only solid fills have a hover token:
     <code>Subtle</code> has none and does not move.</p>
  ${buttons()}
</section>

<section id="fine-print">
  <h2>Fine print — 11px, and the colours it may use</h2>
  <p class="note"><code>text-fine-print</code> is 11px/16px, below <code>xs</code> and outside the
     <code>xs</code>…<code>2xl</code> series, so it has no icon counterpart to keep in sync — an
     icon beside it uses <code>md</code> (1em) and tracks it automatically.</p>
  ${finePrintSizes()}
  <p class="note">WCAG gives small text no exemption: the 3:1 allowance begins at 24px, or
     18.66px bold. So fine print always needs a <b>4.5:1</b> foreground. The last three rows are
     the 3:1 tokens — gated for borders and focus rings, where 3:1 <i>is</i> the requirement.
     The system guarantees them nothing better, so they are never safe for text even when a
     particular theme clears 4.5 by luck. In this theme's dark mode they measure about 6.5–7:1
     and would read perfectly well; change the brand seed and they drop below 4.5. A guarantee
     you cannot rely on is not a guarantee.</p>
  ${finePrintColours()}
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

<script>
  (function () {
    var root = document.documentElement
    var bar = document.getElementById('scheme')
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-scheme]')
      if (!b) return
      if (b.dataset.scheme === 'system') root.removeAttribute('data-ap-scheme')
      else root.setAttribute('data-ap-scheme', b.dataset.scheme)
      bar.querySelectorAll('button').forEach(function (el) {
        el.setAttribute('aria-pressed', String(el === b))
      })
    })
  })()
</script>
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

// Fine print is small text, so WCAG's 3:1 large-text allowance never applies
// to it. Both halves of the page's guidance are asserted here, because a
// warning nobody has watched fire is decoration.
//
// The second half needed correcting once already: the page first claimed the
// 3:1 tokens "fall short by design", and this check pointed out that in dark
// mode they measure 6.5-7.0:1 and pass. The real reason they are unsafe is
// not what they happen to measure in one theme -- it is that the system only
// GUARANTEES them 3:1. So that is what gets asserted: somewhere in the seed
// space they do drop below 4.5, which is exactly why you cannot build on it.
{
  const bad: string[] = []
  for (const mode of MODES) {
    for (const fg of FINE_PRINT_OK) {
      const r = wcagRatio(hex(mode, fg), hex(mode, 'color-bg-canvas'))
      if (r < 4.5) bad.push(`[${mode}] ${fg} is shown as safe for fine print but is ${r.toFixed(2)}:1`)
    }
  }
  // Prove the 3:1 guarantee really is only 3:1, across the same grid gate 4 sweeps.
  const HUES = Array.from({ length: 15 }, (_, i) => i * 25)
  const SWEEP = HUES.flatMap((h) =>
    [0.35, 0.55, 0.75].flatMap((l) => [0.06, 0.15, 0.24].map((c) => oklchToHex(clampToSrgb({ l, c, h })))),
  )
  for (const fg of FINE_PRINT_NOT) {
    let worst = Infinity
    for (const brand of SWEEP) {
      const t = generateTheme({ brand })
      for (const mode of MODES) {
        worst = Math.min(worst, wcagRatio(resolveSemantic(t, mode, fg), resolveSemantic(t, mode, 'color-bg-canvas')))
      }
    }
    if (worst >= 4.5) {
      bad.push(`${fg} never drops below 4.5:1 across the sweep (worst ${worst.toFixed(2)}) — the page's claim that it is text-unsafe is unfounded`)
    }
  }
  if (bad.length) throw new Error(['fine-print colour guidance is wrong:', ...bad].join('\n'))
  console.log(
    `fine-print: ${FINE_PRINT_OK.length} foregrounds >= 4.5:1 in both modes; ` +
      `${FINE_PRINT_NOT.length} 3:1 tokens each fall below 4.5 somewhere in the seed space`,
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
// 5. The pinned hover specimen must equal what :hover actually paints. A
// swatch labelled "hover" that does not match the real hover is worse than no
// swatch: it is a wrong answer wearing a proof's clothing.
{
  const browser3 = await chromium.launch()
  try {
    const page = await browser3.newPage({ colorScheme: 'light' })
    await page.goto(PAGE, { waitUntil: 'networkidle' })
    const rows = await page.$$eval('#buttons .cell', (cells) =>
      cells.map((c) => ({
        role: c.querySelector('.tag')!.textContent!.trim(),
        pinned: getComputedStyle(c.querySelector('.btn.pinned')!).backgroundColor,
      })),
    )
    for (const [i, row] of rows.entries()) {
      const solid = page.locator('#buttons .cell').nth(i).locator('.btn').first()
      await solid.hover()
      const live = await solid.evaluate((el) => getComputedStyle(el).backgroundColor)
      const want = hexToRgb(hex('light', `color-${row.role}-bg-hover`))
      if (live !== row.pinned || live !== want) {
        problems += 1
        console.log(
          `[hover] ${row.role}: live ${live}, pinned ${row.pinned}, token says ${want}`,
        )
      }
    }
    console.log(`[hover] ${rows.length} roles: pinned specimen == live :hover == -bg-hover token`)
    await page.close()
  } finally {
    await browser3.close()
  }
}

// 4. The toggle. It has to move BOTH the painted colour and the per-mode
// labels, and it has to override the OS preference in either direction — a
// toggle that only works when it agrees with the OS is not a toggle. Run
// against a light OS and a dark OS so neither direction is a coincidence.
{
  const browser2 = await chromium.launch()
  try {
    for (const os of MODES) {
      const page = await browser2.newPage({ colorScheme: os })
      await page.goto(PAGE, { waitUntil: 'networkidle' })

      const read = () =>
        page.evaluate(() => {
          const cell = document.querySelector('#palette [data-token="color-bg-canvas"]')!
          const labels = [...cell.querySelectorAll('.dim span')]
          const visible = labels.find((l) => getComputedStyle(l).display !== 'none')
          return {
            painted: getComputedStyle(cell.querySelector('.swatch')!).backgroundColor,
            label: visible ? visible.textContent!.trim() : '(none visible)',
          }
        })

      for (const choice of ['light', 'dark'] as const) {
        await page.click(`#scheme button[data-scheme="${choice}"]`)
        const got = await read()
        const want = { painted: hexToRgb(hex(choice, 'color-bg-canvas')), label: hex(choice, 'color-bg-canvas') }
        const ok = got.painted === want.painted && got.label === want.label
        if (!ok) {
          problems += 1
          console.log(
            `[os=${os} → ${choice}] painted ${got.painted} / label ${got.label}, ` +
              `expected ${want.painted} / ${want.label}`,
          )
        }
      }

      // Back to System: the OS preference must win again.
      await page.click('#scheme button[data-scheme="system"]')
      const back = await read()
      if (back.label !== hex(os, 'color-bg-canvas')) {
        problems += 1
        console.log(`[os=${os} → system] label ${back.label}, expected ${hex(os, 'color-bg-canvas')}`)
      }
      console.log(`[os=${os}] toggle drives colour and labels in both directions, System restores ${back.label}`)
      await page.close()
    }
  } finally {
    await browser2.close()
  }
}

if (problems) throw new Error(`${problems} verification problem(s) — see above`)
console.log('verification clean')
