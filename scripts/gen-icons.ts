// Dev-only script: regenerates packages/icons/svg/*.svg from the built-in icons.
// Run: npm run gen:icons   — commit the output. Never edited by hand.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { builtIns } from '../packages/icons/src/gates/builtIns.js'
import { toSvg } from '../packages/icons/src/svg.js'

const DIR = 'packages/icons/svg'
mkdirSync(DIR, { recursive: true })

const files = new Map<string, string>()
for (const def of await builtIns()) {
  files.set(`${def.name}.svg`, toSvg(def, { duoTone: false }))
  files.set(`${def.name}.duotone.svg`, toSvg(def, { duoTone: true }))
}

for (const f of readdirSync(DIR)) {
  if (f.endsWith('.svg') && !files.has(f)) rmSync(join(DIR, f))
}
for (const [f, svg] of files) writeFileSync(join(DIR, f), svg)
console.log(`wrote ${files.size} files`)
