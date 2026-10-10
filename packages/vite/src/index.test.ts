import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AP_CSS_TARGET, AP_PACKAGES, apComponents } from './index.js'

const PKG_ROOT = join(import.meta.dirname, '..')
const PACKAGES = join(PKG_ROOT, '..')

const nameOf = (dir: string): string => {
  const pkgJson = join(dir, 'package.json')
  let raw: string
  try {
    raw = readFileSync(pkgJson, 'utf8')
  } catch (cause) {
    // Every directory under `packages/` is expected to be an npm package, so
    // a missing `package.json` is a real finding, not routine I/O noise.
    // Without this, the bare `ENOENT` names the file it couldn't find but
    // not which directory-under-`packages/` assumption failed, leaving the
    // next person to work that out themselves.
    throw new Error(
      `expected ${dir} to be an npm package (found no package.json at ${pkgJson})`,
      { cause },
    )
  }
  return (JSON.parse(raw) as { name: string }).name
}

/**
 * Every workspace package a consumer's app imports, read off the filesystem
 * rather than off `AP_PACKAGES` — asserting `AP_PACKAGES` against itself
 * cannot detect a member that is missing, which is how `@ap/motion` came to
 * be absent from the preset for a whole phase. Add a package under
 * `packages/` and forget to wire it in, and these fail.
 *
 * This package is excluded: it is the preset, loaded by the consumer's Vite
 * config as build tooling. It is never imported by the app being bundled, so
 * it has nothing to externalise.
 */
function consumablePackages(): string[] {
  const self = nameOf(PKG_ROOT)
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => nameOf(join(PACKAGES, e.name)))
    .filter((n) => n !== self)
    .sort()
}

function findPlugin(name: string): any {
  const plugin = apComponents()
    .flat()
    .find((p: any) => p && typeof p === 'object' && p.name === name) as any
  expect(plugin, `preset must contribute ${name}`).toBeDefined()
  return plugin
}

/** Pull the config object the preset contributes via its `config` hook. */
function presetConfig(user: Record<string, any> = {}): Record<string, any> {
  return findPlugin('ap-components:config').config(user)
}

describe('apComponents()', () => {
  it('returns the vanilla-extract plugin plus our config plugin', () => {
    const names = apComponents()
      .flat()
      .filter((p: any) => p && typeof p === 'object' && 'name' in p)
      .map((p: any) => p.name as string)
    expect(names).toContain('ap-components:config')
    expect(names.some((n) => n.includes('vanilla-extract'))).toBe(true)
  })

  it('marks every ap package as ssr.noExternal so .css.ts is transformed', () => {
    expect([...presetConfig()['ssr'].noExternal].sort()).toEqual(consumablePackages())
  })

  it('excludes ap packages from dep pre-bundling', () => {
    expect([...presetConfig()['optimizeDeps'].exclude].sort()).toEqual(consumablePackages())
  })

  it('covers every workspace package the consumer imports', () => {
    // @ap/motion's `.` export is raw TypeScript. Externalised, an SSR build
    // hands it to Node, which cannot parse it.
    expect([...AP_PACKAGES].sort()).toEqual(consumablePackages())
  })
})

describe('CSS browser floor', () => {
  it('sets build.cssTarget to AP_CSS_TARGET when the consumer has not', () => {
    expect(presetConfig({})['build'].cssTarget).toEqual([...AP_CSS_TARGET])
  })

  // Fails if the cssTarget default is spread unconditionally, overwriting the
  // consumer's own value.
  it('leaves a consumer cssTarget alone', () => {
    expect(presetConfig({ build: { cssTarget: 'chrome100' } })['build']?.cssTarget).toBeUndefined()
  })

  // Fails if only build.cssTarget is checked: Vite derives cssTarget from an
  // explicit build.target, and the preset must not override that choice.
  it('leaves a consumer build.target alone', () => {
    expect(presetConfig({ build: { target: 'es2020' } })['build']?.cssTarget).toBeUndefined()
  })

  // Fails if enforce is dropped or set to 'pre': the check would then see CSS
  // before the minifier lowers `:dir()`, and never warn.
  it('runs the rtl-check after the minifier', () => {
    expect(findPlugin('ap-components:rtl-check').enforce).toBe('post')
  })

  // Fails if apply is dropped: the check would also run in dev, where nothing
  // is minified.
  it('runs the rtl-check on builds only', () => {
    expect(findPlugin('ap-components:rtl-check').apply).toBe('build')
  })

  const run = (bundle: Record<string, any>): string[] => {
    const warnings: string[] = []
    findPlugin('ap-components:rtl-check').generateBundle.call({ warn: (m: string) => warnings.push(m) }, {}, bundle)
    return warnings
  }

  // Fails if the matcher goes back to a bare ':lang(ae)' substring.
  it("does not warn for a consumer's own bare :lang(ae)", () => {
    expect(run({ 'a.css': { type: 'asset', fileName: 'a.css', source: '.a:lang(ae){font-family:x}' } })).toEqual([])
  })

  it('warns once when emitted CSS still has :dir() lowered', () => {
    const lowered = '.a:is(:lang(ae),:lang(ar)){left:0}'
    const warnings = run({
      'a.css': { type: 'asset', fileName: 'a.css', source: lowered },
      'b.css': { type: 'asset', fileName: 'b.css', source: lowered },
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain(':dir()')
    expect(warnings[0]).toContain('AP_CSS_TARGET')
    expect(run({ 'a.css': { type: 'asset', fileName: 'a.css', source: '.a:dir(rtl){left:0}' } })).toEqual([])
  })
})
