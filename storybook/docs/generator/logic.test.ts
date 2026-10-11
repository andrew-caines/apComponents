import { describe, expect, it } from 'vitest'
import { normalizeHex } from '@ap/tokens'
import { brandParamValue, buildSnippet, isValidHex, readBrandParam } from './logic.js'

const CASES = ['#2e5fd9', '#2E5FD9', '  #2e5fd9 ', '#abc', '#ABC', 'abc', '#abcd', '#gggggg', '', '#', '#2e5fd9ff']

describe('isValidHex', () => {
  it.each(CASES)('agrees with normalizeHex on %j', (input) => {
    // Perturbation: drop the `i` flag from HEX_PATTERN, and the uppercase rows disagree.
    let accepted = true
    try {
      normalizeHex(input)
    } catch {
      accepted = false
    }
    expect(isValidHex(input)).toBe(accepted)
  })
})

describe('buildSnippet', () => {
  it('imports from @ap/react and passes the normalised hex', () => {
    expect(buildSnippet(' #ABC ')).toBe(
      "import { generateTheme } from '@ap/react'\n\nexport const theme = generateTheme({ brand: '#aabbcc' })\n",
    )
  })
})

describe('readBrandParam', () => {
  it('reads a bare hex', () => expect(readBrandParam('?brand=c2185b')).toBe('#c2185b'))
  it('reads an encoded hash', () => expect(readBrandParam('?brand=%23C2185B')).toBe('#c2185b'))
  it.each(['', '?brand=', '?brand=zz', '?brand=%23', '?other=1'])('returns null for %j', (s) => {
    // Perturbation: return the raw value without isValidHex, and "zz" leaks through.
    expect(readBrandParam(s)).toBeNull()
  })
})

describe('brandParamValue', () => {
  it('strips the hash and lowercases', () => expect(brandParamValue('#2E5FD9')).toBe('2e5fd9'))
})
