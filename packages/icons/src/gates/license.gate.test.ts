import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

describe('@ap/icons licence', () => {
  it('carries the Lucide licence notice verbatim', () => {
    // Normalise CRLF so an autocrlf=true checkout compares equal.
    const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n')
    const lucide = read('node_modules/lucide-static/LICENSE').trim()
    const ours = read('packages/icons/LICENSE')
    expect(ours).toContain(lucide)
  })
})
