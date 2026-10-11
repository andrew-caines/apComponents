// Docs reference check (Phase 6 spec §6). Every `?raw` import in a docs MDX
// file must resolve, every extractRegion(x, 'name') must name a region that
// file has, and every relative link must resolve. A renamed fixture region
// would otherwise reach the published site as a broken page: MDX pages are not
// run as tests, so neither `storybook build` nor the storybook vitest project
// notices. This runs in the unit job and is the only build-time net.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { regionNames } from '../storybook/docs/lib/extractRegion.js'

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

export function checkDocsRefs(docsDir: string): string[] {
  const problems: string[] = []
  for (const file of mdxFiles(docsDir)) {
    const src = readFileSync(file, 'utf8')
    const raws = new Map<string, string>()
    for (const m of src.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+)\?raw['"]/g)) {
      const target = resolve(dirname(file), m[2]!)
      if (!existsSync(target)) problems.push(`${file}: ?raw import of missing file ${m[2]}`)
      else raws.set(m[1]!, target)
    }
    for (const m of src.matchAll(CALL)) {
      const args = ARGS.exec(m[1]!)
      if (!args) {
        problems.push(`${file}: cannot read extractRegion(${m[1]!.trim()}) statically`)
        continue
      }
      const target = raws.get(args[1]!)
      if (!target) {
        problems.push(`${file}: extractRegion(${args[1]}, ...) is not a ?raw import of this file`)
        continue
      }
      if (!regionNames(readFileSync(target, 'utf8')).includes(args[3]!)) {
        problems.push(`${file}: ${target} has no region docs:${args[3]}`)
      }
    }
    for (const m of src.matchAll(/\]\((\.{1,2}\/[^)#\s]+)/g)) {
      if (!existsSync(resolve(dirname(file), m[1]!))) problems.push(`${file}: relative link to missing ${m[1]}`)
    }
  }
  return problems
}
