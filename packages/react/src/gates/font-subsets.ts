// Shared between scripts/gen-fonts.ts (the generator) and
// fonts.gate.test.ts (the freshness gate, this file's sibling), so declared
// unicode-range coverage in fonts.css can never diverge from a hand-copied
// literal: both sides read it from @fontsource-variable/inter's own wght.css.
//
// Lives in gates/, not theme/, on purpose: this is build-and-verification
// tooling that reads node:fs/node:module/node:path, not runtime source. The
// gates/ directory is already this package's exempted home for Node-touching
// tooling (see ssr-safety.gate.test.ts), so this module stays outside the
// SSR-safe surface that gate enforces for the rest of packages/react/src.
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

export interface FontSubsetSource {
  /** Absolute path to @fontsource-variable/inter's files/ directory. */
  filesDir: string
  /** Filenames present in filesDir. */
  available: string[]
  /** Raw contents of the package's own wght.css. */
  wghtCss: string
}

/** Resolves the installed @fontsource-variable/inter package's own source-of-truth files. */
export const loadFontSubsetSource = (): FontSubsetSource => {
  const pkgDir = dirname(require.resolve('@fontsource-variable/inter/package.json'))
  const filesDir = join(pkgDir, 'files')
  return {
    filesDir,
    available: readdirSync(filesDir),
    wghtCss: readFileSync(join(pkgDir, 'wght.css'), 'utf8'),
  }
}

/** Finds the one file in `available` matching `pattern`, or throws with the full listing. */
export const pickFile = (available: string[], pattern: RegExp, filesDir: string): string => {
  const hit = available.find((f) => pattern.test(f))
  if (!hit) {
    throw new Error(
      `No file matching ${pattern} in ${filesDir}.\nAvailable:\n  ${available.join('\n  ')}`,
    )
  }
  return hit
}

/**
 * Finds the `@font-face` block in `wghtCss` whose `src` names `fileName`, and
 * returns that block's `unicode-range` value verbatim (upstream's own
 * comma-separated form, no surrounding whitespace normalization applied here).
 * Keys off the filename — never a comment or block position — so the range
 * returned is always the one that actually describes the vendored file.
 */
export const unicodeRangeFor = (wghtCss: string, fileName: string): string => {
  const blocks = wghtCss.split('@font-face').slice(1)
  const block = blocks.find((b) => b.includes(fileName))
  if (!block) {
    throw new Error(
      `No @font-face block in wght.css references ${fileName}.\nSearched ${blocks.length} block(s).`,
    )
  }
  const match = /unicode-range:\s*([^;]+);/.exec(block)
  if (!match) {
    throw new Error(
      `Found the @font-face block for ${fileName} in wght.css but it has no unicode-range declaration:\n${block}`,
    )
  }
  return match[1]!.trim()
}

/** Whitespace-insensitive equality for two comma-separated unicode-range values. */
export const normalizeUnicodeRange = (range: string): string =>
  range
    .split(',')
    .map((part) => part.trim())
    .join(',')
