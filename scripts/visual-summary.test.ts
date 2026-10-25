// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseReport, summarise } from '../storybook/visual/summary.js'
import type { Report } from '../storybook/visual/summary.js'

// Messages shaped like Playwright 1.62's JSON reporter output, taken from a Linux run.
// Every one ends in a code frame of stories.spec.ts, and the frame quotes both the
// play-error assertion and the toHaveScreenshot call, so only each message's first
// line tells them apart.
const FRAME = [
  '',
  "  58 |     expect(errors, 'the story threw before its screenshot').toEqual([])",
  '  59 |     await page.evaluate(() => document.fonts.ready)',
  '> 60 |     await expect(page).toHaveScreenshot(`${story.id}.png`, {',
].join('\n')
const MISSING = `Error: A snapshot doesn't exist at /w/storybook/visual/__screenshots__/light/a.png, writing actual.\n${FRAME}`
// The real diff message is coloured, and the escapes stay in the JSON. Each phrase the
// classifier matches sits inside one coloured run, so no stripping is needed. ESC is
// built from its code so the source stays ASCII.
const ESC = String.fromCharCode(27)
const DIFF = `Error: ${ESC}[2mexpect(${ESC}[22m${ESC}[31mpage${ESC}[39m${ESC}[2m).${ESC}[22mtoHaveScreenshot${ESC}[2m(${ESC}[22m${ESC}[32mexpected${ESC}[39m${ESC}[2m)${ESC}[22m failed\n\n  3531 pixels (ratio 0.01 of all image pixels) are different.\n${FRAME}`
const PLAY = `Error: the story threw before its screenshot\n\nexpect(received).toEqual(expected) // deep equality\n${FRAME}`
const TIMEOUT = 'TimeoutError: page.waitForFunction: Timeout 15000ms exceeded.'

type Outcome = 'pass' | 'skip' | { fail: string }
const test = (title: string, outcome: Outcome, project = 'light') => ({
  title,
  tests: [
    {
      projectName: project,
      status: outcome === 'pass' ? 'expected' : outcome === 'skip' ? 'skipped' : 'unexpected',
      annotations: outcome === 'skip' ? [{ type: 'skip', description: `why ${title} is skipped` }] : [],
      results: [
        {
          status: outcome === 'pass' ? 'passed' : outcome === 'skip' ? 'skipped' : 'failed',
          errors: typeof outcome === 'object' ? [{ message: outcome.fail }] : [],
        },
      ],
    },
  ],
})
// Specs sit one suite below the file suite, as Playwright nests them.
const report = (...specs: ReturnType<typeof test>[]): Report => ({
  suites: [{ title: 'stories.spec.ts', specs: [], suites: [{ title: 'inner', specs }] }],
})

describe('summarise', () => {
  // Fails if any classifier matches the wrong message, or the skip reason is dropped.
  it('counts each outcome once and keeps the skip reason', () => {
    const s = summarise(
      report(
        test('a--pass', 'pass'),
        test('a--diff', { fail: DIFF }),
        test('a--missing', { fail: MISSING }),
        test('a--play', { fail: PLAY }),
        test('a--skip', 'skip', 'dark'),
      ),
    )
    expect([s.passed, s.diffs, s.missing, s.playErrors, s.skipped.length]).toEqual([1, 1, 1, 1, 1])
    expect(s.other).toBe(0)
    expect(s.skipped).toEqual([{ id: 'dark/a--skip', reason: 'why a--skip is skipped' }])
  })

  // Fails if a failure that is none of the three kinds disappears from the counts.
  it('counts an unclassified failure as other', () => {
    const s = summarise(report(test('a--slow', { fail: TIMEOUT })))
    expect([s.diffs, s.missing, s.playErrors, s.other]).toEqual([0, 0, 0, 1])
    expect(s.text).toContain('a--slow')
  })

  // Fails if the hint is missing, names the wrong branch, or drops the label path that
  // works before merge (workflow_dispatch only runs once the workflow is on main).
  it('points at the label, then the workflow, when every failure is a missing baseline', () => {
    const s = summarise(report(test('a', { fail: MISSING }), test('b', { fail: MISSING }), test('c', 'pass')), 'feat/x')
    expect(s.text).toContain('add the `update-visual-baselines` label to the PR')
    expect(s.text).toContain('gh workflow run visual-baselines.yml -f branch=feat/x')
    expect(s.text.indexOf('update-visual-baselines')).toBeLessThan(s.text.indexOf('gh workflow run'))
    expect(s.text).toContain('push an empty commit')
  })

  // Fails if the hint shows while a real diff is also present.
  it('does not blame missing baselines when there is also a diff', () => {
    const s = summarise(report(test('a', { fail: MISSING }), test('b', { fail: DIFF })), 'feat/x')
    expect(s.text).not.toContain('update-visual-baselines')
  })

  // Fails if summarise ignores the report's top-level errors: a webServer timeout or a
  // module-load ENOENT arrives with empty suites and would otherwise read as clean.
  it('counts global errors as other and lists their first lines', () => {
    const s = summarise({
      suites: [],
      errors: [{ message: 'Error: Timed out waiting 60000ms from config.webServer.\n    at frame' }],
      stats: { unexpected: 0 },
    })
    expect(s.other).toBe(1)
    expect(s.text).toContain('global error: Error: Timed out waiting 60000ms from config.webServer.')
    expect(s.text).not.toContain('at frame')
  })

  // Fails if stats.unexpected beyond what the suites name is dropped, or if a failure the
  // suites do name is counted twice.
  it('counts unexpected tests the suites do not name, once', () => {
    const named = { ...report(test('a', { fail: TIMEOUT }), test('b', { fail: DIFF })), stats: { unexpected: 2 } }
    expect(summarise(named).other).toBe(1)
    const unnamed = { ...report(test('a', { fail: DIFF })), stats: { unexpected: 4 } }
    const s = summarise(unnamed)
    expect([s.diffs, s.other]).toEqual([1, 3])
    expect(s.text).toContain("3 unexpected failure(s) the report's suites do not name")
  })

  // Fails if a global error leaves the missing-baselines hint in place of the real cause.
  it('does not blame missing baselines when there is also a global error', () => {
    const s = summarise({ ...report(test('a', { fail: MISSING })), errors: [{ message: 'Error: ENOENT' }] })
    expect(s.text).not.toContain('update-visual-baselines')
  })
})

describe('parseReport', () => {
  it('accepts a well-formed report', () => {
    const r = report(test('a', 'pass'))
    expect(summarise(parseReport(JSON.stringify(r))).passed).toBe(1)
  })

  // Fails if a malformed report reaches summarise, which then throws a TypeError
  // with no hint of which part of the report was wrong.
  it.each([
    ['not JSON', '{', /not JSON/],
    ['no suites', '{}', /suites must be an array/],
    ['a suite without specs', JSON.stringify({ suites: [{ title: 's' }] }), /suites\[0\]\.specs must be an array/],
    [
      'a nested spec without tests',
      JSON.stringify({ suites: [{ title: 's', specs: [], suites: [{ title: 'i', specs: [{ title: 'x' }] }] }] }),
      /suites\[0\]\.suites\[0\]\.specs\[0\]\.tests must be an array/,
    ],
    [
      'a test without results',
      JSON.stringify({ suites: [{ title: 's', specs: [{ title: 'x', tests: [{ annotations: [] }] }] }] }),
      /tests\[0\]\.results must be an array/,
    ],
  ])('names the problem in %s', (_, text, message) => {
    expect(() => parseReport(text)).toThrow(message)
  })
})
