import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface SourceFilesOptions {
  /** File extensions to include, matched via `endsWith` (e.g. `['.ts', '.tsx']`). */
  extensions: string[]
  /**
   * Directory names to skip entirely, at any depth (e.g. `gates` — test
   * infrastructure, not shipped runtime code). Matched by exact directory
   * name, not path.
   */
  excludeDirs?: string[]
  /**
   * When `false` (the default), files whose name contains `.test.` or
   * `.stories.` are skipped. Pass `true` to include them — some gates (e.g.
   * an import-ban scan) want to catch a forbidden import inside a test file
   * just as much as inside shipped source.
   */
  includeTests?: boolean
}

/**
 * The one directory walker for every gate that needs to enumerate source
 * files under a root.
 *
 * Before this existed, four gates each hand-rolled their own recursive
 * `readdirSync` walk, and each had quietly drifted onto its own filter
 * policy and its own exclusion mechanism — a hardcoded pair of allowlisted
 * directories, a `Set` denylist, or no test-file filtering at all. That
 * inconsistency is *why* two gates could disagree with each other about what
 * counts as "the sources" without either one being wrong on purpose.
 *
 * Every gate must call this with an EXPLICIT, commented policy at its call
 * site — what extensions, what's excluded and why, whether tests are
 * in-scope — rather than re-implementing the walk.
 */
export function sourceFiles(root: string, opts: SourceFilesOptions): string[] {
  const { extensions, excludeDirs = [], includeTests = false } = opts
  const excluded = new Set(excludeDirs)

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) {
        return excluded.has(entry.name) ? [] : walk(p)
      }
      if (!extensions.some((ext) => entry.name.endsWith(ext))) return []
      if (!includeTests && (entry.name.includes('.test.') || entry.name.includes('.stories.'))) {
        return []
      }
      return [p]
    })

  return walk(root)
}
