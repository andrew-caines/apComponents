/**
 * The external-consumer check: an app outside this checkout, configured with
 * nothing but `apComponents()`, must render every route with one React.
 *
 *   tsx scripts/external-consumer/run.ts --layout <a|b> --mode <build|dev> [--keep]
 *
 * Layout A: the vendored checkout is never installed itself; npm runs only in
 * the app. Layout B: `npm install` also ran inside the vendored checkout, so a
 * second `react` sits beside `@ap/react`'s source. See
 * docs/superpowers/specs/2026-10-31-single-react-design.md.
 */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, copyFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium, type ConsoleMessage } from 'playwright'

const REPO = join(import.meta.dirname, '../..')
const TEMPLATE = join(import.meta.dirname, 'template')
const isWin = process.platform === 'win32'
const npm = isWin ? 'npm.cmd' : 'npm'
const npx = isWin ? 'npx.cmd' : 'npx'

const ROUTES = [
  { path: '/form', marker: '#ext-form' },
  { path: '/dialog', marker: '#ext-dialog' },
  { path: '/overlays', marker: '#ext-overlays' },
] as const

// The same allowance the showcase smoke test makes.
const IGNORED = [/favicon/i, /Download the React DevTools/i]

const { values } = parseArgs({
  options: {
    layout: { type: 'string' },
    mode: { type: 'string' },
    keep: { type: 'boolean', default: false },
  },
})
const layout = values.layout
const mode = values.mode
if ((layout !== 'a' && layout !== 'b') || (mode !== 'build' && mode !== 'dev')) {
  console.error('usage: run.ts --layout <a|b> --mode <build|dev> [--keep]')
  process.exit(2)
}

function run(cmd: string, args: string[], cwd: string): void {
  console.log(`\n$ (${cwd}) ${cmd} ${args.join(' ')}`)
  // shell:true on Windows — Node will not spawn a .cmd without it.
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin })
}

/** Copies the working tree (tracked plus untracked, minus ignored), so uncommitted edits are tested too. */
function vendorCheckout(dest: string): void {
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: REPO })
    .toString()
    .split('\0')
    .filter(Boolean)
  for (const file of files) {
    const from = join(REPO, file)
    if (!existsSync(from)) continue // deleted in the working tree
    const to = join(dest, file)
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      srv.close(() => (typeof addr === 'object' && addr ? resolve(addr.port) : reject(new Error('no port'))))
    })
  })
}

async function waitFor(url: string, server: ChildProcess, timeoutMs = 120_000): Promise<void> {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error(`server exited with ${server.exitCode} before answering`)
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error(`server did not answer ${url} within ${timeoutMs}ms`)
}

function stop(server: ChildProcess): void {
  if (server.exitCode !== null || server.pid === undefined) return
  if (isWin) {
    try {
      execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      /* already gone */
    }
  } else {
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {
      /* already gone */
    }
  }
}

async function check(base: string): Promise<string[]> {
  const failures: string[] = []
  const browser = await chromium.launch()
  try {
    for (const route of ROUTES) {
      const page = await browser.newPage()
      const problems: string[] = []
      page.on('console', (m: ConsoleMessage) => {
        if ((m.type() === 'error' || m.type() === 'warning') && !IGNORED.some((r) => r.test(m.text()))) {
          problems.push(m.text())
        }
      })
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
      const response = await page.goto(base + route.path)
      const status = response?.status()
      if (status !== 200) {
        const body = (await response?.text())?.slice(0, 2000) ?? ''
        failures.push(`${route.path}: status ${status}\n${body}`)
        await page.close()
        continue
      }
      try {
        await page.locator(route.marker).waitFor({ timeout: 10_000 })
        await page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true', undefined, {
          timeout: 15_000,
        })
        if (route.path === '/dialog') {
          await page.locator('#open-dialog').click()
          await page.getByRole('dialog').waitFor({ timeout: 5_000 })
        }
      } catch (e) {
        failures.push(`${route.path}: ${(e as Error).message.split('\n')[0]}`)
      }
      if (problems.length > 0) failures.push(`${route.path}: console: ${problems.join(' | ')}`)
      await page.close()
    }
  } finally {
    await browser.close()
  }
  return failures
}

async function main(): Promise<void> {
  const app = mkdtempSync(join(tmpdir(), `ap-ext-${layout}-${mode}-`))
  console.log(`external consumer: layout ${layout}, mode ${mode}, at ${app}`)
  let server: ChildProcess | undefined
  try {
    cpSync(TEMPLATE, app, { recursive: true })
    const vendor = join(app, 'vendor/apComponents')
    vendorCheckout(vendor)
    if (layout === 'b') run(npm, ['install', '--no-audit', '--no-fund'], vendor)
    run(npm, ['install', '--no-audit', '--no-fund'], app)
    run(npx, ['react-router', 'typegen'], app)
    run(npx, ['tsc', '--noEmit'], app)

    const port = await freePort()
    if (mode === 'build') {
      run(npx, ['react-router', 'build'], app)
      server = spawn(npx, ['react-router-serve', './build/server/index.js'], {
        cwd: app,
        env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
        stdio: 'inherit',
        shell: isWin,
        detached: !isWin,
      })
    } else {
      server = spawn(npx, ['react-router', 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
        cwd: app,
        stdio: 'inherit',
        shell: isWin,
        detached: !isWin,
      })
    }
    const base = `http://127.0.0.1:${port}`
    await waitFor(base + '/form', server)
    const failures = await check(base)
    if (failures.length > 0) {
      console.error(`\nFAIL (layout ${layout}, mode ${mode}):\n- ${failures.join('\n- ')}`)
      process.exitCode = 1
    } else {
      console.log(`\nPASS (layout ${layout}, mode ${mode}): ${ROUTES.map((r) => r.path).join(', ')}`)
    }
  } finally {
    if (server) stop(server)
    if (values.keep) console.log(`kept ${app}`)
    else rmSync(app, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exitCode = 1
})
