// CI check: fails when a fixture's or the showcase's package-lock.json lists
// different dependencies for a local package than that package's own
// package.json does.
// Run: npm run check:lockfiles   — fix with `npm --prefix <dir> install` and commit.
//
// It compares lockfile entries with package.json declarations, not lockfile
// bytes. A byte diff after `npm install` also flags npm-version noise: npm 11
// writes `libc` fields that npm 10 strips. `npm ci` does not catch this drift
// either. For a `file:` link it checks only the app's own dependencies, and it
// accepted a lockfile missing two of `@ap/react`'s.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIRS = ['fixtures/consumer', 'fixtures/ssr-app', 'showcase']
const FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

type Deps = Record<string, string>
type Entry = Partial<Record<(typeof FIELDS)[number], Deps>>

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))
const same = (a: Deps = {}, b: Deps = {}): boolean => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

const problems: string[] = []
for (const dir of DIRS) {
  const lock = readJson(join(dir, 'package-lock.json')) as { packages: Record<string, Entry> }
  // Local packages are the entries outside node_modules: '' is the app
  // itself, and a relative path is a `file:` link such as ../../packages/react.
  for (const [key, entry] of Object.entries(lock.packages)) {
    if (key.split('/').includes('node_modules')) continue
    const manifestPath = join(dir, key, 'package.json')
    if (!existsSync(manifestPath)) {
      problems.push(`${dir}: lockfile entry "${key}" has no package.json at ${manifestPath}`)
      continue
    }
    const manifest = readJson(manifestPath) as Entry
    for (const field of FIELDS) {
      if (!same(entry[field], manifest[field])) {
        problems.push(`${dir}: "${key || '.'}" ${field} differ between package-lock.json and ${manifestPath}`)
      }
    }
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(p)
  console.error(`\nRun \`npm --prefix <dir> install\` for each directory above and commit the lockfile.`)
  process.exit(1)
}
console.log(`lockfiles match their local packages: ${DIRS.join(', ')}`)
