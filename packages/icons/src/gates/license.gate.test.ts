import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

describe('@ap/icons licence', () => {
  it('carries the Lucide licence notice verbatim', () => {
    const lucide = readFileSync(join(ROOT, 'node_modules/lucide-static/LICENSE'), 'utf8').trim()
    const ours = readFileSync(join(ROOT, 'packages/icons/LICENSE'), 'utf8')
    expect(ours).toContain(lucide)
  })
})
