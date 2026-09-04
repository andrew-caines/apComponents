import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const APP = join(import.meta.dirname, '../../../../fixtures/consumer')
const DIST = join(APP, 'dist')
const isWin = process.platform === 'win32'
const npm = isWin ? 'npm.cmd' : 'npm'

let css = ''

// What this gate proves and what it does not: it proves a `file:`-protocol
// consumer builds against our source and ships real compiled component CSS
// and token custom properties. It does NOT prove ADR-0002's transitive `file:`
// resolution (that `@ap/react`'s own `"@ap/tokens": "file:../tokens"`
// dependency installs for an external consumer) — this fixture is nested
// inside the monorepo, so Node's module resolution walks up to the root
// `node_modules` regardless of what npm installed under the fixture itself.
// The gap is broader than just the `@ap/tokens` hop: this fixture's lockfile
// records `@ap/react`'s full requirement set (`@ap/tokens`,
// `@vanilla-extract/css`, `@vanilla-extract/recipes`, and
// `@vanilla-extract/vite-plugin` for the build itself) with no installed
// node for any of them — the entire dependency closure of `@ap/react` and
// `@ap/vite` is masked by the root `node_modules`.
// See docs/CONTRIBUTING.md, "Known gaps in Phase 2's gates".
let assetFiles: string[] = []
let assetsDir = ''

beforeAll(() => {
  // shell:true on Windows — Node will not spawn a .cmd without it.
  execFileSync(npm, ['run', 'build'], { cwd: APP, stdio: 'inherit', shell: isWin })
  assetsDir = join(DIST, 'assets')
  assetFiles = readdirSync(assetsDir)
  css = assetFiles
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(assetsDir, f), 'utf8'))
    .join('\n')
}, 180_000)

describe('gate 8: a file:-protocol consumer builds against our source', () => {
  it('typechecks against our source with a single copy of the React types', () => {
    // The consumer installs its own `@types/react`; the linked `@ap/react`
    // source (and Base UI's declarations) resolve the monorepo root's copy.
    // Same version, but TypeScript still loads both, and `Ref<T>`'s callback
    // return type is keyed on a `unique symbol`, so a Base UI `render` prop
    // spread onto a `<div>` fails with "Two different types with this name
    // exist". The fixture's tsconfig pins `react` to one copy (see the
    // comment there). CI runs this typecheck as its own step; running it here
    // too keeps the local gate honest about what CI checks.
    execFileSync(npm, ['run', 'typecheck'], { cwd: APP, stdio: 'inherit', shell: isWin })
  }, 120_000)

  it('produces a build', () => {
    expect(existsSync(join(DIST, 'index.html'))).toBe(true)
  })

  it('bundles the token custom properties', () => {
    expect(css).toContain('--ap-color-bg-canvas')
    expect(css).toContain('--ap-brand-9')
  })

  it('bundles the cascade layers (ADR-0016)', () => {
    expect(css).toContain('@layer ap.tokens')
  })

  it('actually populates the ap.components layer with Surface\'s own rules (ADR-0016)', () => {
    // Not just that the layer name appears somewhere (the order declaration
    // `@layer ap.tokens, ap.components;` would satisfy that trivially) — that
    // an opened `@layer ap.components { ... }` block genuinely wraps a
    // Surface-specific rule. A recipe that emits unlayered CSS passes every
    // other assertion in this file identically to a correctly layered one.
    expect(css).toMatch(/@layer ap\.components\s*\{[\s\S]*?--ap-surface-bg-canvas/)
  })

  it('actually ran the vanilla-extract transform over our .css.ts', () => {
    // The recipe's own declarations only exist if `.css.ts` was compiled,
    // rather than the package being externalised.
    expect(css).toMatch(/var\(--ap-surface-bg-surface,\s*var\(--ap-color-bg-surface\)\)/)
  })

  it("carries @ap/motion's keyframes through the @ap/react re-export (ADR-0010)", () => {
    // `@ap/react/motion.css` is one line: `@import '@ap/motion/motion.css'`.
    // If a bundler declined to resolve that bare specifier, or the export map
    // entry went missing, the build still succeeds and every other assertion
    // in this file still passes — the only symptom is a spinner that renders
    // and never moves. Assert the keyframes themselves landed.
    expect(css).toContain('@keyframes ap-spinner-rotate')
    expect(css).toContain('--ap-motion-spinner-rotate:')
  })

  it('keeps the component bound to the motion variable rather than the keyframes name', () => {
    // Spinner.css.ts derives its animation from `cssVarName('spinner.rotate')`.
    // Hardcoding `animation: ap-spinner-rotate ...` in the component would
    // satisfy the assertion above (motion.css still ships the keyframes) while
    // silently opting out of the token layer — and with it the reduced-motion
    // override, which lives on the variable, not on the keyframes.
    expect(css).toMatch(/animation:\s*var\(--ap-motion-spinner-rotate\)/)
  })

  it('ships the reduced-motion keyframes, not just a reduced-motion media query', () => {
    // This assertion replaces one that could not fail. The original was
    //   /@media[^{]*prefers-reduced-motion[^{]*\{[\s\S]*?--ap-motion-spinner-rotate:/
    // whose `[\s\S]*?` happily spans the whole stylesheet, so it matched
    // theme.css's unrelated `@media (prefers-reduced-motion: reduce){:root{
    // --ap-duration-*:1ms}}` followed, thousands of characters later, by the
    // `--ap-motion-spinner-rotate:` declaration in the ordinary `:root` block.
    // Deleting motion.css's reduced section entirely would have left it green.
    //
    // How the degradation actually works: motion.css REDEFINES each
    // `@keyframes` by name inside the reduced-motion media query, and the later
    // definition wins while the query matches. So the thing to assert is that
    // two definitions ship and that the second one has had the movement taken
    // out of it — which is the property a consumer's bundler could plausibly
    // break by deduplicating same-named keyframes.
    const parts = css.split('@keyframes ap-spinner-rotate')
    expect(
      parts.length - 1,
      'expected two @keyframes ap-spinner-rotate definitions (full motion, then the reduced override)',
    ).toBe(2)

    const [, fullMotion, reduced] = parts
    expect(fullMotion, 'the full-motion keyframes should rotate').toContain('rotate:')
    expect(reduced, 'the reduced keyframes should still fade, so the state stays perceivable').toContain(
      'opacity',
    )
    // The whole point: no rotation left in the reduced variant. `slice` bounds
    // the search to this keyframes block rather than the rest of the sheet.
    expect(
      reduced!.slice(0, reduced!.indexOf('}}') + 2),
      'the reduced keyframes still rotate — a bundler probably deduplicated them',
    ).not.toContain('rotate:')
  })

  it('inlines the vendored font faces and no remote font URL', () => {
    expect(css).toContain('Inter Fallback')
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })

  it('serves the real vendored woff2 files at plausible sizes, self-hosted (ADR-0015)', () => {
    // The negative assertion above (no Google Fonts host) passes identically
    // if the vendored files never made it into the build at all. Assert the
    // positive half: the woff2 assets actually exist in dist/assets with a
    // non-trivial size, not a 0-byte placeholder or a build that dropped them.
    const woff2Files = assetFiles.filter((f) => /^inter-.*\.woff2$/.test(f))
    expect(woff2Files.length).toBeGreaterThanOrEqual(2)
    for (const f of woff2Files) {
      expect(statSync(join(assetsDir, f)).size).toBeGreaterThan(10_000)
    }
  })

  it('rewrites both @font-face src urls to hashed, same-origin asset paths', () => {
    expect(css.match(/format\(['"]?woff2-variations['"]?\)/g)?.length).toBe(2)
    const hashedUrls = [...css.matchAll(/url\((\/assets\/inter-[^)]+\.woff2)\)/g)].map((m) => m[1]!)
    expect(hashedUrls.length).toBe(2)
  })
})
