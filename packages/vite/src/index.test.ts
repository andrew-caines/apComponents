import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AP_PACKAGES, apComponents } from './index.js'

const PKG_ROOT = join(import.meta.dirname, '..')
const PACKAGES = join(PKG_ROOT, '..')

const nameOf = (dir: string): string =>
  (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name: string }).name

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

/** Pull the config object the preset contributes via its `config` hook. */
function presetConfig(): Record<string, any> {
  const plugins = apComponents().flat()
  const cfgPlugin = plugins.find(
    (p: any) => p && typeof p === 'object' && p.name === 'ap-components:config',
  ) as any
  expect(cfgPlugin, 'preset must contribute a config plugin').toBeDefined()
  return cfgPlugin.config()
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
