// @vitest-environment node
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { valueExports } from './exports.js'

// An in-memory program: `index.ts` re-exports from `button.ts` the ways
// packages/react/src/index.ts does, plus the type-only slips the size script
// must reject.
function exportsOf(index: string): Set<string> {
  const files: Record<string, string> = {
    '/m/button.ts': [
      'export function Button() { return null }',
      'export const BUTTON_TOKENS = {}',
      'export interface ButtonProps { a: string }',
      'export function Spinner() { return null }',
    ].join('\n'),
    // A module that passes everything on as types only.
    '/m/types.ts': `export type * from './button'`,
    '/m/index.ts': index,
  }
  const options: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    noEmit: true,
  }
  const host = ts.createCompilerHost(options)
  host.fileExists = (f) => f in files
  host.directoryExists = (d) => d === '/' || d === '/m'
  host.getCurrentDirectory = () => '/m'
  host.readFile = (f) => files[f]
  host.getSourceFile = (f, lang) => (f in files ? ts.createSourceFile(f, files[f] ?? '', lang) : undefined)
  const program = ts.createProgram(['/m/index.ts'], options, host)
  return valueExports(program, '/m/index.ts')
}

describe('valueExports', () => {
  it('includes values re-exported normally', () => {
    const names = exportsOf(`export { Button, BUTTON_TOKENS } from './button'`)
    expect([...names].sort()).toEqual(['BUTTON_TOKENS', 'Button'])
  })

  // Fails if interfaces or type aliases count as value exports.
  it('excludes a type that is exported normally', () => {
    expect(exportsOf(`export { ButtonProps } from './button'`).has('ButtonProps')).toBe(false)
  })

  // Fails if the check resolves straight through the alias with getAliasedSymbol
  // and so sees the underlying function.
  it('excludes a value re-exported with export type { … }', () => {
    expect(exportsOf(`export type { Button } from './button'`).has('Button')).toBe(false)
  })

  // Fails if only the declaration-level `export type` is checked, not the specifier.
  it('excludes a value re-exported with an inline type specifier', () => {
    const names = exportsOf(`export { type Button, Spinner } from './button'`)
    expect(names.has('Button')).toBe(false)
    expect(names.has('Spinner')).toBe(true)
  })

  // Fails if only the last link of the chain is inspected.
  it('excludes a value imported type-only and then re-exported', () => {
    const names = exportsOf(`import type { Button } from './button'\nexport { Button }`)
    expect(names.has('Button')).toBe(false)
  })

  // Fails if `export type *` is read as `export *`: its names are resolved straight to
  // the target's symbols, with no alias link that carries the type-only flag.
  it('excludes values re-exported with export type *', () => {
    expect([...exportsOf(`export type * from './button'`)]).toEqual([])
    expect([...exportsOf(`export * from './button'`)].sort()).toEqual(['BUTTON_TOKENS', 'Button', 'Spinner'])
  })

  // Fails if only the entry module's own star exports are inspected.
  it('excludes values that reach the entry through a nested export type *', () => {
    expect([...exportsOf(`export * from './types'`)]).toEqual([])
  })

  // Fails if `export type *` hides a name that a value export also provides.
  it('keeps a value exported both ways', () => {
    expect([...exportsOf(`export type * from './button'\nexport { Spinner } from './button'`)]).toEqual(['Spinner'])
  })
})
