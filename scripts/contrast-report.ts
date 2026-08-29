import { mkdirSync, writeFileSync } from 'node:fs'
import { contrastPairings, generateTheme, renderContrastReport, DEFAULT_BRAND } from '@ap/tokens'

const pairings = contrastPairings(generateTheme({ brand: DEFAULT_BRAND }))
mkdirSync('reports', { recursive: true })
writeFileSync('reports/contrast.md', renderContrastReport(pairings))
const failures = pairings.filter((p) => !p.pass)
console.log(`reports/contrast.md written — ${pairings.length} pairings, ${failures.length} failures`)
if (failures.length > 0) process.exit(1)
