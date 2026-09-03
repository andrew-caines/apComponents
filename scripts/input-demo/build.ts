// Compiles scripts/input-demo/examples.tsx into (a) a runnable ESM module and
// (b) the real CSS its components emit.
//
// The CSS has to come from a genuine vanilla-extract compile, not from reading
// the `.css.ts` sources: the class names on the rendered markup are generated
// at build time, so any hand-assembled stylesheet would be keyed to names that
// do not exist. Building it means the page's styling is the components' own
// output or the page does not build at all.
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'

const ROOT = resolve(import.meta.dirname, '../..')

export interface BuiltDemo {
  css: string
  moduleUrl: string
}

export async function buildDemo(): Promise<BuiltDemo> {
  // Inside `node_modules/` deliberately, not the OS temp directory: the built
  // module keeps its bare `react` / `react-dom` imports (an SSR build leaves
  // dependencies external), and Node resolves those by walking up from the
  // file's own location. From the OS temp directory that walk never reaches
  // this repo and the import fails; from here it finds the root
  // `node_modules/` one level up. Git-ignored for free.
  const outDir = join(ROOT, 'node_modules', '.ap-input-demo')
  mkdirSync(outDir, { recursive: true })

  await build({
    root: ROOT,
    logLevel: 'warn',
    plugins: [vanillaExtractPlugin()],
    build: {
      outDir,
      emptyOutDir: true,
      // One stylesheet rather than per-chunk fragments, so the page inlines a
      // single block and nothing can be silently dropped.
      cssCodeSplit: false,
      // An SSR build does not emit CSS assets by default — the client build
      // normally owns them. Without this the page would render correct markup
      // with no component styling at all, which is exactly the failure that
      // looks like "the design is broken" rather than "the build is wrong".
      ssrEmitAssets: true,
      ssr: resolve(ROOT, 'scripts/input-demo/examples.tsx'),
      rollupOptions: { output: { entryFileNames: 'examples.mjs' } },
    },
  })

  const files = readdirSync(outDir, { recursive: true, encoding: 'utf8' })
  const cssFile = files.find((f) => f.endsWith('.css'))
  if (!cssFile) {
    throw new Error(
      `the demo build emitted no CSS asset (files: ${files.join(', ') || 'none'}). ` +
        'Without it the page would render unstyled markup that still looks plausible.',
    )
  }
  const css = readFileSync(join(outDir, cssFile), 'utf8')
  if (!css.trim()) throw new Error(`the demo build emitted an empty stylesheet at ${cssFile}`)

  return { css, moduleUrl: pathToFileURL(join(outDir, 'examples.mjs')).href }
}
