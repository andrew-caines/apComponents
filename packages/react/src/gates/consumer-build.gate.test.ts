import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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
// See docs/CONTRIBUTING.md, "Known gaps in Phase 2's gates".
beforeAll(() => {
  // shell:true on Windows — Node will not spawn a .cmd without it.
  execFileSync(npm, ['run', 'build'], { cwd: APP, stdio: 'inherit', shell: isWin })
  const assets = join(DIST, 'assets')
  css = readdirSync(assets)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(assets, f), 'utf8'))
    .join('\n')
}, 180_000)

describe('gate 8: a file:-protocol consumer builds against our source', () => {
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

  it('actually ran the vanilla-extract transform over our .css.ts', () => {
    // The recipe's own declarations only exist if `.css.ts` was compiled,
    // rather than the package being externalised.
    expect(css).toMatch(/var\(--ap-surface-bg-surface,\s*var\(--ap-color-bg-surface\)\)/)
  })

  it('inlines the vendored font faces and no remote font URL', () => {
    expect(css).toContain('Inter Fallback')
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })
})
