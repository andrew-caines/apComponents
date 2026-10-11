import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkDocsRefs } from './docs-refs.js'

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'docs-refs-'))
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), body)
  }
  return join(root, 'docs')
}

const REGIONS = { 'src/a.ts': '// #region docs:real\nx\n// #endregion docs:real\n' }
const IMPORT = "import a from '../src/a.ts?raw'\n\n"

describe('checkDocsRefs', () => {
  it('passes the real docs tree', () => {
    // Perturbation: rename `docs:start` in fixtures/ssr-app/app/routes/start.tsx, and this fails.
    expect(checkDocsRefs('storybook/docs')).toEqual([])
  })
  it('reports a ?raw import of a missing file', () => {
    const dir = fixture({ 'docs/A.mdx': "import x from '../src/gone.ts?raw'\n" })
    expect(checkDocsRefs(dir)).toEqual([expect.stringContaining('gone.ts')])
  })
  it('reports a region name the file does not have', () => {
    const dir = fixture({
      ...REGIONS,
      'docs/A.mdx': `${IMPORT}{extractRegion(a, 'fake')}\n`,
    })
    expect(checkDocsRefs(dir)).toEqual([expect.stringContaining('docs:fake')])
  })
  it('accepts a region that exists', () => {
    const dir = fixture({ ...REGIONS, 'docs/A.mdx': `${IMPORT}{extractRegion(a, 'real')}\n` })
    expect(checkDocsRefs(dir)).toEqual([])
  })
  it('catches a call split across lines, inside a JSX attribute, with double or backtick quotes', () => {
    // Perturbation: make the call pattern single-line (`[ \t]` for `\s`) or quote-only, and these escape.
    const dir = fixture({
      ...REGIONS,
      'docs/A.mdx':
        IMPORT +
        '<Source code={extractRegion(\n  a,\n  "fake1",\n)} />\n' +
        '<Source code={extractRegion(a, `fake2`)} />\n' +
        '{`${extractRegion(a, \'fake3\')}`}\n',
    })
    const problems = checkDocsRefs(dir)
    expect(problems).toHaveLength(3)
    for (const n of ['fake1', 'fake2', 'fake3']) expect(problems.join('\n')).toContain(`docs:${n}`)
  })
  it('reports a call whose first argument is not a ?raw import', () => {
    // Perturbation: `continue` on an unknown identifier (the silent skip), and this passes.
    const dir = fixture({ 'docs/A.mdx': "{extractRegion(mystery, 'real')}\n" })
    expect(checkDocsRefs(dir)).toEqual([expect.stringContaining('mystery')])
  })
  it('reports a call whose arguments it cannot read statically', () => {
    const dir = fixture({ ...REGIONS, 'docs/A.mdx': `${IMPORT}{extractRegion(a, name)}\n` })
    expect(checkDocsRefs(dir)).toEqual([expect.stringContaining('cannot read')])
  })
  it('reports a duplicate, an unclosed and an empty region, as render would throw', () => {
    // Perturbation: go back to `regionNames(...).includes(name)`, and all three pass silently.
    const cases: Array<[string, string, RegExp]> = [
      ['dup', '// #region docs:dup\nx\n// #endregion docs:dup\n// #region docs:dup\ny\n// #endregion docs:dup\n', /appears 2 times/],
      ['open', '// #region docs:open\nx\n', /not closed/],
      ['blank', '// #region docs:blank\n// #endregion docs:blank\n', /is empty/],
    ]
    for (const [name, body, message] of cases) {
      const dir = fixture({ 'src/a.ts': body, 'docs/A.mdx': `${IMPORT}{extractRegion(a, '${name}')}\n` })
      expect(checkDocsRefs(dir)).toEqual([expect.stringMatching(message)])
    }
  })
  it('reports a missing ?raw file once, not again per call', () => {
    const dir = fixture({
      'docs/A.mdx': "import x from '../src/gone.ts?raw'\n{extractRegion(x, 'a')}{extractRegion(x, 'b')}\n",
    })
    expect(checkDocsRefs(dir)).toHaveLength(1)
  })
  it('reports a relative markdown link to a missing file', () => {
    const dir = fixture({ 'docs/A.mdx': 'See [x](./Nope.mdx).\n' })
    expect(checkDocsRefs(dir)).toEqual([expect.stringContaining('Nope.mdx')])
  })
  it('ignores Storybook-internal ?path= links', () => {
    const dir = fixture({ 'docs/A.mdx': 'See [x](?path=/docs/foo--docs) and [y](https://example.com).\n' })
    expect(checkDocsRefs(dir)).toEqual([])
  })
})
