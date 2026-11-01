import { describe, expect, it } from 'vitest'
import { bundle } from './measure.js'

describe('@ap/icons tree-shaking', () => {
  it('bundling one icon leaves every other icon out', async () => {
    const { js } = await bundle(
      `export { Icon } from '@ap/icons/react'; export { Check } from '@ap/icons'`,
    )
    expect(js).toContain('M20 6 9 17l-5-5')
    expect(js).not.toContain('M18 6 6 18M6 6l12 12')
    expect(js).not.toContain('M12 16v-5')
    expect(js.split('must be kebab-case').length - 1).toBeLessThanOrEqual(1)
  }, 60_000)
})
