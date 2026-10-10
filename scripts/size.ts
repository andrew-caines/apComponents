// Gate 10: bundle budget. Builds every entry (the whole library, the hooks and
// format subpaths, and each component imported alone) through the consumer
// pipeline and compares its brotli JS and CSS with packages/react/size-budget.json
// and with the tree-shaking ratios in scripts/size/budget.ts.
// Run: npm run size            — exits 1 on any breach; report in reports/size.md
//      npm run size -- --seed  — rewrites the budget file from this run (+10%)
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { evaluate, renderTable, seedBudgets } from './size/budget.js'
import type { Budgets, Measured } from './size/budget.js'
import { ROOT, checkExports, checks, componentDirs, measure } from './size/measure.js'

const BUDGET_FILE = join(ROOT, 'packages/react/size-budget.json')
const REPORT_FILE = join(ROOT, 'reports/size.md')
const seed = process.argv.includes('--seed')

const dirs = componentDirs()
try {
  checkExports(dirs)
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}

const measured: Record<string, Measured> = {}
for (const [check, entry] of Object.entries(checks(dirs))) {
  measured[check] = await measure(entry)
  console.log(`measured ${check}: js ${measured[check].js}, css ${measured[check].css}`)
}

if (seed) {
  const budgets = seedBudgets(measured)
  const sorted = Object.fromEntries(Object.keys(budgets).sort().map((k) => [k, budgets[k]]))
  writeFileSync(BUDGET_FILE, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`seeded ${Object.keys(sorted).length} budgets into ${BUDGET_FILE}`)
  process.exit(0)
}

const budgets = JSON.parse(readFileSync(BUDGET_FILE, 'utf8')) as Budgets
const rows = evaluate(measured, budgets)
const table = `## Bundle budget (gate 10)\n\nBrotli bytes, quality 11.\n\n${renderTable(rows)}`
mkdirSync(join(ROOT, 'reports'), { recursive: true })
writeFileSync(REPORT_FILE, table)
// Append: other steps in the same job may already have written a summary.
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table + '\n')
console.log('\n' + table)

const failed = rows.filter((r) => r.problems.length)
if (failed.length) {
  console.error(`gate 10: ${failed.length} check(s) over budget or ratio; see the table above.`)
  process.exit(1)
}
