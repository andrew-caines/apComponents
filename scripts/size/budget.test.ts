// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { evaluate, renderTable, seedBudgets } from './budget.js'
import type { Budgets, Measured } from './budget.js'

const index: Measured = { js: 1000, css: 100 }
const GENEROUS: Measured = { js: 10_000, css: 10_000 }

// Index is always budgeted generously, so only the row under test can fail.
const run = (measured: Record<string, Measured>, budgets: Budgets) =>
  evaluate({ index, ...measured }, { index: GENEROUS, ...budgets })
const row = (measured: Record<string, Measured>, budgets: Budgets, check: string) => {
  const found = run(measured, budgets).find((r) => r.check === check)
  if (!found) throw new Error(`no row for ${check}`)
  return found
}

describe('evaluate', () => {
  it('passes a check within its budget and both ratios, reporting the ratios', () => {
    const r = row({ 'import:A': { js: 300, css: 20 } }, { 'import:A': { js: 400, css: 30 } }, 'import:A')
    expect(r.problems).toEqual([])
    expect(r.jsRatio).toBe(0.3)
    expect(r.cssRatio).toBe(0.2)
    expect(r.budget).toEqual({ js: 400, css: 30 })
  })

  // Fails if the JS budget comparison is dropped or becomes >= instead of >.
  it('flags JS over budget', () => {
    const r = row({ 'import:A': { js: 401, css: 20 } }, { 'import:A': { js: 400, css: 30 } }, 'import:A')
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0]).toContain('js 401 > budget 400')
  })

  // Fails if the CSS budget is not compared, or compared with slack.
  it('flags CSS over budget by one byte', () => {
    const r = row({ 'import:A': { js: 300, css: 31 } }, { 'import:A': { js: 400, css: 30 } }, 'import:A')
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0]).toContain('css 31 > budget 30')
  })

  // Fails if a check without a budget entry is silently passed.
  it('flags a measured check that has no budget', () => {
    const r = row({ 'import:New': { js: 300, css: 20 } }, {}, 'import:New')
    expect(r.budget).toBeUndefined()
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0]).toContain('no budget for import:New')
  })

  // Fails if the JS ratio tripwire is removed or its limit raised.
  it('flags a JS ratio above 70% of index', () => {
    const r = row({ 'import:A': { js: 701, css: 20 } }, { 'import:A': GENEROUS }, 'import:A')
    expect(r.problems.some((p) => p.includes('js 70.1% of index > 70%'))).toBe(true)
  })

  // Fails if the JS ratio comparison becomes >= instead of >.
  it('allows a JS ratio of exactly 70%', () => {
    const r = row({ 'import:A': { js: 700, css: 20 } }, { 'import:A': GENEROUS }, 'import:A')
    expect(r.problems).toEqual([])
  })

  // Fails if the CSS ratio tripwire is removed or its limit raised.
  it('flags a CSS ratio above 50% of index', () => {
    const r = row({ 'import:A': { js: 300, css: 51 } }, { 'import:A': GENEROUS }, 'import:A')
    expect(r.problems.some((p) => p.includes('css 51.0% of index > 50%'))).toBe(true)
  })

  // Fails if ratios are applied to every check rather than only single imports.
  it('applies ratios only to import: checks', () => {
    const r = row({ hooks: { js: 900, css: 0 } }, { hooks: GENEROUS }, 'hooks')
    expect(r.jsRatio).toBeUndefined()
    expect(r.cssRatio).toBeUndefined()
    expect(r.problems).toEqual([])
  })

  // Fails if the CSS ratio divides by a zero index CSS size.
  it('does not compute a CSS ratio when index has no CSS', () => {
    const rows = evaluate(
      { index: { js: 1000, css: 0 }, 'import:A': { js: 300, css: 0 } },
      { index: GENEROUS, 'import:A': GENEROUS },
    )
    const r = rows.find((x) => x.check === 'import:A')
    expect(r?.problems).toEqual([])
    expect(r?.cssRatio).toBeUndefined()
    expect(r?.jsRatio).toBe(0.3)
  })
})

describe('seedBudgets', () => {
  // Fails if the headroom is not 10% or the rounding is not up to the next 100.
  it('adds 10% and rounds up to the next 100', () => {
    expect(seedBudgets({ a: { js: 4555, css: 459 } })).toEqual({ a: { js: 5100, css: 600 } })
  })
})

describe('renderTable', () => {
  // Fails if the header, cell formats or status wording change.
  it('renders a markdown table with an ok row and a failing row', () => {
    const rows = evaluate(
      { index, 'import:A': { js: 300, css: 20 }, 'import:B': { js: 401, css: 31 } },
      { index: GENEROUS, 'import:A': { js: 400, css: 30 }, 'import:B': { js: 400, css: 30 } },
    ).filter((r) => r.check !== 'index')
    const lines = renderTable(rows).trim().split('\n')
    expect(lines[0]).toBe('| check | js | css | budget js | budget css | js/index | css/index | status |')
    expect(lines[1]).toMatch(/^\|(\s*-+\s*\|){8}$/)
    expect(lines[2]).toBe('| import:A | 300 | 20 | 400 | 30 | 30.0% | 20.0% | ok |')
    expect(lines[3]).toBe(
      '| import:B | 401 | 31 | 400 | 30 | 40.1% | 31.0% | FAIL: js 401 > budget 400; css 31 > budget 30 |',
    )
    expect(lines).toHaveLength(4)
  })
})
