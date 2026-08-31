import { describe, expect, it } from 'vitest'
import { AP_PACKAGES, apComponents } from './index.js'

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
    expect(presetConfig()['ssr'].noExternal).toEqual([...AP_PACKAGES])
  })

  it('excludes ap packages from dep pre-bundling', () => {
    expect(presetConfig()['optimizeDeps'].exclude).toEqual([...AP_PACKAGES])
  })

  it('covers @ap/react and @ap/tokens', () => {
    expect(AP_PACKAGES).toContain('@ap/react')
    expect(AP_PACKAGES).toContain('@ap/tokens')
  })
})
