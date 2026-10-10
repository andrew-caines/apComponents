// Gate 10's pure logic: compares measured brotli sizes with the committed
// budgets and with the tree-shaking ratios, and renders the report. No I/O,
// so budget.test.ts covers every rule without building anything.

/** Brotli-compressed bytes. */
export interface Measured {
  js: number
  css: number
}
export type Budgets = Record<string, Measured>
export interface Row {
  check: string
  js: number
  css: number
  budget: Measured | undefined
  /** Share of `index`; undefined for anything but an `import:` check. */
  jsRatio: number | undefined
  cssRatio: number | undefined
  /** Empty means ok. */
  problems: string[]
}

// Tree-shaking tripwires (spec §6.3.1). A single named import that costs more
// than this share of the whole library means tree-shaking has broken: with
// `"sideEffects": true` every import lands at ~88% JS and 100% CSS. The largest
// honest import today is Select at ~49% JS; CSS peaks at ~24% (Toast).
export const JS_RATIO_LIMIT = 0.7
export const CSS_RATIO_LIMIT = 0.5

const pct = (r: number): string => (r * 100).toFixed(1) + '%'
const limit = (l: number): string => `${Math.round(l * 100)}%`

export function evaluate(measured: Record<string, Measured>, budgets: Budgets): Row[] {
  const index = measured['index']
  return Object.entries(measured).map(([check, { js, css }]) => {
    const budget = budgets[check]
    const problems: string[] = []
    if (!budget) {
      problems.push(`no budget for ${check}`)
    } else {
      if (js > budget.js) problems.push(`js ${js} > budget ${budget.js}`)
      if (css > budget.css) problems.push(`css ${css} > budget ${budget.css}`)
    }
    const isImport = check.startsWith('import:')
    const jsRatio = isImport && index && index.js > 0 ? js / index.js : undefined
    const cssRatio = isImport && index && index.css > 0 ? css / index.css : undefined
    if (jsRatio !== undefined && jsRatio > JS_RATIO_LIMIT) {
      problems.push(`js ${pct(jsRatio)} of index > ${limit(JS_RATIO_LIMIT)}`)
    }
    if (cssRatio !== undefined && cssRatio > CSS_RATIO_LIMIT) {
      problems.push(`css ${pct(cssRatio)} of index > ${limit(CSS_RATIO_LIMIT)}`)
    }
    return { check, js, css, budget, jsRatio, cssRatio, problems }
  })
}

export function renderTable(rows: Row[]): string {
  const cell = (v: number | undefined): string => (v === undefined ? '-' : String(v))
  const ratio = (r: number | undefined): string => (r === undefined ? '-' : pct(r))
  const lines = [
    '| check | js | css | budget js | budget css | js/index | css/index | status |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) =>
      [
        r.check,
        cell(r.js),
        cell(r.css),
        cell(r.budget?.js),
        cell(r.budget?.css),
        ratio(r.jsRatio),
        ratio(r.cssRatio),
        r.problems.length ? `FAIL: ${r.problems.join('; ')}` : 'ok',
      ].join(' | '),
    ).map((l) => `| ${l} |`),
  ]
  return lines.join('\n') + '\n'
}

// +10% headroom, rounded up to the next 100 bytes. Integer arithmetic, so an
// exact multiple (1000 -> 1100) is not pushed up a step by float error.
const seed = (bytes: number): number => Math.ceil((bytes * 11) / 1000) * 100

export function seedBudgets(measured: Record<string, Measured>): Budgets {
  return Object.fromEntries(
    Object.entries(measured).map(([check, { js, css }]) => [check, { js: seed(js), css: seed(css) }]),
  )
}
