import { svgPathBbox } from 'svg-path-bbox'
import { describe, expect, it } from 'vitest'
import { builtIns } from './builtIns.js'

type Box = [number, number, number, number]

function union(paths: readonly string[]): Box {
  const boxes = paths.map((d) => svgPathBbox(d))
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ]
}

function within(box: Box, lo: number, hi: number): boolean {
  return box.every((v) => v >= lo && v <= hi)
}

const icons = await builtIns()
const cases = icons.map((def) => [def.name, def] as const)

describe('Icon Standard v0 gates', () => {
  it('has built-in icons to check', () => {
    expect(icons.length).toBeGreaterThan(0)
  })

  it.each(cases)('%s has a secondary layer (§6.2.4)', (name, def) => {
    expect(def.secondary, `${name} has no secondary`).toBeDefined()
  })

  it.each(cases)('%s leaves viewBox undefined', (name, def) => {
    expect(def.viewBox, `${name} sets viewBox`).toBeUndefined()
  })

  it.each(cases)('%s keeps every coordinate within [1, 23] (§6.1)', (name, def) => {
    const layers = [...def.primary, ...(Array.isArray(def.secondary) ? def.secondary : [])]
    const box = union(layers)
    expect(within(box, 1, 23), `${name} bbox ${JSON.stringify(box)} outside [1, 23]`).toBe(true)
  })

  it.each(cases)('%s keeps a halo primary within [2.5, 21.5] (§6.2.5)', (name, def) => {
    if (def.secondary !== 'halo') return
    const box = union(def.primary)
    expect(
      within(box, 2.5, 21.5),
      `${name} halo primary bbox ${JSON.stringify(box)} outside [2.5, 21.5]`,
    ).toBe(true)
  })

  it('has unique names', () => {
    const names = icons.map((d) => d.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
