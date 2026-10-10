// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { summarise } from '../storybook/visual/summary.js'
import type { Report } from '../storybook/visual/summary.js'

// Messages shaped like Playwright 1.62's JSON reporter output for each outcome.
const MISSING = "Error: A snapshot doesn't exist at /w/storybook/visual/__screenshots__/light/a.png, writing actual."
const DIFF = 'Error: expect(page).toHaveScreenshot(expected) failed\n\n  12 pixels (ratio 0.01 of all image pixels) are different.'
const PLAY = 'Error: the story threw before its screenshot\n\nexpect(received).toEqual(expected) // deep equality'
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

  // Fails if the hint is missing, or names the wrong workflow or branch.
  it('points at the baselines workflow when every failure is a missing baseline', () => {
    const s = summarise(report(test('a', { fail: MISSING }), test('b', { fail: MISSING }), test('c', 'pass')), 'feat/x')
    expect(s.text).toContain('run the "Visual baselines" workflow with branch=feat/x')
  })

  // Fails if the hint shows while a real diff is also present.
  it('does not blame missing baselines when there is also a diff', () => {
    const s = summarise(report(test('a', { fail: MISSING }), test('b', { fail: DIFF })), 'feat/x')
    expect(s.text).not.toContain('Visual baselines')
  })
})
