import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { toSvg } from '../svg.js'
import { builtIns } from './builtIns.js'

const SVG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'svg')
const HINT = 'Run `npm run gen:icons` and commit the result.'

describe('generated SVG files', () => {
  it('match the built-in icon definitions exactly', async () => {
    const expected = new Map<string, string>()
    for (const def of await builtIns()) {
      expected.set(`${def.name}.svg`, toSvg(def, { duoTone: false }))
      expected.set(`${def.name}.duotone.svg`, toSvg(def, { duoTone: true }))
    }

    const actual = readdirSync(SVG_DIR).filter((f) => f.endsWith('.svg')).sort()
    expect(actual, `File set differs from the built-ins. ${HINT}`).toEqual(
      [...expected.keys()].sort(),
    )

    for (const [file, svg] of expected) {
      const onDisk = readFileSync(join(SVG_DIR, file), 'utf8').replace(/\r\n/g, '\n')
      expect(onDisk, `${file} is stale. ${HINT}`).toBe(svg)
    }
  })
})
