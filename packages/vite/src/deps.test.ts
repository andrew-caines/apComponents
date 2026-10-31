import { readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AP_ALIASED_DEPS, AP_BUNDLED_DEPS } from './deps.js'

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
