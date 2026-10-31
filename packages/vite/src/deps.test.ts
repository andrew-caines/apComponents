import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AP_ALIASED_DEPS, AP_BUNDLED_DEPS, SHIM_ALIASES } from './deps.js'

const REACT_PKG = join(import.meta.dirname, '../../react')
const REACT_NAMES = new Set(['react', 'react-dom'])

interface Manifest {
  name: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const readManifest = (dir: string): Manifest =>
  JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest

/** The installed directory of `name`, resolved the way Node would from `fromDir`. */
function packageDir(name: string, fromDir: string): string | undefined {
  const req = createRequire(join(fromDir, 'package.json'))
  // `package.json` is not always exported, so walk up from the resolved entry.
  let entry: string
  try {
    entry = req.resolve(name)
  } catch {
    try {
      entry = req.resolve(`${name}/package.json`)
    } catch {
      return undefined
    }
  }
  let dir = dirname(entry)
  while (dir !== dirname(dir)) {
    try {
      if (readManifest(dir).name === name) return realpathSync(dir)
    } catch {
      /* no manifest here */
    }
    dir = dirname(dir)
  }
  return undefined
}

/**
 * Every package in `fromPkgDir`'s runtime tree (`dependencies`, recursively,
 * never peers) that imports React, judged by its manifest naming `react` or
 * `react-dom`. `@ap/*` are skipped: `AP_PACKAGES` already bundles them.
 */
function reactImporters(fromPkgDir: string): string[] {
  const found = new Set<string>()
  const seen = new Set<string>()
  const walk = (dir: string): void => {
    for (const dep of Object.keys(readManifest(dir).dependencies ?? {})) {
      if (REACT_NAMES.has(dep)) continue
      const depDir = packageDir(dep, dir)
      if (!depDir || seen.has(depDir)) continue
      seen.add(depDir)
      const m = readManifest(depDir)
      const names = [...Object.keys(m.dependencies ?? {}), ...Object.keys(m.peerDependencies ?? {})]
      if (!dep.startsWith('@ap/') && names.some((n) => REACT_NAMES.has(n))) found.add(dep)
      walk(depDir)
    }
  }
  walk(realpathSync(fromPkgDir))
  return [...found].sort()
}

describe('AP_BUNDLED_DEPS', () => {
  it("handles every React-importing package in @ap/react's tree", () => {
    const handled = new Set([...AP_BUNDLED_DEPS, ...AP_ALIASED_DEPS])
    expect(reactImporters(REACT_PKG).filter((n) => !handled.has(n))).toEqual([])
  })

  it('finds the known importers', () => {
    expect(reactImporters(REACT_PKG)).toEqual(
      expect.arrayContaining(['@base-ui/react', '@base-ui/utils', '@floating-ui/react-dom', 'use-sync-external-store']),
    )
  })

  it('never lists react or react-dom, which must stay external to resolve from the app', () => {
    expect([...AP_BUNDLED_DEPS, ...AP_ALIASED_DEPS].filter((n) => REACT_NAMES.has(n))).toEqual([])
  })
})

describe('SHIM_ALIASES', () => {
  const target = (specifier: string): string | undefined =>
    SHIM_ALIASES.find((a) => a.find.test(specifier))?.replacement

  it.each([
    ['use-sync-external-store/shim', 'use-sync-external-store-shim.ts'],
    ['use-sync-external-store/shim/index.js', 'use-sync-external-store-shim.ts'],
    ['use-sync-external-store/shim/with-selector', 'with-selector.ts'],
    ['use-sync-external-store/shim/with-selector.js', 'with-selector.ts'],
    ['use-sync-external-store/with-selector', 'with-selector.ts'],
  ])('sends %s to %s', (specifier, file) => {
    const replacement = target(specifier)
    expect(replacement && basename(dirname(replacement))).toBe('shims')
    expect(replacement && basename(replacement)).toBe(file)
  })

  it('points every alias at a file that exists', () => {
    for (const a of SHIM_ALIASES) expect(existsSync(a.replacement), a.replacement).toBe(true)
  })

  it('leaves unrelated specifiers alone', () => {
    expect(target('use-sync-external-store-x')).toBeUndefined()
    expect(target('react')).toBeUndefined()
  })
})
