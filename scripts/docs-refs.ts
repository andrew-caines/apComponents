// Docs reference check (Phase 6 spec §6). Every `?raw` import in a docs MDX
// file must resolve, every extractRegion(x, 'name') must name a region that
// file has, every relative link must resolve, and every Storybook docs link
// (`?path=/docs/<id>--docs`) must name an MDX page in the tree. A renamed
// fixture region would otherwise reach the published site as a broken page:
// MDX pages are not run as tests, so neither `storybook build` nor the
// storybook vitest project notices. This runs in the unit job and is the only build-time net.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { extractRegion } from '../storybook/docs/lib/extractRegion.js'

function mdxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? mdxFiles(p) : p.endsWith('.mdx') ? [p] : []
  })
}

// Every call, wherever it sits (JSX attribute, template string, several lines).
const CALL = /\bextractRegion\(([^)]*)\)/g
// The only argument shape the check can verify: identifier, then a literal name.
const ARGS = /^\s*(\w+)\s*,\s*(['"`])([\w-]+)\2\s*,?\s*$/

/**
 * The docs id Storybook gives an MDX page from its `<Meta title>`: each `/` part
 * lowercased, non-alphanumeric runs turned into one `-` (trimmed at the ends),
 * the parts joined with `-`, then `--docs`.
 */
export function docsIdOf(title: string): string {
  const parts = title.split('/').map((p) =>
    p
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  )
  return `${parts.join('-')}--docs`
}

const META_TITLE = /<Meta\s+title=["']([^"']+)["']/
// A `?path=/docs/...--docs` target in a Markdown link `](…)` or a JSX `href` string.
const DOCS_LINK = /(?:\]\(|\bhref=\{?\s*["'`])\?path=\/docs\/([\w-]+--docs)\b/g

export function checkDocsRefs(docsDir: string): string[] {
  const problems: string[] = []
  const files = mdxFiles(docsDir)
  const pageIds = new Set<string>()
  for (const file of files) {
    const title = META_TITLE.exec(readFileSync(file, 'utf8'))?.[1]
    if (title) pageIds.add(docsIdOf(title))
  }
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const raws = new Map<string, string>()
    const missing = new Set<string>()
    for (const m of src.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+)\?raw['"]/g)) {
      const target = resolve(dirname(file), m[2]!)
      if (!existsSync(target)) {
        problems.push(`${file}: ?raw import of missing file ${m[2]}`)
        missing.add(m[1]!)
      } else raws.set(m[1]!, target)
    }
    for (const m of src.matchAll(CALL)) {
      const args = ARGS.exec(m[1]!)
      if (!args) {
        problems.push(`${file}: cannot read extractRegion(${m[1]!.trim()}) statically`)
        continue
      }
      const target = raws.get(args[1]!)
      if (!target) {
        if (missing.has(args[1]!)) continue
        problems.push(`${file}: extractRegion(${args[1]}, ...) is not a ?raw import of this file`)
        continue
      }
      try {
        extractRegion(readFileSync(target, 'utf8'), args[3]!)
      } catch (e) {
        problems.push(`${file}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    for (const m of src.matchAll(/\]\((\.{1,2}\/[^)#\s]+)/g)) {
      if (!existsSync(resolve(dirname(file), m[1]!))) problems.push(`${file}: relative link to missing ${m[1]}`)
    }
    for (const m of src.matchAll(DOCS_LINK)) {
      if (!pageIds.has(m[1]!)) problems.push(`${file}: ?path=/docs/${m[1]} names no MDX page`)
    }
  }
  return problems
}
