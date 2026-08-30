import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const APP = join(import.meta.dirname, '../../../../fixtures/consumer')
const DIST = join(APP, 'dist')
const isWin = process.platform === 'win32'
const npm = isWin ? 'npm.cmd' : 'npm'

let css = ''

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
