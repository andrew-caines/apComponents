import { describe, expect, it } from 'vitest'
import * as icons from '@ap/icons'
import { bundle } from './measure.js'

describe('@ap/icons tree-shaking', () => {
  it('bundling one icon leaves every other icon out', async () => {
    const { js } = await bundle(
      `export { Icon } from '@ap/icons/react'; export { Check } from '@ap/icons'`,
    )
    expect(js).toContain('M20 6 9 17l-5-5')
    const others = Object.entries(icons).filter(
      ([name, v]) => name !== 'Check' && icons.isIconDefinition(v),
    ) as [string, icons.IconDefinition][]
    expect(others.length).toBeGreaterThan(0)
    for (const [name, def] of others) {
      expect(js, `${name} leaked into the bundle`).not.toContain(def.primary[0]!)
    }
    // defineIcon's validation is legitimately bundled once, so the message may appear once.
    expect(js.split('must be kebab-case').length - 1).toBeLessThanOrEqual(1)
  }, 60_000)
})
