// Which names a module exports as runtime values. Kept apart from measure.ts
// so its test needs only the compiler, not Vite.
import ts from 'typescript'

/**
 * Value exports of `file` in `program`. A name is excluded when its target
 * is type-only (an interface or type alias) or when any link of its re-export
 * chain is type-only: `getAliasedSymbol` resolves straight through
 * `export type { Button }` to the function, so the chain is walked one link
 * at a time instead.
 */
export function valueExports(program: ts.Program, file: string): Set<string> {
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(file)
  const moduleSymbol = source && checker.getSymbolAtLocation(source)
  if (!moduleSymbol) throw new Error(`could not load ${file}`)
  const isValue = (symbol: ts.Symbol): boolean => {
    let current: ts.Symbol | undefined = symbol
    const seen = new Set<ts.Symbol>()
    while (current && current.flags & ts.SymbolFlags.Alias && !seen.has(current)) {
      seen.add(current)
      if (current.declarations?.some((d) => ts.isTypeOnlyImportOrExportDeclaration(d))) return false
      current = checker.getImmediateAliasedSymbol(current)
    }
    return current !== undefined && (current.flags & ts.SymbolFlags.Value) !== 0
  }
  // A name that arrives through `export *` resolves straight to the target's symbol,
  // with no alias link to carry an `export type *`. So follow the module's own star
  // exports instead, skipping the type-only ones.
  const viaValueStar = (module: ts.Symbol, name: string, seen: Set<ts.Symbol>): boolean => {
    if (seen.has(module)) return false
    seen.add(module)
    const file = module.declarations?.find(ts.isSourceFile)
    for (const decl of file?.statements ?? []) {
      if (!ts.isExportDeclaration(decl) || decl.exportClause || decl.isTypeOnly || !decl.moduleSpecifier) continue
      const target = checker.getSymbolAtLocation(decl.moduleSpecifier)
      if (!target) continue
      const own = target.exports?.get(ts.escapeLeadingUnderscores(name))
      if (own ? isValue(own) : viaValueStar(target, name, seen)) return true
    }
    return false
  }
  const reachesAsValue = (symbol: ts.Symbol): boolean => {
    const own = moduleSymbol.exports?.get(ts.escapeLeadingUnderscores(symbol.name))
    return own ? isValue(own) : isValue(symbol) && viaValueStar(moduleSymbol, symbol.name, new Set())
  }
  return new Set(
    checker
      .getExportsOfModule(moduleSymbol)
      .filter(reachesAsValue)
      .map((s) => s.name),
  )
}
