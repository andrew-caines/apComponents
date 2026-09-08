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

  it('serves the form route with a real form and a labelled control in the markup', async () => {
    const res = await fetchAsBrowser(`${base}/form`)
    expect(res.status).toBe(200)
    const html = await res.text()

    // A real form the browser can submit without any JavaScript — this is the
    // markup ADR-0011 §4's progressive-enhancement claim rests on.
    expect(html).toContain('method="post"')
    expect(html).toContain('name="email"')

    // The label-to-control wiring is derived during render, so it survives to
    // the server response. `aria-describedby` deliberately is NOT asserted:
    // Base UI's description/error ids register from a layout effect, so the
    // attribute legitimately appears only after hydration.
    //
    // Anchored to an `<input>` specifically, not a bare `toContain(id=...)`:
    // the served label carries an id of the same generated form
    // (`<label id="base-ui-…" for="base-ui-…">` — its own id comes from
    // `useRegisteredLabelId`, a different generated value of the same shape),
    // so a regression where `for` pointed at the label itself, or at the
    // `Field` wrapper `<div>`, would still satisfy an unanchored substring
    // search for `id="<labelFor>"` anywhere in the document. Requiring the id
    // on an `<input>` element specifically is what actually distinguishes a
    // correct label->control pairing from a self-referential one.
    const labelFor = /<label[^>]*\sfor="([^"]+)"/.exec(html)?.[1]
    expect(labelFor, 'no for attribute on the server-rendered label').toBeDefined()
    // `labelFor` is extracted from the response, so it is untrusted input to
    // this RegExp. Base UI's ids are `base-ui-…` today and contain nothing
    // special, but escaping costs one line and removes the class of failure
    // where a changed id format turns this assertion into a different pattern
    // than the one it reads as.
    const escapedLabelFor = labelFor!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    expect(html).toMatch(new RegExp(`<input[^>]*\\sid="${escapedLabelFor}"`))
  })

  it('posts the server-rendered DEFAULT values of Textarea, Checkbox, Switch and RadioGroup through to the action, with no JavaScript involved', async () => {
    // Phase 1: pin the expected defaults against the REAL server markup,
    // with literal assertions — this is what makes the whole test non-
    // circular. Without these, phase 2 below could post whatever the markup
    // happens to contain today and the test would still pass even if that
    // stopped being the INTENDED default (e.g. someone edits the fixture's
    // `defaultValue` text without meaning to).
    const html = await (await fetchAsBrowser(`${base}/form`)).text()

    // Textarea is a real <textarea>: its default is its own text content,
    // not a `value` attribute. Captured, not just matched, because phase 2
    // reuses this exact string rather than retyping it.
    const textareaMatch = /<textarea[^>]*\sname="message"[^>]*>([^<]*)<\/textarea>/.exec(html)
    // `.not.toBeNull()`, NOT `.toBeDefined()`: `RegExp.exec` returns `null` on
    // no match, and `null` satisfies `toBeDefined()` — so the guard was dead
    // and a missing textarea would have died one line later on the non-null
    // assertion instead, with no message. The `find()`-based guards below are
    // correct as written, because `find` returns `undefined`.
    expect(textareaMatch, 'no <textarea name="message"> in server HTML').not.toBeNull()
    const messageValue = textareaMatch![1]!
    expect(messageValue).toBe('Tell us more about your request.')

    // Checkbox, Switch and RadioGroup: scoped to each hidden <input> tag
    // specifically, and requiring `checked` — `name`/`value`/`checked` are
    // all substrings of attribute names Base UI renders unconditionally
    // elsewhere in this document, so an unscoped substring match here could
    // never fail (see the review notes in `RadioGroup.ssr.test.tsx` and
    // `Switch.ssr.test.tsx`, and Task 2's finding).
    const inputTags = html.match(/<input[^>]*>/g) ?? []
    const subscribeTag = inputTags.find((t) => /\bname="subscribe"/.test(t))
    const notificationsTag = inputTags.find((t) => /\bname="notifications"/.test(t))
    const contactEmailTag = inputTags.find(
      (t) => /\bname="contact"/.test(t) && /\bvalue="email"/.test(t),
    )

    expect(subscribeTag, 'no input named "subscribe" in server HTML').toBeDefined()
    expect(subscribeTag).toMatch(/\bchecked=/)
    const subscribeValue = /\bvalue="([^"]*)"/.exec(subscribeTag!)?.[1]!
    expect(subscribeValue).toBe('yes')

    expect(notificationsTag, 'no input named "notifications" in server HTML').toBeDefined()
    expect(notificationsTag).toMatch(/\bchecked=/)
    const notificationsValue = /\bvalue="([^"]*)"/.exec(notificationsTag!)?.[1]!
    expect(notificationsValue).toBe('on')

    expect(contactEmailTag, 'no input named "contact" with value="email" in server HTML').toBeDefined()
    expect(contactEmailTag).toMatch(/\bchecked=/)
    const contactValue = /\bvalue="([^"]*)"/.exec(contactEmailTag!)?.[1]!
    expect(contactValue).toBe('email')

    // Phase 2: POST exactly what phase 1 just extracted from the real
    // markup — not retyped literals — which is a more faithful model of a
    // JavaScript-blocked submission than hand-written values would be: a
    // real browser serialises whatever the server actually rendered, not
    // whatever a test author typed. `email` is the one literal here because
    // it isn't one of the four controls this test covers (the existing
    // "serves the form route..." test above already covers that field).
    //
    // This is gate 6's actual guarantee for these four controls: their
    // SERVER-RENDERED DEFAULT VALUES reach the action without JavaScript. It
    // does NOT prove a no-JS visitor could have CHANGED them — Checkbox's,
    // Switch's and RadioGroup's operable element is a `role`-bearing `<span>`
    // that does nothing without JS; the hidden `<input>` sibling that
    // actually carries the value into the post is aria-hidden, tabIndex=-1
    // and invisible. Textarea is the one exception: it is a real, editable
    // `<textarea>`, so a no-JS user genuinely could have changed its value
    // before this same post.
    const body = new URLSearchParams({
      email: 'person@example.com',
      message: messageValue,
      subscribe: subscribeValue,
      notifications: notificationsValue,
      contact: contactValue,
    })
    const res = await fetch(`${base}/form`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': BROWSER_UA,
      },
      body: body.toString(),
    })
    expect(res.status).toBe(200)
    const postHtml = await res.text()

    // Scoped to the element carrying the given id, and asserting its EXACT
    // text content — not a bare `toContain`, unsafe for the same reason as
    // phase 1's tag-scoped matches above.
    //
    // React's SSR text renderer inserts an empty `<!-- -->` comment marker
    // between static and dynamic text nodes (visible in the raw response:
    // `received: <!-- -->person@example.com`) — stripped here before
    // comparing, or every one of these would fail on that marker rather than
    // on a real defect.
    const textOf = (id: string): string | undefined => {
      const raw = new RegExp(`id="${id}">([\\s\\S]*?)</`).exec(postHtml)?.[1]
      return raw?.replace(/<!--\s*-->/g, '')
    }

    expect(textOf('submitted')).toBe('received: person@example.com')
    expect(textOf('echo-message')).toBe(`message: ${messageValue}`)
    expect(textOf('echo-subscribe')).toBe(`subscribe: ${subscribeValue}`)
    expect(textOf('echo-notifications')).toBe(`notifications: ${notificationsValue}`)
    expect(textOf('echo-contact')).toBe(`contact: ${contactValue}`)
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
      // Collected across EVERY manifest chunk rather than from the `home`
      // chunk specifically. Which chunk owns a component's CSS is a Vite
      // code-splitting decision, not a property of our build: the moment a
      // second route imported `Surface`, its CSS was hoisted into a shared
      // chunk and a `home`-pinned assertion failed while nothing was actually
      // wrong. Reading from the manifest (rather than globbing the directory)
      // keeps the real guarantee — the file is REACHABLE from the build, not
      // merely present on disk as an orphan.
      const manifest = readClientManifest()
      const cssFiles = [
        ...new Set(
          Object.values(manifest).flatMap((chunk) => (chunk as { css?: string[] }).css ?? []),
        ),
      ]
      expect(cssFiles.length, 'no chunk in the client manifest references any css').toBeGreaterThan(0)

      const cssOnDisk = cssFiles
        .map((f) => readFileSync(join(APP, 'build/client', f), 'utf8'))
        .join('\n')
      // The silent-CSS-loss defect this exists for: a recipe that compiles to
      // nothing, or a vanilla-extract transform that never ran, leaves the SPA
      // booting perfectly with no component styling at all.
      expect(cssOnDisk).toMatch(/\._[0-9a-z]+\{[^}]*--ap-surface-bg-canvas/)
      expect(cssOnDisk).toMatch(/@layer ap\.components\s*\{[\s\S]*?--ap-surface-bg-canvas/)
    })
  },
  180_000,
)
