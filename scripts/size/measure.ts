// Gate 10's measurement: builds one virtual entry through the consumer
// pipeline (Vite + `apComponents()`) and returns its brotli JS and CSS bytes.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, constants as zlib } from 'node:zlib'
import ts from 'typescript'
import { build } from 'vite'
import type { Plugin, Rollup } from 'vite'
import { apComponents } from '@ap/vite'
import type { Measured } from './budget.js'
import { valueExports } from './exports.js'

export const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const REACT = join(ROOT, 'packages/react')

/**
 * Component directory -> the value export that stands for it in
 * `@ap/react`. Only directories whose export differs from their name are
 * listed; `checkExports` fails for any other mismatch.
 */
export const COMPONENT_EXPORTS: Record<string, string> = { Banner: 'BannerRegion' }

const exportFor = (dir: string): string => COMPONENT_EXPORTS[dir] ?? dir

export function componentDirs(): string[] {
  return readdirSync(join(REACT, 'src/components'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

/** Check name -> the source of the virtual entry that measures it. */
export function checks(dirs: string[]): Record<string, string> {
  const out: Record<string, string> = {
    index: `export * from '@ap/react'`,
    hooks: `export * from '@ap/react/hooks'`,
    format: `export * from '@ap/react/format'`,
    'format/phone': `export * from '@ap/react/format/phone'`,
  }
  for (const dir of dirs) out[`import:${dir}`] = `export { ${exportFor(dir)} } from '@ap/react'`
  return out
}

/**
 * Throws, naming the directory, when a component directory's export is not a
 * value export of `packages/react/src/index.ts`. Reads the source as text
 * through the compiler API, so nothing from `@ap/react` is executed. Without
 * this, a renamed export would make its `import:` build fail with a bundler
 * error that does not say which mapping is wrong.
 */
export function checkExports(dirs: string[]): void {
  const configPath = join(REACT, 'tsconfig.json')
  const config = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    },
  })
  if (!config) throw new Error(`could not read ${configPath}`)
  const indexPath = join(REACT, 'src/index.ts')
  const program = ts.createProgram([indexPath], { ...config.options, noEmit: true })
  const values = valueExports(program, indexPath)
  const missing = dirs.filter((dir) => !values.has(exportFor(dir)))
  if (missing.length) {
    throw new Error(
      missing
        .map(
          (dir) =>
            `components/${dir}: '${exportFor(dir)}' is not a value export of packages/react/src/index.ts ` +
            `(missing, or exported type-only). If the directory's export has another name, map it in ` +
            `COMPONENT_EXPORTS (scripts/size/measure.ts).`,
        )
        .join('\n'),
    )
  }
}

const ENTRY = 'virtual:size-entry'
const RESOLVED = `\0${ENTRY}.js`

function sizeEntryPlugin(code: string): Plugin {
  return {
    name: 'ap-size:entry',
    enforce: 'pre',
    // Lib mode resolves `lib.entry` against `root`, so the id arrives as
    // `<root>\virtual:size-entry` on Windows. Match the suffix.
    resolveId: (id) => (id.replace(/\\/g, '/').endsWith(ENTRY) ? RESOLVED : null),
    load: (id) => (id === RESOLVED ? code : null),
  }
}

// Quality 11 is BROTLI_DEFAULT_QUALITY; spelt out so a Node default change
// cannot move every number at once.
const BROTLI = {
  params: {
    [zlib.BROTLI_PARAM_QUALITY]: 11,
    [zlib.BROTLI_PARAM_MODE]: zlib.BROTLI_MODE_GENERIC,
  },
}
const brotli = (src: string | Uint8Array): number => brotliCompressSync(Buffer.from(src), BROTLI).length

export async function measure(entry: string): Promise<Measured> {
  const result = await build({
    configFile: false,
    root: ROOT,
    logLevel: 'silent',
    plugins: [apComponents(), sizeEntryPlugin(entry)],
    build: {
      write: false,
      minify: true,
      cssCodeSplit: false,
      lib: { entry: ENTRY, formats: ['es'], fileName: 'entry' },
      rollupOptions: {
        external: [/^react($|\/)/, /^react-dom($|\/)/, /^libphonenumber-js($|\/)/],
        // Do not delete. Vite lib mode with the `es` format forces oxc minify
        // `{ codegen: false }`: whitespace and `//#region <absolute path>`
        // comments survive, so raw bytes vary with the working directory.
        // Vite spreads this `output` last, which restores full minification
        // and makes the bytes identical from any checkout. Without it the
        // numbers are wrong and machine-dependent.
        output: { minify: true, comments: false },
      },
    },
  })
  // Vite 8 returns RollupOutput[] even for a single format.
  const outputs = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[]
  let js = 0
  let css = 0
  for (const { output } of outputs) {
    for (const file of output) {
      const src = file.type === 'chunk' ? file.code : file.source
      if (file.fileName.endsWith('.js')) js += brotli(src)
      else if (file.fileName.endsWith('.css')) css += brotli(src)
    }
  }
  return { js, css }
}
