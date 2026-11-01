import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CATALOGUE, PENDING_REDRAW } from '../catalogue.js'
import { builtIns } from './builtIns.js'

const ICONS_DIR = resolve(import.meta.dirname, '../../../../node_modules/lucide-static/icons')

function normalise(d: string): string {
  return d.replace(/\s+/g, ' ').trim()
}

function lucidePaths(lucide: string): Set<string> | null {
  let svg: string
  try {
    svg = readFileSync(resolve(ICONS_DIR, `${lucide}.svg`), 'utf8')
  } catch {
    return null
  }
  const paths = new Set<string>()
  for (const m of svg.matchAll(/<path\b[^>]*?\sd="([^"]*)"/g)) paths.add(normalise(m[1] ?? ''))
  return paths
}

const icons = await builtIns()
const sourced = icons.filter((def) => CATALOGUE[def.name]?.lucide != null)

describe('Lucide divergence gate (§6.5)', () => {
  it('has built-ins with a Lucide source to compare', () => {
    expect(sourced.length).toBeGreaterThan(0)
  })

  it.each(sourced.map((def) => [def.name, def] as const))(
    '%s diverges from Lucide or is pending redraw',
    (name, def) => {
      const lucide = CATALOGUE[name]?.lucide as string
      const paths = lucidePaths(lucide)
      expect(paths, `${name}: no lucide-static file for "${lucide}"`).not.toBeNull()
      const identical = def.primary.some((d) => paths?.has(normalise(d)))
      const pending = PENDING_REDRAW.includes(name)
      if (identical && !pending) {
        expect.fail(`${name} is still byte-identical to Lucide "${lucide}"; redraw it or list it in PENDING_REDRAW`)
      }
      if (!identical && pending) {
        expect.fail(`${name} is in PENDING_REDRAW but no longer matches Lucide; remove the stale entry`)
      }
    },
  )
})
