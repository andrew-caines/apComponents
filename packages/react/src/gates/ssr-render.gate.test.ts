import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const APP = join(import.meta.dirname, '../../../../fixtures/ssr-app')
const PORT = 3111
const BASE = `http://127.0.0.1:${PORT}`
const isWin = process.platform === 'win32'
const npm = isWin ? 'npm.cmd' : 'npm'
// Node refuses to spawn a .cmd without a shell (the CVE-2024-27980 fix),
// so Windows needs shell:true or every fixture gate dies with EINVAL.
const shell = isWin

let server: ChildProcess

async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`server did not start within ${timeoutMs}ms`)
}

beforeAll(async () => {
  execFileSync(npm, ['run', 'build'], {
    cwd: APP,
    stdio: 'inherit',
    shell,
    env: { ...process.env },
  })
  server = spawn(npm, ['run', 'start'], {
    cwd: APP,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
    shell,
  })
  await waitForServer()
}, 180_000)

afterAll(() => {
  server?.kill()
})

describe('gate 6: React Router 8 framework-mode SSR', () => {
  it('server-renders Surface markup into the HTML, not an empty shell', async () => {
    const html = await (await fetch(BASE)).text()
    expect(html).toContain('server rendered surface')
    expect(html).toContain('data-ap-tone="raised"')
    expect(html).toContain('data-ap-pad="lg"')
    expect(html).toContain('data-ap-tone="canvas"')
  })

  it('links the compiled stylesheet from the server HTML', async () => {
    const html = await (await fetch(BASE)).text()
    expect(html).toMatch(/<link[^>]+rel="stylesheet"[^>]+\.css/)
  })

  it('flushes Suspense content that resolves after the shell', async () => {
    const html = await (await fetch(`${BASE}/streamed`)).text()
    expect(html).toContain('streamed surface content')
    expect(html).toContain('id="streamed-surface"')
  })

  it('emits token custom properties into the built CSS', () => {
    const assets = join(APP, 'build/client/assets')
    const css = readdirSync(assets)
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(assets, f), 'utf8'))
      .join('\n')
    expect(css).toContain('--ap-color-bg-canvas')
    expect(css).toContain('@layer ap.tokens')
    // A hashed vanilla-extract class whose rule references a Surface-specific
    // tier-3 token: proves Surface's OWN recipe CSS shipped, not just the
    // theme tokens imported directly by root.tsx. This is not redundant with
    // the assertions above — a build that resolves @ap/react through its
    // node_modules symlink with default Vite settings can emit an empty
    // `@layer ap.components` and still satisfy every check above while
    // silently dropping Surface's styles entirely (see vite.config.ts).
    expect(css).toMatch(/\._[0-9a-z]+\{[^}]*--ap-surface-bg-canvas/)
  })
})

describe('gate 7: the same app builds and serves as an SPA', () => {
  it('produces a client-only build with an index.html', () => {
    execFileSync(npm, ['run', 'build'], {
      cwd: APP,
      stdio: 'inherit',
      shell,
      env: { ...process.env, AP_SPA: '1' },
    })
    const indexHtml = join(APP, 'build/client/index.html')
    expect(existsSync(indexHtml), 'SPA build should emit build/client/index.html').toBe(true)
    const html = readFileSync(indexHtml, 'utf8')
    expect(html).toMatch(/<link[^>]+rel="stylesheet"[^>]+\.css/)
  })
}, 180_000)
