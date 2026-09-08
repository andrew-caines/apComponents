import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sourceFiles } from './sourceFiles.js'

const SRC = join(import.meta.dirname, '..')

// gates/ is test infrastructure, not shipped runtime code.
const EXCLUDE_DIRS = ['gates']

// ThemeScript deliberately does not carry 'use client': it renders a raw
// <script> and holds no state, so it is usable from a server entry
// (ADR-0005/0009). Every other provider module owns state or touches
// browser-only APIs from effects/callbacks and must be a client module,
// exactly like every component.
const THEME_SCRIPT_PATH = join(SRC, 'providers', 'ThemeScript.tsx')

// F5: .ts modules are in scope too, not just .tsx — hooks/useHydrated.ts and
// hooks/useIsomorphicLayoutEffect.ts are stateful/browser-touching client
// modules exactly like a component, and nothing was enforcing their
// 'use client' directive before this gate looked at .ts files at all. Each
// .ts file excluded below is named individually, with the reason it
// genuinely carries no client-only behaviour, rather than exempting a whole
// extension or directory.
const TS_EXEMPTIONS: Array<{ path: string; why: string }> = [
  {
    path: join(SRC, 'icons', 'paths.ts'),
    why: 'a frozen object of SVG path strings — no state, no browser API, nothing to hydrate',
  },
  {
    path: join(SRC, 'providers', 'messages.ts'),
    why: 'the default message-string registry — plain data, read by client modules but not one itself',
  },
  {
    path: join(SRC, 'theme', 'tier3.ts'),
    why: 'a pure string-building helper (var(--ap-x, fallback)) — no state, no browser API',
  },
  {
    path: join(SRC, 'components', 'Surface', 'Surface.tokens.ts'),
    why: 'a frozen object of Tier 3 token strings, built with tier3() — pure data like tier3.ts itself',
  },
  {
    path: join(SRC, 'components', 'Button', 'Button.tokens.ts'),
    why: 'a frozen object of Tier 3 token strings, built with tier3() — pure data like Surface.tokens.ts',
  },
  {
    path: join(SRC, 'components', 'Input', 'Input.tokens.ts'),
    why: 'a frozen object of Tier 3 token strings, built with tier3() — pure data like Button.tokens.ts',
  },
  {
    path: join(SRC, 'components', 'Dialog', 'Dialog.tokens.ts'),
    why: 'a frozen object of Tier 3 token strings, built with tier3() — pure data like Spinner.tokens.ts',
  },
  {
    path: join(SRC, 'components', 'Spinner', 'Spinner.tokens.ts'),
    why: 'a frozen object of Tier 3 token strings, built with tier3() — pure data like Field.tokens.ts',
  },
  {
    path: join(SRC, 'components', 'Field', 'Field.tokens.ts'),
    why: 'a frozen object of Tier 3 token strings, built with tier3() — pure data like Input.tokens.ts',
  },
  {
    path: join(SRC, 'components', 'Textarea', 'Textarea.tokens.ts'),
    why: 'Tier 3 token declarations — a plain object of strings, no React, no client behaviour.',
  },
  {
    path: join(SRC, 'components', 'Checkbox', 'Checkbox.tokens.ts'),
    why: 'a frozen object of Tier 3 token strings, built with tier3() — pure data like Textarea.tokens.ts',
  },
  {
    path: join(SRC, 'components', 'Switch', 'Switch.tokens.ts'),
    why: 'a frozen object of Tier 3 token strings, built with tier3() — pure data like Checkbox.tokens.ts',
  },
]

// Barrels (index.ts) only re-export; they hold no behaviour of their own to
// gate on, and their re-exports already point at modules this gate checks
// directly.
const isBarrel = (file: string) => basename(file) === 'index.ts'

// .css.ts files are vanilla-extract stylesheets compiled at build time, never
// executed as React runtime modules — 'use client' has no meaning for them.
const isCssTs = (file: string) => file.endsWith('.css.ts')

describe('gate: every shipped .ts/.tsx module is a client module (ADR-0005)', () => {
  const allFiles = sourceFiles(SRC, { extensions: ['.tsx', '.ts'], excludeDirs: EXCLUDE_DIRS })
  const tsExemptionPaths = new Set(TS_EXEMPTIONS.map((e) => e.path))
  const files = allFiles.filter(
    (f) => f !== THEME_SCRIPT_PATH && !isBarrel(f) && !isCssTs(f) && !tsExemptionPaths.has(f),
  )

  it('finds modules to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('reaches every top-level source directory this gate has always covered', () => {
    // Subset, not equality: the allowlist this replaced covered components/
    // and providers/ only, so icons/ was unscanned from the day it was
    // created — naming the directories this gate must keep reaching is what
    // keeps THAT regression visible. But equality also hard-fails the day a
    // legitimate new top-level directory (or, after F5, hooks/) starts
    // contributing checked files — that is growth, not a gate bug, so this
    // only asserts the original three are still present.
    const dirs = new Set(files.map((f) => f.slice(SRC.length + 1).split(/[\\/]/)[0]))
    for (const required of ['components', 'icons', 'providers']) {
      expect([...dirs], `expected '${required}' to still be reached`).toContain(required)
    }
  })

  for (const file of files) {
    it(`${file.split('src')[1]} starts with 'use client'`, () => {
      const first = readFileSync(file, 'utf8').trimStart().split('\n')[0]!.trim()
      expect(first).toBe("'use client'")
    })
  }

  it('ThemeScript.tsx still exists, so its exemption is not stale config for a moved/renamed file', () => {
    expect(existsSync(THEME_SCRIPT_PATH)).toBe(true)
  })

  describe('the .ts files exempted as genuinely not client modules (F5)', () => {
    for (const { path, why } of TS_EXEMPTIONS) {
      it(`${path.split('src')[1]} still exists, so its exemption (${why}) is not stale config`, () => {
        expect(existsSync(path)).toBe(true)
      })
    }

    it('every exemption path was actually reached by the walk, not a typo that exempts nothing', () => {
      for (const { path } of TS_EXEMPTIONS) {
        expect(allFiles, `${path} was not found by sourceFiles — check the path`).toContain(path)
      }
    })
  })
})
