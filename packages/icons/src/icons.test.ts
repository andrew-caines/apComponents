import { describe, expect, it } from 'vitest'
import { CATALOGUE, PENDING_REDRAW } from './catalogue.js'
import { builtInEntries, builtIns, pascalCase } from './gates/builtIns.js'

describe('built-in icons', () => {
  it('exports exactly the seven component icons', async () => {
    const names = (await builtIns()).map((d) => d.name).sort()
    expect(names).toEqual([
      'alert-circle',
      'alert-triangle',
      'check',
      'check-circle',
      'chevron-down',
      'info',
      'x',
    ])
  })
  it('names every export PascalCase(def.name)', async () => {
    for (const [key, def] of await builtInEntries()) {
      expect(key).toBe(pascalCase(def.name))
    }
  })
  it('keys CATALOGUE by exactly the built-in names', async () => {
    const names = (await builtIns()).map((d) => d.name).sort()
    expect(Object.keys(CATALOGUE).sort()).toEqual(names)
  })
  it('lists exactly the icons ported unchanged from Lucide', () => {
    expect(PENDING_REDRAW).toEqual(['check', 'chevron-down'])
  })
})
