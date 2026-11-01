import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

const files = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
  .map((f) => f.split(sep).join('/'))

const outside = (dir: string) => files.filter((f) => !f.startsWith(`${dir}/`))

const REACT_IMPORT = /from ['"]react(\/|['"])/
const LUCIDE_IMPORT =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]lucide[^'"]*['"]/

describe('@ap/icons isolation', () => {
  it('scans source files', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('imports React only under react/ and gates/', () => {
    const offenders = files
      .filter((f) => !f.startsWith('react/') && !f.startsWith('gates/'))
      .filter((f) => REACT_IMPORT.test(readFileSync(join(SRC, f), 'utf8')))
    expect(offenders, `React imported outside react/: ${offenders.join(', ')}`).toEqual([])
  })

  it('imports lucide only under gates/', () => {
    const offenders = outside('gates').filter((f) =>
      LUCIDE_IMPORT.test(readFileSync(join(SRC, f), 'utf8')),
    )
    expect(offenders, `lucide imported outside gates/: ${offenders.join(', ')}`).toEqual([])
  })

  it('detects the import forms it bans', () => {
    for (const s of [
      "import { X } from 'lucide-static'",
      "await import('lucide-react')",
      "require('lucide-static/icons/x.svg')",
    ]) {
      expect(LUCIDE_IMPORT.test(s), s).toBe(true)
    }
    expect(LUCIDE_IMPORT.test("lucide: 'circle-alert'")).toBe(false)
  })
})
