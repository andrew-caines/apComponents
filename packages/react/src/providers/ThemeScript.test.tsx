// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeScript } from './ThemeScript.js'

/**
 * ThemeScript interpolates the storage key into an inline <script> emitted
 * via dangerouslySetInnerHTML. JSON.stringify is what keeps a key containing
 * a quote from breaking out of the string literal and turning into
 * executable script — a classic injection. Nothing in the repo verified this
 * property before now.
 *
 * This executes the emitted script body against stub browser globals and
 * proves that a key crafted to break out of the string literal cannot run
 * arbitrary code. Replacing JSON.stringify with plain template interpolation
 * reintroduces exactly that break-out and makes this test fail.
 */
describe('ThemeScript', () => {
  it('escapes a storageKey containing a quote so it cannot break out of the script payload', () => {
    const malicious = '"); globalThis.__pwned = true; //'
    const { container } = render(<ThemeScript storageKey={malicious} />)
    const script = container.querySelector('script')
    expect(script).not.toBeNull()
    const source = script!.textContent ?? ''

    const sandbox: { __pwned?: boolean } = {}
    const run = new Function('localStorage', 'document', 'globalThis', source)
    expect(() =>
      run({ getItem: () => 'dark' }, { documentElement: { setAttribute: () => {} } }, sandbox),
    ).not.toThrow()
    expect(sandbox.__pwned).toBeUndefined()
  })
})
