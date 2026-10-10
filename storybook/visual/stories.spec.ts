import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

interface IndexEntry { id: string; type: 'story' | 'docs' }
const index = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'storybook-static', 'index.json'), 'utf8'),
) as { entries: Record<string, IndexEntry> }
const stories = Object.values(index.entries).filter((e) => e.type === 'story')

// Stories gate 9 does not screenshot, each with the reason it cannot. The reason is
// required: an opt-out nobody can explain is a hole in the gate.
// These live here rather than as a `parameters.visual.skip` on the story because
// Storybook 10.6's index.json carries no story parameters (only id, title, name,
// importPath, tags and exportName), and reading them would mean loading each story
// in the browser before deciding whether to skip it.
const SKIP: Record<string, string> = {
  'components-select--native-label-warning': 'asserts a development-only console warning that a production build strips',
}

test('the static build has stories', () => {
  // Otherwise every generated test below vanishes and an empty build reports clean.
  expect(stories.length).toBeGreaterThan(0)
})

test('every SKIP entry names a real story and gives a reason', () => {
  // Reads only index.json, so it runs on every platform. Fails if a story is renamed or
  // deleted while its opt-out stays behind, or if an opt-out's reason is blank.
  const ids = new Set(stories.map((s) => s.id))
  expect(Object.keys(SKIP).filter((id) => !ids.has(id)), 'SKIP keys with no story').toEqual([])
  const blank = Object.entries(SKIP).filter(([, reason]) => typeof reason !== 'string' || !reason.trim())
  expect(blank, 'SKIP entries with no reason').toEqual([])
})

for (const story of stories) {
  test(story.id, async ({ page }) => {
    test.skip(process.platform !== 'linux', 'Baselines are Linux-only (spec §6.2)')
    test.skip(story.id in SKIP, SKIP[story.id])
    await page.addInitScript(() => {
      // Spec §6.3.2: a throwing play still ends at phase 'finished', so the phase
      // alone cannot reveal it. Trap the channel's assignment and record errors.
      const w = window as unknown as { __gate9Errors: string[]; __STORYBOOK_ADDONS_CHANNEL__: unknown }
      w.__gate9Errors = []
      let channel: { on(event: string, fn: (a: any) => void): void } | undefined
      Object.defineProperty(window, '__STORYBOOK_ADDONS_CHANNEL__', {
        configurable: true,
        enumerable: true,
        get: () => channel,
        set(value) {
          channel = value
          for (const event of ['playFunctionThrewException', 'storyErrored', 'storyThrewException']) {
            value.on(event, (a: any) => w.__gate9Errors.push(`${event}: ${String(a?.message ?? JSON.stringify(a))}`))
          }
          value.on('storyRenderPhaseChanged', (a: any) => {
            if (a?.newPhase === 'errored') w.__gate9Errors.push('phase errored')
          })
        },
      })
    })
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`)
    await page.waitForFunction(
      () => (window as any).__STORYBOOK_PREVIEW__?.currentRender?.phase === 'finished',
      undefined,
      { timeout: 15_000 },
    )
    const errors = await page.evaluate(() => (window as any).__gate9Errors as string[])
    expect(errors, 'the story threw before its screenshot').toEqual([])
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot(`${story.id}.png`, {
      animations: 'disabled',
      caret: 'hide',
      // Observed run-to-run noise is at most 5 px (spec §6.3.2).
      maxDiffPixels: 10,
    })
  })
}
