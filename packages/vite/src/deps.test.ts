import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'
import { AP_ALIASED_DEPS, AP_BUNDLED_DEPS, SHIM_ALIASES } from './index.js'

const REACT_PKG = join(import.meta.dirname, '../../react')
const REACT_NAMES = new Set(['react', 'react-dom'])

interface Manifest {
  name: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const readManifest = (dir: string): Manifest =>
  JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest

/**
 * The installed directory of `name`, found as Node's lookup finds a package:
 * `node_modules/<name>` in `fromDir` and each ancestor. Its `exports` are never
 * consulted, so an import-only or `package.json`-hiding package is still found.
 * Throws when it is not installed: a skipped dependency would hide its subtree.
 */
function packageDir(name: string, fromDir: string): string {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate)
    if (dir === dirname(dir)) break
  }
  throw new Error(`${name} is a dependency of ${fromDir} but is not installed anywhere it could be resolved from`)
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
      if (seen.has(depDir)) continue
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

describe('reactImporters (the walk the completeness check relies on)', () => {
  /** A throwaway package tree: `app` depending on `deps`, each with its own manifest. */
  function tree(deps: Record<string, Partial<Manifest> & { exports?: unknown }>, declared = Object.keys(deps)): string {
    const root = mkdtempSync(join(tmpdir(), 'ap-walk-'))
    const app = join(root, 'app')
    mkdirSync(app)
    writeFileSync(
      join(app, 'package.json'),
      JSON.stringify({ name: 'app', dependencies: Object.fromEntries(declared.map((d) => [d, '1.0.0'])) }),
    )
    for (const [name, manifest] of Object.entries(deps)) {
      const dir = join(app, 'node_modules', name)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, ...manifest }))
      writeFileSync(join(dir, 'index.mjs'), 'export {}')
    }
    onTestFinished(() => rmSync(root, { recursive: true, force: true }))
    return app
  }

  // Fails while the walk resolves through `require`: an import-only `exports`
  // map with no exported package.json is invisible to it.
  it('finds an ESM-only dependency with no exported package.json', () => {
    const app = tree({ 'esm-only': { exports: { '.': { import: './index.mjs' } }, peerDependencies: { react: '*' } } })
    expect(reactImporters(app)).toEqual(['esm-only'])
  })

  // Fails while an unresolvable dependency is skipped with `continue`.
  it('fails, naming it, when a declared dependency is not installed', () => {
    const app = tree({}, ['ghost'])
    expect(() => reactImporters(app)).toThrow(/ghost/)
  })
})

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
