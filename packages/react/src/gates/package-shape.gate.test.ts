import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PACKAGE_DIR = join(import.meta.dirname, '../..')
const pkg = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')) as {
  exports: Record<string, string>
  dependencies: Record<string, string>
}
const baseUi = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../node_modules/@base-ui/react/package.json'), 'utf8'),
) as { dependencies: Record<string, string> }

// The hooks and format subpaths are public API. A missing export entry, or an
// entry pointing at a file that moved, breaks every consumer's import while
// the in-repo tests (which import by relative path) stay green.
describe('gate: @ap/react package shape', () => {
  for (const subpath of ['./hooks', './format']) {
    it(`exports ${subpath}, and its target exists on disk`, () => {
      const target = pkg.exports[subpath]
      expect(target, `exports['${subpath}'] is missing`).toBeDefined()
      expect(existsSync(join(PACKAGE_DIR, target!)), `${target} does not exist`).toBe(true)
    })
  }

  it("keeps the root export at './src/index.ts'", () => {
    expect(pkg.exports['.']).toBe('./src/index.ts')
  })

  // @base-ui/utils is pinned exactly, and to the version Base UI itself pins,
  // so the hooks we import from it are the ones Base UI was tested with. The
  // expected version is read from Base UI's package.json, never hardcoded, so
  // a Base UI bump that changes its pin fails here instead of drifting.
  it('pins @base-ui/utils to the exact version @base-ui/react depends on', () => {
    const expected = baseUi.dependencies['@base-ui/utils']
    expect(expected, '@base-ui/react no longer depends on @base-ui/utils').toBeDefined()
    expect(pkg.dependencies['@base-ui/utils']).toBe(expected)
  })
})
