import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkDocsRefs, docsIdOf } from './docs-refs.js'

// Resolved from this file, not the cwd, so the check runs from any directory.
const REAL_DOCS = fileURLToPath(new URL('../storybook/docs', import.meta.url))

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
    expect(checkDocsRefs(REAL_DOCS)).toEqual([])
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
    // Perturbation: check only that an opening marker for the name exists, and all three pass silently.
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
  it('accepts a ?path= docs link whose id is an MDX page, in Markdown or a JSX href', () => {
    const dir = fixture({
      'docs/A.mdx': '<Meta title="Guides/SSR rules" />\nSee [x](?path=/docs/guides-ssr-rules--docs).\n',
      'docs/B.mdx': '<Meta title="Foundations/Theme generator" />\n<a href="?path=/docs/guides-ssr-rules--docs">x</a>\n',
    })
    expect(checkDocsRefs(dir)).toEqual([])
  })
  it('reports a ?path= docs link whose id is no MDX page, in Markdown or a JSX href', () => {
    // Perturbation: delete the DOCS_LINK loop (the old "leave ?path= alone"), and both pass silently.
    const dir = fixture({
      'docs/A.mdx':
        '<Meta title="Guides/SSR rules" />\nSee [x](?path=/docs/guides-ssr-rule--docs).\n' +
        "<a href={'?path=/docs/guides-nope--docs'}>y</a> and [z](https://example.com).\n",
    })
    const problems = checkDocsRefs(dir)
    expect(problems).toHaveLength(2)
    expect(problems.join('\n')).toContain('guides-ssr-rule--docs')
    expect(problems.join('\n')).toContain('guides-nope--docs')
  })
  it('derives docs ids from Meta titles as Storybook does', () => {
    expect(docsIdOf('Guides/Getting started')).toBe('guides-getting-started--docs')
    expect(docsIdOf('Guides/SSR rules')).toBe('guides-ssr-rules--docs')
    expect(docsIdOf('Foundations/Theme generator')).toBe('foundations-theme-generator--docs')
    expect(docsIdOf('A/ Odd -- name! ')).toBe('a-odd-name--docs')
  })
})
