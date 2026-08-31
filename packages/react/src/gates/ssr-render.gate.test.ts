import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const APP = join(import.meta.dirname, '../../../../fixtures/ssr-app')
const isWin = process.platform === 'win32'
const npm = isWin ? 'npm.cmd' : 'npm'
// Node refuses to spawn a .cmd without a shell (the CVE-2024-27980 fix),
// so Windows needs shell:true or every fixture gate dies with EINVAL.
const shell = isWin

// Same fixture shape and same limit as the consumer gate (see
// consumer-build.gate.test.ts): this proves the fixture builds and serves
// against our source, not ADR-0002's transitive `file:` resolution — the
// fixture is nested inside the monorepo, so Node's resolution walks up to the
// root `node_modules` regardless of what npm installed under the fixture
// itself. The gap is broader than just the `@ap/tokens` hop: this fixture's
// lockfile records `@ap/react`'s full requirement set (`@ap/tokens`,
// `@vanilla-extract/css`, `@vanilla-extract/recipes`, and
// `@vanilla-extract/vite-plugin` for the build itself) with no installed
// node for any of them — the entire dependency closure of `@ap/react` and
// `@ap/vite` is masked by the root `node_modules`.
// See docs/CONTRIBUTING.md, "Known gaps in Phase 2's gates".

let port: number
let base: string
let server: ChildProcess | undefined
let serverOutput = ''

// RR8's default entry.server.tsx checks `isbot(userAgent)` and renders fully
// buffered (`onAllReady`, no streaming, no Suspense fallback ever sent) for
// anything it thinks is a crawler — and Node's built-in `fetch()` sends
// `User-Agent: node`, which `isbot` flags as a bot. Without a browser-like UA
// here, gate 6's streaming assertion silently exercises the wrong render
// path: verified by capturing the raw response both ways (see
// docs/rr8-fixture-notes.md) — with the default UA the whole page arrives resolved
// in one shot; with this UA the fallback is genuinely flushed first.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function fetchAsBrowser(url: string): Promise<Response> {
  return fetch(url, { headers: { 'user-agent': BROWSER_UA } })
}

/**
 * A fixed port can already be bound by a leaked process from a previous run
 * (see docs/rr8-fixture-notes.md: this is exactly the bug that made the
 * original gate pass against a stale server). Binding port 0 and reading back
 * the OS-assigned port means concurrent/leaked runs cannot collide at all.
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (address && typeof address === 'object') {
        const { port: assigned } = address
        probe.close(() => resolve(assigned))
      } else {
        probe.close()
        reject(new Error('could not determine a free port'))
      }
    })
  })
}

async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(
    `server did not start within ${timeoutMs}ms\n--- captured server stdio ---\n${serverOutput || '(nothing captured)'}`,
  )
}

/**
 * `server?.kill()` only kills the `cmd.exe` (or `sh -c`) wrapper that
 * `shell: true` creates, not the npm -> node -> react-router-serve
 * grandchildren — the classic Windows/POSIX shell-spawn process-tree leak.
 * `taskkill /T /F` walks the real Windows process tree; on POSIX,
 * `detached: true` at spawn time makes the child its own process-group
 * leader, so signalling `-pid` reaches the whole group.
 */
function killServerTree(proc: ChildProcess): void {
  if (proc.pid == null) return
  if (isWin) {
    try {
      execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      // already exited
    }
  } else {
    try {
      process.kill(-proc.pid, 'SIGKILL')
    } catch {
      // already exited
    }
  }
}

interface ManifestChunk {
  file: string
  name?: string
  isEntry?: boolean
  css?: string[]
}
type Manifest = Record<string, ManifestChunk>

function readClientManifest(): Manifest {
  const manifestPath = join(APP, 'build/client/.vite/manifest.json')
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
}

function findManifestChunk(manifest: Manifest, name: string): ManifestChunk {
  const chunk = Object.values(manifest).find((c) => c.name === name)
  if (!chunk) {
    const known = Object.values(manifest)
      .map((c) => c.name)
      .filter(Boolean)
      .join(', ')
    throw new Error(`manifest has no chunk named "${name}" — known chunks: ${known}`)
  }
  return chunk
}

beforeAll(async () => {
  execFileSync(npm, ['run', 'build'], {
    cwd: APP,
    stdio: 'inherit',
    shell,
    env: { ...process.env },
  })
  port = await getFreePort()
  base = `http://127.0.0.1:${port}`
  // eslint-disable-next-line no-console
  console.log(`[ssr-render.gate] serving build on ${base}`)
  server = spawn(npm, ['run', 'start'], {
    cwd: APP,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell,
    detached: !isWin,
  })
  server.stdout?.on('data', (chunk: Buffer) => {
    serverOutput += chunk.toString()
  })
  server.stderr?.on('data', (chunk: Buffer) => {
    serverOutput += chunk.toString()
  })
  await waitForServer()
}, 180_000)

afterAll(() => {
  if (server) killServerTree(server)
  // Gate 7 rebuilds the fixture as an SPA as its last act, overwriting
  // `build/`. Leave the fixture SSR-built for Task 8 and beyond regardless
  // of which gate ran last or whether any test failed.
  try {
    execFileSync(npm, ['run', 'build'], {
      cwd: APP,
      stdio: 'inherit',
      shell,
      env: { ...process.env },
    })
  } catch {
    // best-effort: don't let cleanup mask the real test failure
  }
}, 60_000)

describe('gate 6: React Router 8 framework-mode SSR', () => {
  it('server-renders Surface markup into the HTML, not an empty shell', async () => {
    const html = await (await fetchAsBrowser(base)).text()
    expect(html).toContain('server rendered surface')
    expect(html).toContain('data-ap-tone="raised"')
    expect(html).toContain('data-ap-pad="lg"')
    expect(html).toContain('data-ap-tone="canvas"')
    expect(html).toContain('data-ap-pad="sm"')
  })

  it("links this build's actual compiled stylesheets by their real hashed filenames", async () => {
    const html = await (await fetchAsBrowser(base)).text()
    const manifest = readClientManifest()
    const rootCss = findManifestChunk(manifest, 'root').css?.[0]
    const surfaceCss = findManifestChunk(manifest, 'Surface').css?.[0]
    expect(rootCss, 'root chunk should have an associated css file in the manifest').toBeTruthy()
    expect(surfaceCss, 'Surface chunk should have an associated css file in the manifest').toBeTruthy()
    // A stale server (this build's manifest, a previous build's response)
    // cannot satisfy these — the hashes only match if the HTML we fetched
    // actually came from the build we just produced.
    expect(html).toContain(`href="/${rootCss}"`)
    expect(html).toContain(`href="/${surfaceCss}"`)
  })

  it('flushes Suspense content that resolves after the shell, in shell-then-content order', async () => {
    const html = await (await fetchAsBrowser(`${base}/streamed`)).text()
    // The fallback must actually appear — not just the eventual content —
    // or a loader that awaits its own promise before returning would satisfy
    // this test identically to a genuinely deferred/streamed one.
    expect(html).toContain('loading…')
    expect(html).toContain('streamed surface content')
    expect(html).toContain('id="streamed-surface"')
    expect(html.indexOf('loading…')).toBeLessThan(html.indexOf('streamed surface content'))
  })

  it("serves token custom properties and Surface's own recipe CSS over HTTP, not just on disk", async () => {
    const html = await (await fetchAsBrowser(base)).text()
    const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]!)
    expect(hrefs.length).toBeGreaterThan(0)
    const cssParts = await Promise.all(hrefs.map(async (href) => (await fetchAsBrowser(`${base}${href}`)).text()))
    const css = cssParts.join('\n')
    expect(css).toContain('--ap-color-bg-canvas')
    expect(css).toContain('@layer ap.tokens')
    // A hashed vanilla-extract class whose rule references a Surface-specific
    // tier-3 token: proves Surface's OWN recipe CSS was actually served to
    // the client, not merely present somewhere on disk. This is not
    // redundant with the assertions above — a build that resolves @ap/react
    // through its node_modules symlink with default Vite settings can drop
    // Surface's compiled styles from the bundle entirely while still
    // satisfying every check above (see vite.config.ts).
    expect(css).toMatch(/\._[0-9a-z]+\{[^}]*--ap-surface-bg-canvas/)
    // And not merely present in the served CSS at all, but genuinely inside
    // the opened `ap.components` layer (ADR-0016) — the mere presence of the
    // string "ap.components" in the layer-order declaration
    // (`@layer ap.tokens, ap.components;`) would satisfy a looser check
    // identically to a build where the recipe is emitted unlayered.
    expect(css).toMatch(/@layer ap\.components\s*\{[\s\S]*?--ap-surface-bg-canvas/)
  })
})

describe(
  'gate 7: the same app builds and serves as an SPA',
  () => {
    it('produces a client-only shell (not a prerendered page) with Surface CSS still wired through the build', () => {
      execFileSync(npm, ['run', 'build'], {
        cwd: APP,
        stdio: 'inherit',
        shell,
        env: { ...process.env, AP_SPA: '1' },
      })
      const indexHtml = join(APP, 'build/client/index.html')
      expect(existsSync(indexHtml), 'SPA build should emit build/client/index.html').toBe(true)
      const html = readFileSync(indexHtml, 'utf8')

      // A real hydration handoff, not a stub file.
      expect(html).toContain('window.__reactRouterContext')

      // Proves the ADR-0005 shell/prerender distinction directly, rather
      // than assuming it: this is a client-rendered shell, not a
      // server-rendered page. Verified empirically (see docs/rr8-fixture-notes.md):
      // RR8's SPA-mode fallback, produced when no `prerender` paths are
      // configured, is a generic loading placeholder rendered through a
      // different code path than a real route match — it contains no
      // <Links/> output at all, so no stylesheet is linked in this specific
      // file. The real stylesheet is applied once client JS mounts root.tsx
      // after hydration.
      expect(html).not.toContain('server rendered surface')

      // The silent-CSS-loss defect (see gate 6) can hide behind "the SPA
      // build succeeded" exactly as easily as it hid behind the SSR build.
      // Prove the CSS is genuinely wired at the manifest level, and that the
      // referenced file on disk actually contains Surface's compiled rules
      // — even though the static bootstrap shell doesn't link it directly.
      const manifest = readClientManifest()
      const rootCss = findManifestChunk(manifest, 'root').css?.[0]
      expect(rootCss, 'root chunk should have an associated css file in the manifest').toBeTruthy()
      const homeCss = findManifestChunk(manifest, 'home').css?.[0]
      expect(homeCss, 'home chunk should have an associated css file in the manifest').toBeTruthy()
      const cssOnDisk = readFileSync(join(APP, 'build/client', homeCss!), 'utf8')
      expect(cssOnDisk).toMatch(/\._[0-9a-z]+\{[^}]*--ap-surface-bg-canvas/)
      expect(cssOnDisk).toMatch(/@layer ap\.components\s*\{[\s\S]*?--ap-surface-bg-canvas/)
    })
  },
  180_000,
)
