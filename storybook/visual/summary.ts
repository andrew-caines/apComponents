// Gate 9's CI summary: reads the JSON report stories.spec.ts wrote and appends the
// counts to $GITHUB_STEP_SUMMARY. Run with `npx tsx storybook/visual/summary.ts`
// from any cwd; the report path resolves from this file.
import { appendFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The slice of Playwright's JSONReport that this script reads.
export interface Report {
  suites: Suite[]
}
interface Suite {
  title: string
  specs: Spec[]
  suites?: Suite[]
}
interface Spec {
  title: string
  tests: Array<{
    projectName: string
    status: string
    annotations: Array<{ type: string; description?: string }>
    results: Array<{
      status?: string
      errors: Array<{ message: string }>
      // Playwright 1.62 copies the skip annotation here as well as onto the test.
      annotations?: Array<{ type: string; description?: string }>
    }>
  }>
}

export interface Summary {
  passed: number
  diffs: number
  missing: number
  playErrors: number
  // Failures that are none of the above, such as a story that never reaches
  // 'finished'. Counted so they cannot vanish from the summary.
  other: number
  skipped: Array<{ id: string; reason: string }>
  text: string
}

// An em dash, built from its code point so no raw non-ASCII sits in the source.
const DASH = String.fromCharCode(0x2014)

// Each message ends in a code frame of stories.spec.ts that quotes both the play-error
// assertion and the toHaveScreenshot call, so only its first line can be trusted. Order
// still matters: a missing baseline's first line also names toHaveScreenshot, and a play
// error's names its screenshot.
type Kind = 'missing' | 'playError' | 'diff' | 'other'
function classify(message: string): Kind {
  if (message.includes("A snapshot doesn't exist")) return 'missing'
  if (message.includes('the story threw before its screenshot')) return 'playError'
  if (/screenshot/i.test(message)) return 'diff'
  return 'other'
}

function* specsOf(suites: Suite[]): Generator<Spec> {
  for (const suite of suites) {
    yield* suite.specs
    if (suite.suites) yield* specsOf(suite.suites)
  }
}

export function summarise(report: Report, headRef = '<branch>'): Summary {
  let passed = 0
  const failures: Record<Kind, string[]> = { missing: [], playError: [], diff: [], other: [] }
  const skipped: Summary['skipped'] = []
  for (const spec of specsOf(report.suites)) {
    for (const t of spec.tests) {
      const id = `${t.projectName}/${spec.title}`
      if (t.status === 'skipped') {
        const skip = [...t.annotations, ...(t.results.at(-1)?.annotations ?? [])].find((a) => a.type === 'skip')
        skipped.push({ id, reason: skip?.description ?? '(no reason given)' })
      } else if (t.status === 'unexpected') {
        const errors = t.results.at(-1)?.errors ?? []
        const firstLines = errors.map((e) => e.message.split('\n')[0]).join('\n')
        failures[classify(firstLines)].push(id)
      } else {
        // 'expected', or 'flaky' (passed on a retry).
        passed++
      }
    }
  }

  const lines = [
    `## Gate 9 ${DASH} visual regression (advisory)`,
    '',
    '| passed | diffs | missing baselines | play errors | other failures | skipped |',
    '| --- | --- | --- | --- | --- | --- |',
    `| ${passed} | ${failures.diff.length} | ${failures.missing.length} | ${failures.playError.length} | ${failures.other.length} | ${skipped.length} |`,
    '',
  ]
  const list = (heading: string, ids: string[]) => {
    if (ids.length) lines.push(`**${heading}**`, '', ...ids.map((id) => `- ${id}`), '')
  }
  list('Diffs', failures.diff)
  list('Play errors', failures.playError)
  list('Other failures', failures.other)
  if (skipped.length) lines.push('**Skipped**', '', ...skipped.map((s) => `- ${s.id}: ${s.reason}`), '')
  const onlyMissing =
    failures.missing.length > 0 && !failures.diff.length && !failures.playError.length && !failures.other.length
  if (onlyMissing) {
    lines.push(`No baselines on this branch ${DASH} run the "Visual baselines" workflow with branch=${headRef}.`, '')
  } else {
    list('Missing baselines', failures.missing)
  }

  return {
    passed,
    diffs: failures.diff.length,
    missing: failures.missing.length,
    playErrors: failures.playError.length,
    other: failures.other.length,
    skipped,
    text: lines.join('\n'),
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = join(import.meta.dirname, '..', 'test-results', 'visual.json')
  let report: Report
  try {
    report = JSON.parse(readFileSync(path, 'utf8')) as Report
  } catch (error) {
    // The test step is continue-on-error, so it may have died before writing a report.
    console.error(`gate 9: no report at ${path}: ${String(error)}`)
    process.exit(1)
  }
  const { text } = summarise(report, process.env.GITHUB_HEAD_REF || '<branch>')
  console.log(text)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n')
}
