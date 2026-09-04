// Dev-only script: recaptures examples/scales/scales-{light,dark}.png from
// examples/scales/index.html.
// Run: npm run gen:scale-demo   — commit the output.
//
// The page links the real generated theme.css and fonts.css by relative path,
// so it opens in a browser on its own; this script only automates the two
// colour schemes and the measurement table.
//
// Playwright is not a root dependency — it lives in fixtures/ssr-app, which
// already needs it for the hydration e2e. Resolving it from there keeps a
// docs script from adding a browser download to every install.
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const FIXTURE = resolve('fixtures/ssr-app')
if (!existsSync(resolve(FIXTURE, 'node_modules/playwright'))) {
  throw new Error(
    'playwright not found in fixtures/ssr-app — run `npm run fixture:install` first.',
  )
}
const require = createRequire(pathToFileURL(resolve(FIXTURE, 'package.json')))
const { chromium } = require('playwright') as typeof import('playwright')

const PAGE = pathToFileURL(resolve('examples/scales/index.html')).href

const browser = await chromium.launch()
try {
  for (const scheme of ['light', 'dark'] as const) {
    const page = await browser.newPage({
      viewport: { width: 1180, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: scheme,
    })
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(String(e)))

    await page.goto(PAGE, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)

    // Prove theme.css actually loaded. Without this the page still renders --
    // unstyled, with every var() falling back to nothing -- and the screenshot
    // would look plausible while showing none of the real token values.
    const probe = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement)
      return {
        textLg: cs.getPropertyValue('--ap-text-lg-size').trim(),
        iconLg: cs.getPropertyValue('--ap-icon-lg').trim(),
        font: getComputedStyle(document.body).fontFamily,
      }
    })
    if (!probe.textLg || !probe.iconLg) {
      throw new Error(
        `theme.css did not load — text-lg="${probe.textLg}" icon-lg="${probe.iconLg}"`,
      )
    }
    if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`)

    await page.screenshot({
      path: `examples/scales/scales-${scheme}.png`,
      fullPage: true,
    })
    console.log(`${scheme}: text-lg=${probe.textLg} icon-lg=${probe.iconLg}`)
    await page.close()
  }

  // The measured pairing table, printed so the numbers are reviewable in a
  // terminal and in CI logs -- not only by eye in a PNG.
  const page = await browser.newPage()
  await page.goto(PAGE, { waitUntil: 'networkidle' })
  const rows = await page.$$eval('#pair-table tbody tr, #match-table tbody tr', (trs) =>
    trs.map((tr) => {
      const table = tr.closest('table')!.id
      const svg = tr.querySelector('svg')!
      return {
        table,
        step: tr.children[0]!.textContent!.trim(),
        text: getComputedStyle(tr.querySelector('.pair')!).fontSize,
        icon: getComputedStyle(svg).width,
      }
    }),
  )
  console.table(rows)
  await page.close()
} finally {
  await browser.close()
}
