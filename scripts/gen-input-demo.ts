// Dev-only script: regenerates examples/InputFields.html.
// Run: npm run gen:input-demo   — commit the output. Never edited by hand.
//
// Why generated rather than hand-written, and why it is worth the machinery:
//
//   * The markup on the page is `renderToString` output from the real
//     components, and the stylesheet is a real vanilla-extract compile of the
//     real `.css.ts` files (see scripts/input-demo/build.ts). The page cannot
//     show a field that the library would not produce.
//   * Every code block is read back out of scripts/input-demo/examples.tsx's
//     TypeScript AST — the same expression that was just rendered. There is no
//     second copy of any snippet, so "the sample says one thing and the
//     component does another" is not a state this page can reach.
//   * The Tier 3 override table is read off INPUT_TOKENS and FIELD_TOKENS
//     themselves, not transcribed.
//
// Everything that could be transcribed by hand is instead derived, because a
// documentation page that can lie eventually does.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as ts from 'typescript'
import { renderToString } from 'react-dom/server'
import { buildDemo } from './input-demo/build.js'
import type { Example } from './input-demo/examples.js'

const ROOT = resolve(import.meta.dirname, '..')
const EXAMPLES_SRC = resolve(ROOT, 'scripts/input-demo/examples.tsx')
const OUT = resolve(ROOT, 'examples/InputFields.html')

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---------------------------------------------------------------------------
// 1. Pull each example's source text out of the AST
// ---------------------------------------------------------------------------

/**
 * Returns the source text of every `render: () => …` body in EXAMPLES, keyed
 * by the sibling `id`.
 *
 * Reading the source rather than accepting a `code:` string beside each
 * example is the whole point: a hand-written `code` field is a second copy
 * that drifts the first time someone edits one and not the other, and it
 * drifts silently, because nothing renders it.
 */
function extractSnippets(): Map<string, string> {
  const text = readFileSync(EXAMPLES_SRC, 'utf8')
  const sf = ts.createSourceFile(EXAMPLES_SRC, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const snippets = new Map<string, string>()

  const literalName = (p: ts.ObjectLiteralElementLike): string | undefined =>
    ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name))
      ? p.name.text
      : undefined

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'EXAMPLES' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const el of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(el)) continue
        let id: string | undefined
        let body: string | undefined
        for (const prop of el.properties) {
          const name = literalName(prop)
          if (!name || !ts.isPropertyAssignment(prop)) continue
          if (name === 'id' && ts.isStringLiteralLike(prop.initializer)) id = prop.initializer.text
          if (name === 'render' && ts.isArrowFunction(prop.initializer)) {
            body = prop.initializer.body.getText(sf)
          }
        }
        if (id && body) snippets.set(id, dedent(stripWrappingParens(body)))
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return snippets
}

/** `(\n  <X />\n)` → `\n  <X />\n`. A single-expression body is returned as-is. */
function stripWrappingParens(src: string): string {
  const t = src.trim()
  return t.startsWith('(') && t.endsWith(')') ? t.slice(1, -1) : t
}

/**
 * Removes the indentation the snippet inherits from its position inside the
 * EXAMPLES array, so the code block starts at column 0 the way a reader would
 * write it. The first line is excluded from the measurement because a
 * single-line body has no leading whitespace at all.
 */
function dedent(src: string): string {
  const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n')
  const indents = lines
    .filter((l) => l.trim() !== '')
    .map((l) => l.match(/^ */)?.[0].length ?? 0)
  const cut = indents.length ? Math.min(...indents) : 0
  return lines.map((l) => l.slice(cut)).join('\n')
}

// ---------------------------------------------------------------------------
// 2. A small JSX highlighter
// ---------------------------------------------------------------------------

/**
 * Runs over ALREADY-ESCAPED text, so `&lt;` is what a tag opener looks like
 * here. One alternation pass rather than several sequential replaces, so a
 * later rule can never rewrite markup an earlier rule just inserted.
 */
function highlight(escaped: string): string {
  return escaped.replace(
    /(&lt;\/?)([A-Za-z][\w.]*)|("[^"]*")|(\{[^{}]*\})|(\b[a-zA-Z-]+)(?==)/g,
    (m, open: string, tag: string, str: string, expr: string, attr: string) => {
      if (tag) return `${open}<b class="t">${tag}</b>`
      if (str) return `<b class="s">${str}</b>`
      if (expr) return `<b class="e">${expr}</b>`
      if (attr) return `<b class="a">${attr}</b>`
      return m
    },
  )
}

// ---------------------------------------------------------------------------
// 3. Compose the page
// ---------------------------------------------------------------------------

const { css, moduleUrl } = await buildDemo()
const mod = (await import(moduleUrl)) as { EXAMPLES: Example[] }
const { EXAMPLES } = mod
const snippets = extractSnippets()

// A snippet missing here means the AST walk stopped matching the file's shape
// — the page would silently fall back to showing nothing beside a live
// specimen, which is the exact "documentation that quietly says less than it
// claims" case this script exists to prevent.
for (const ex of EXAMPLES) {
  if (!snippets.has(ex.id)) {
    throw new Error(
      `no source extracted for example "${ex.id}". The AST walk in extractSnippets() no longer ` +
        'matches the shape of scripts/input-demo/examples.tsx.',
    )
  }
}

const tokenRows = (label: string, tokens: Record<string, string>): string =>
  Object.entries(tokens)
    .map(
      ([key, value], i) =>
        `<tr>${i === 0 ? `<th rowspan="${Object.keys(tokens).length}" class="grp">${esc(label)}</th>` : ''}` +
        `<td class="mono">${esc(key)}</td><td class="mono dim">${esc(value)}</td></tr>`,
    )
    .join('\n')

const { INPUT_TOKENS } = (await import(
  pathToFileURL(resolve(ROOT, 'packages/react/src/components/Input/Input.tokens.ts')).href
)) as { INPUT_TOKENS: Record<string, string> }
const { FIELD_TOKENS } = (await import(
  pathToFileURL(resolve(ROOT, 'packages/react/src/components/Field/Field.tokens.ts')).href
)) as { FIELD_TOKENS: Record<string, string> }
const { SPINNER_TOKENS } = (await import(
  pathToFileURL(resolve(ROOT, 'packages/react/src/components/Spinner/Spinner.tokens.ts')).href
)) as { SPINNER_TOKENS: Record<string, string> }

const sections = EXAMPLES.map((ex) => {
  // `identifierPrefix` is not cosmetic here. Each example is its own
  // `renderToString` call, and each call restarts React's `useId` counter — so
  // without a per-example prefix the specimens mint the same handful of
  // ids, the page ends up with duplicates, and `label[for]` resolves to
  // whichever element with that id comes first in the document rather than to
  // its own control. That is a broken label for a screen reader, and it looks
  // completely fine on screen. Verification check 3 caught exactly this.
  const markup = renderToString(ex.render(), { identifierPrefix: `${ex.id}-` })
  const code = highlight(esc(snippets.get(ex.id)!))
  return `
<section id="${esc(ex.id)}">
  <h2><a href="#${esc(ex.id)}">${esc(ex.title)}</a></h2>
  <p class="note">${ex.note.replace(/`([^`]+)`/g, (_, c: string) => `<code>${esc(c)}</code>`)}</p>
  <div class="pair">
    <div class="live">
      <div class="cap">live output</div>
      <div class="specimen" data-example="${esc(ex.id)}">${markup}</div>
    </div>
    <div class="src">
      <div class="cap">source</div>
      <pre class="code"><code>${code}</code></pre>
    </div>
  </div>
</section>`
}).join('\n')

const nav = EXAMPLES.map((ex) => `<a href="#${esc(ex.id)}">${esc(ex.title)}</a>`).join('')

const page = `<meta charset="utf-8">
<title>Input &amp; Field — apComponents</title>
<link rel="stylesheet" href="../packages/react/src/theme/fonts.css">
<link rel="stylesheet" href="../packages/react/src/theme/theme.css">
<!-- The motion tokens. Without this the spinner renders but never animates, and
     reduced-motion degradation has nothing to degrade. -->
<link rel="stylesheet" href="../packages/motion/src/motion.css">
<style>
/* The components' own stylesheet, compiled from the real .css.ts sources by
   scripts/input-demo/build.ts. Everything below the marker is this page's own
   chrome and styles nothing inside a .specimen. */
${css}
/* ---- page chrome ---- */
:root { color-scheme: light dark; }
body {
  margin: 0; padding: 0 0 6rem;
  background: var(--ap-color-bg-canvas);
  color: var(--ap-color-text-primary);
  font-family: var(--ap-font-body);
  font-size: var(--ap-text-md-size); line-height: var(--ap-text-md-lh);
}
.wrap { max-width: 62rem; margin: 0 auto; padding: 0 1.5rem; }
h1 { font-size: var(--ap-text-2xl-size); line-height: var(--ap-text-2xl-lh); margin: 2rem 0 .5rem; }
h2 { font-size: var(--ap-text-lg-size); line-height: var(--ap-text-lg-lh); margin: 0 0 .35rem; }
h2 a { color: inherit; text-decoration: none; }
h2 a:hover { text-decoration: underline; }
.sub, .note { color: var(--ap-color-text-secondary); margin: 0 0 1rem; }
.note { font-size: var(--ap-text-sm-size); line-height: var(--ap-text-sm-lh); max-width: 60ch; }
code { font-family: var(--ap-font-mono); font-size: .9em; }
.toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; gap: .75rem; align-items: center; flex-wrap: wrap;
  padding: .6rem 1.5rem;
  background: var(--ap-color-bg-surface);
  border-block-end: 1px solid var(--ap-color-border-subtle);
}
.seg { display: inline-flex; border: 1px solid var(--ap-color-border-interactive); border-radius: var(--ap-radius-md); overflow: hidden; }
.seg button {
  font: inherit; font-size: var(--ap-text-sm-size);
  padding: .25rem .7rem; border: 0; cursor: pointer;
  background: var(--ap-color-bg-surface); color: var(--ap-color-text-primary);
}
.seg button[aria-pressed="true"] { background: var(--ap-color-action-bg); color: var(--ap-color-action-on-solid); }
.tag { font-size: var(--ap-text-xs-size); color: var(--ap-color-text-secondary); }
nav.toc { display: flex; flex-wrap: wrap; gap: .35rem .75rem; margin: 0 0 2.5rem; }
nav.toc a { font-size: var(--ap-text-sm-size); color: var(--ap-color-action-text); }
section { margin: 0 0 3rem; scroll-margin-top: 4rem; }
.pair { display: grid; grid-template-columns: minmax(18rem, 1fr) minmax(20rem, 1.15fr); gap: 1rem; align-items: start; }
@media (max-width: 60rem) { .pair { grid-template-columns: 1fr; } }
.cap {
  font-size: var(--ap-text-fine-print-size); line-height: var(--ap-text-fine-print-lh);
  letter-spacing: .06em; text-transform: uppercase;
  color: var(--ap-color-text-secondary); margin: 0 0 .4rem;
}
.specimen {
  display: flex; flex-direction: column; gap: 1rem;
  padding: 1.25rem;
  background: var(--ap-color-bg-surface);
  border: 1px solid var(--ap-color-border-subtle);
  border-radius: var(--ap-radius-lg);
}
.specimen form { display: flex; flex-direction: column; gap: 1rem; margin: 0; align-items: stretch; }
/* A submit control should be its own width, not the form's. Fields stay full
   width because Input sets inline-size: 100% itself. */
.specimen form > button { align-self: flex-start; }
pre.code {
  margin: 0; padding: 1rem; overflow-x: auto;
  /* Wrap rather than clip: these samples sit in a column narrower than a
     comfortable line of JSX, and a reader should never have to scroll
     sideways to discover that a prop they needed was off the edge. */
  white-space: pre-wrap; overflow-wrap: break-word;
  background: var(--ap-color-bg-raised);
  border: 1px solid var(--ap-color-border-subtle);
  border-radius: var(--ap-radius-lg);
  font-family: var(--ap-font-mono);
  font-size: var(--ap-text-sm-size); line-height: var(--ap-text-sm-lh);
}
pre.code b { font-weight: 400; }
pre.code .t { color: var(--ap-color-action-text); }
pre.code .s { color: var(--ap-color-success-text); }
pre.code .a { color: var(--ap-color-info-text); }
pre.code .e { color: var(--ap-color-warning-text); }
table { border-collapse: collapse; width: 100%; font-size: var(--ap-text-sm-size); }
th, td { text-align: start; padding: .35rem .6rem; border-block-end: 1px solid var(--ap-color-border-subtle); vertical-align: top; }
th { color: var(--ap-color-text-secondary); font-weight: 600; }
th.grp { white-space: nowrap; border-inline-end: 1px solid var(--ap-color-border-subtle); }
.mono { font-family: var(--ap-font-mono); }
.dim { color: var(--ap-color-text-secondary); }
:root[data-ap-scheme="light"] { color-scheme: light; }
:root[data-ap-scheme="dark"] { color-scheme: dark; }
</style>

<div class="toolbar">
  <div class="seg" id="scheme" role="group" aria-label="Colour scheme">
    <button type="button" data-scheme="light" aria-pressed="false">Light</button>
    <button type="button" data-scheme="system" aria-pressed="true">System</button>
    <button type="button" data-scheme="dark" aria-pressed="false">Dark</button>
  </div>
  <span class="tag">Sets <code>data-ap-scheme</code> on the root, the same attribute
    <code>ThemeProvider</code> writes.</span>
</div>

<div class="wrap">
<h1>Input &amp; Field</h1>
<p class="sub">GENERATED by <code>scripts/gen-input-demo.ts</code> — do not edit.
  Regenerate with <code>npm run gen:input-demo</code>.
  Every specimen below is <code>renderToString</code> output from the real components, styled by a
  real vanilla-extract compile of their <code>.css.ts</code> sources; every code block is read back
  out of <code>scripts/input-demo/examples.tsx</code>'s AST — the same expression that produced the
  markup beside it. The inputs are genuine <code>&lt;input&gt;</code> elements: type in them, hover
  them, tab through them. Only behaviour that needs React — validation firing, an error appearing on
  blur — is inert here, and those states are shown as rendered specimens instead.</p>

<p class="sub">Everything is imported from one place:</p>
<pre class="code"><code>${highlight(esc(`import { Field, Input, Button } from '@ap/react'`))}</code></pre>

<nav class="toc">${nav}</nav>
${sections}

<section id="tokens">
  <h2><a href="#tokens">Tier 3 override tokens</a></h2>
  <p class="note">Set any of these custom properties to restyle just these components; each falls
    back to the Tier 2 semantic token shown beside it, so overriding Tier 2 instead moves the whole
    theme (ADR-0007). Read directly off <code>INPUT_TOKENS</code> and <code>FIELD_TOKENS</code>.</p>
  <table>
    <thead><tr><th>Component</th><th>Key</th><th>Resolves to</th></tr></thead>
    <tbody>
${tokenRows('Input', INPUT_TOKENS)}
${tokenRows('Field', FIELD_TOKENS)}
${tokenRows('Spinner', SPINNER_TOKENS)}
    </tbody>
  </table>
</section>
</div>

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

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, page, 'utf8')
console.log(`wrote ${OUT} (${EXAMPLES.length} examples, ${css.length} bytes of component CSS)`)

// ---------------------------------------------------------------------------
// 4. Verify the page in a real browser
// ---------------------------------------------------------------------------

const FIXTURE = resolve(ROOT, 'fixtures/ssr-app')
if (!existsSync(resolve(FIXTURE, 'node_modules/playwright'))) {
  console.log('playwright not installed under fixtures/ssr-app — skipping verification.')
  process.exit(0)
}
const require_ = createRequire(pathToFileURL(resolve(FIXTURE, 'package.json')))
const { chromium } = require_('playwright') as typeof import('playwright')

const failures: string[] = []
const fail = (check: string, detail: string) => failures.push(`[${check}] ${detail}`)

const url = pathToFileURL(OUT).href
const ids = EXAMPLES.map((e) => e.id)
const browser = await chromium.launch()

try {
  const page = await browser.newPage()
  await page.goto(url)

  // --- check 1: every example rendered, with both halves present -----------
  const shape = await page.evaluate(() => {
    return [...document.querySelectorAll('section[id] .specimen')].map((s) => {
      const section = s.closest('section')!
      const pre = section.querySelector('pre.code')
      return {
        id: s.getAttribute('data-example') ?? '',
        children: s.children.length,
        codeChars: (pre?.textContent ?? '').trim().length,
      }
    })
  })
  for (const id of ids) {
    const found = shape.find((s) => s.id === id)
    if (!found) fail('1 completeness', `example "${id}" has no specimen on the page`)
    else if (found.children === 0) fail('1 completeness', `example "${id}" rendered no elements`)
    else if (found.codeChars === 0) fail('1 completeness', `example "${id}" has an empty code block`)
  }
  if (shape.length !== ids.length) {
    fail('1 completeness', `${shape.length} specimens on the page, ${ids.length} examples in the module`)
  }

  // --- check 2: the components' own CSS actually reached the page ----------
  // Without the vanilla-extract compile every input would still RENDER — it
  // would just fall back to the user-agent's control styling, which looks
  // plausible enough in a screenshot to go unnoticed. These are properties the
  // UA does not set.
  const styling = await page.evaluate(() =>
    [...document.querySelectorAll('.specimen input')].map((el) => {
      const cs = getComputedStyle(el)
      return {
        id: el.closest('.specimen')!.getAttribute('data-example') ?? '',
        radius: cs.borderTopLeftRadius,
        borderStyle: cs.borderTopStyle,
        borderColor: cs.borderTopColor,
        paddingInline: cs.paddingLeft,
        classes: el.className,
      }
    }),
  )
  if (styling.length === 0) fail('2 component css', 'no inputs found in any specimen')
  for (const s of styling) {
    if (s.classes.trim() === '') fail('2 component css', `${s.id}: input carries no recipe class`)
    if (s.borderStyle !== 'solid') fail('2 component css', `${s.id}: border-style is ${s.borderStyle}, expected solid`)
    if (s.radius === '0px') fail('2 component css', `${s.id}: border-radius is 0px — the recipe did not apply`)
    if (s.paddingInline === '0px') fail('2 component css', `${s.id}: padding-inline is 0px — the size variant did not apply`)
    if (/rgba\(0, 0, 0, 0\)/.test(s.borderColor)) fail('2 component css', `${s.id}: border-color is transparent`)
  }

  // --- check 3: the ARIA wiring resolves in the page ------------------------
  const wiring = await page.evaluate(() =>
    [...document.querySelectorAll('.specimen label[for]')].map((l) => {
      const target = document.getElementById(l.getAttribute('for')!)
      return {
        id: l.closest('.specimen')!.getAttribute('data-example') ?? '',
        text: (l.textContent ?? '').trim(),
        resolvesTo: target ? target.tagName : null,
      }
    }),
  )
  if (wiring.length === 0) fail('3 aria wiring', 'no label[for] found in any specimen')
  for (const w of wiring) {
    if (w.resolvesTo === null) fail('3 aria wiring', `${w.id}: label "${w.text}" points at a missing id`)
    else if (w.resolvesTo !== 'INPUT') fail('3 aria wiring', `${w.id}: label "${w.text}" points at a ${w.resolvesTo}`)
  }

  // --- check 4: no error is carried by colour alone -------------------------
  // ADR-0011 §5 asserted against the rendered page rather than restated in
  // prose beside it.
  // Scoped to the error row's own shape — `Field.Error` renders an icon
  // followed by a message element, and nothing else on the page does. Matching
  // every `svg` inside a specimen instead would sweep in the adornment icons,
  // which are decorative by design and have no text beside them.
  //
  // The selector is self-guarding: if `Field.Error`'s structure ever changes,
  // this finds nothing and the zero-length check below fails rather than
  // quietly asserting over an empty set.
  const errors = await page.evaluate(() =>
    [...document.querySelectorAll('.specimen div:has(> svg + div)')].map((row) => {
      const svg = row.querySelector(':scope > svg')!
      return {
        id: row.closest('.specimen')!.getAttribute('data-example') ?? '',
        text: (row.textContent ?? '').trim(),
        hidden: svg.getAttribute('aria-hidden'),
      }
    }),
  )
  if (errors.length === 0) fail('4 never colour alone', 'no error row anywhere on the page')
  for (const e of errors) {
    if (e.text === '') fail('4 never colour alone', `${e.id}: an error icon with no text beside it`)
    if (e.hidden !== 'true') fail('4 never colour alone', `${e.id}: the icon is not aria-hidden`)
  }

  // --- check 7: an adorned field actually reserves room for its icon --------
  // The recipe puts the extra padding in `compoundVariants`, betting that
  // vanilla-extract emits those last so they beat the `size` rule. That is a
  // cascade assumption, and a cascade assumption that silently stops holding
  // produces text running underneath the icon — legible in a screenshot only
  // if you already suspect it. Measured here against a plain field of the same
  // size, and against the icon's own box.
  const adorned = await page.evaluate(() => {
    // No named function may be declared inside this callback. tsx compiles the
    // script with esbuild's `keepNames`, which wraps every named function in a
    // `__name()` helper — the helper stays in Node, the function body is
    // serialised into the browser, and the page throws `__name is not defined`.
    // Everything here is therefore inline.
    const plain = document.querySelector('.specimen[data-example="basic"] input')
    const rows = [...document.querySelectorAll('.specimen[data-example="adornments"] input')]
    return {
      plainStart: plain ? parseFloat(getComputedStyle(plain).paddingInlineStart) || 0 : null,
      plainEnd: plain ? parseFloat(getComputedStyle(plain).paddingInlineEnd) || 0 : null,
      fields: rows.map((input) => {
        const wrap = input.parentElement!
        const cs = getComputedStyle(input)
        const box = input.getBoundingClientRect()
        return {
          hasStart: wrap.firstElementChild !== input,
          hasEnd: wrap.lastElementChild !== input,
          padStart: parseFloat(cs.paddingInlineStart) || 0,
          padEnd: parseFloat(cs.paddingInlineEnd) || 0,
          // Every adornment must sit within the input's own box, or it is
          // floating outside the control it belongs to.
          contained: [...wrap.children]
            .filter((c) => c !== input)
            .every((c) => {
              const r = c.getBoundingClientRect()
              return r.left >= box.left - 1 && r.right <= box.right + 1
            }),
        }
      }),
    }
  })
  if (adorned.plainStart === null) fail('7 adornments', 'no plain input to compare against')
  if (adorned.fields.length === 0) fail('7 adornments', 'no adorned inputs found on the page')
  for (const f of adorned.fields) {
    if (f.hasStart && f.padStart <= (adorned.plainStart ?? 0)) {
      fail('7 adornments', `start-adorned field reserves ${f.padStart}px, no more than the plain ${adorned.plainStart}px`)
    }
    if (!f.hasStart && f.padStart !== adorned.plainStart) {
      fail('7 adornments', `unadorned start side padded ${f.padStart}px, expected ${adorned.plainStart}px`)
    }
    if (f.hasEnd && f.padEnd <= (adorned.plainEnd ?? 0)) {
      fail('7 adornments', `end-adorned field reserves ${f.padEnd}px, no more than the plain ${adorned.plainEnd}px`)
    }
    if (!f.hasEnd && f.padEnd !== adorned.plainEnd) {
      fail('7 adornments', `unadorned end side padded ${f.padEnd}px, expected ${adorned.plainEnd}px`)
    }
    if (!f.contained) fail('7 adornments', 'an adornment renders outside its input box')
  }

  // --- check 8: an actionable adornment is a usable button ------------------
  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll('.specimen button[aria-label]')].map((b) => {
      const box = b.getBoundingClientRect()
      // The painted chip is the button's inner span; the button itself is the
      // (full-height) hit area. A background on the hit area runs straight into
      // the input's border — which is exactly what this measures.
      const ink = b.firstElementChild?.getBoundingClientRect()
      const input = b.parentElement?.querySelector('input')?.getBoundingClientRect()
      return {
        name: b.getAttribute('aria-label') ?? '',
        type: b.getAttribute('type'),
        w: box.width,
        h: box.height,
        inkClearance:
          ink && input ? Math.min(ink.top - input.top, input.bottom - ink.bottom) : null,
      }
    }),
  )
  if (buttons.length === 0) fail('8 adornment buttons', 'no actionable adornment on the page')
  for (const b of buttons) {
    if (b.type !== 'button') fail('8 adornment buttons', `"${b.name}" has type=${b.type} — it would submit the form`)
    if (b.name.trim() === '') fail('8 adornment buttons', 'an adornment button has an empty accessible name')
    if (b.w < 24 || b.h < 24) fail('8 adornment buttons', `"${b.name}" is ${b.w}x${b.h}, under the 24px hit target`)
    if (b.inkClearance === null) {
      fail('8 adornment buttons', `"${b.name}" has no inner chip to measure`)
    } else if (b.inkClearance < 2) {
      // 2px is the smallest gap that still reads as a gap at 1x. Below it the
      // hover background visually merges with the input's border.
      fail(
        '8 adornment buttons',
        `"${b.name}" chip clears the input edge by only ${b.inkClearance.toFixed(1)}px — ` +
          'its hover background will touch the border',
      )
    }
  }

  // --- check 9: the spinner animates, and degrades where it should ---------
  // ADR-0010's central claim is that motion degrades at the TOKEN layer, with
  // no component code change. Nothing had ever executed that in a browser.
  //
  // `getComputedStyle` cannot settle it: the reduced variant redefines the same
  // `@keyframes` name inside a media query, so the animation-name is identical
  // either way. `getAnimations()` returns the RESOLVED keyframes, which is the
  // only place the difference is visible.
  const readSpinner = () =>
    page.evaluate(() => {
      const svg = document.querySelector('.specimen[data-example="loading"] svg')
      if (!svg) return null
      const anims = svg.getAnimations()
      const props = new Set<string>()
      for (const a of anims) {
        for (const frame of (a.effect as KeyframeEffect).getKeyframes()) {
          for (const key of Object.keys(frame)) props.add(key)
        }
      }
      return { count: anims.length, props: [...props] }
    })

  const full = await readSpinner()
  if (full === null) {
    fail('9 motion', 'no spinner found in the loading example')
  } else {
    if (full.count === 0) {
      fail(
        '9 motion',
        'the spinner has no running animation — motion.css is probably not linked, ' +
          'so var(--ap-motion-spinner-rotate) resolved to nothing',
      )
    }
    if (!full.props.includes('rotate')) {
      fail('9 motion', `at full motion the spinner does not animate rotate (got: ${full.props.join(', ')})`)
    }
  }

  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.goto(url)
    const reduced = await p.evaluate(() => {
      const svg = document.querySelector('.specimen[data-example="loading"] svg')
      if (!svg) return null
      const props = new Set<string>()
      for (const a of svg.getAnimations()) {
        for (const frame of (a.effect as KeyframeEffect).getKeyframes()) {
          for (const key of Object.keys(frame)) props.add(key)
        }
      }
      return { count: svg.getAnimations().length, props: [...props] }
    })
    if (reduced === null) {
      fail('9 motion', 'no spinner found under reduced motion')
    } else {
      // Rotation is the vestibular trigger and must be gone…
      if (reduced.props.includes('rotate')) {
        fail('9 motion', 'the spinner still animates rotate under prefers-reduced-motion')
      }
      // …but the state must remain perceivable, which is the half that a
      // "just remove the animation" degradation gets wrong.
      if (!reduced.props.includes('opacity')) {
        fail(
          '9 motion',
          `under reduced motion the spinner animates nothing perceivable (got: ${reduced.props.join(', ')})`,
        )
      }
    }
    await ctx.close()
  }

  // --- check 5: nothing collapsed ------------------------------------------
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('.specimen')].map((s) => {
      const r = s.getBoundingClientRect()
      return { id: s.getAttribute('data-example') ?? '', w: r.width, h: r.height }
    }),
  )
  for (const b of boxes) {
    if (b.w < 1 || b.h < 1) fail('5 layout', `${b.id}: specimen has zero size (${b.w}x${b.h})`)
  }

  await page.close()

  // --- check 6: the toggle moves colour, against both OS preferences --------
  for (const osScheme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({ colorScheme: osScheme })
    const p = await ctx.newPage()
    await p.goto(url)
    const read = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const asLight = await (async () => {
      await p.click('button[data-scheme="light"]')
      return read()
    })()
    const asDark = await (async () => {
      await p.click('button[data-scheme="dark"]')
      return read()
    })()
    if (asLight === asDark) {
      fail('6 toggle', `under OS ${osScheme}, light and dark both render body ${asLight}`)
    }
    await p.click('button[data-scheme="light"]')
    if ((await read()) !== asLight) {
      fail('6 toggle', `under OS ${osScheme}, returning to light did not restore ${asLight}`)
    }
    await ctx.close()
  }

  // --- screenshots ---------------------------------------------------------
  for (const scheme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1200, height: 900 } })
    const p = await ctx.newPage()
    await p.goto(url)
    await p.screenshot({ path: resolve(ROOT, `examples/InputFields-${scheme}.png`), fullPage: true })
    await ctx.close()
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n${failures.length} verification failure(s):\n${failures.map((f) => `  ${f}`).join('\n')}`)
  process.exit(1)
}
console.log(`verified: ${EXAMPLES.length} examples, 9 checks passed. Screenshots written.`)
