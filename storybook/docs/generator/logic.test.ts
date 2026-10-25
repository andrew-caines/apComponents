import { describe, expect, it } from 'vitest'
import { normalizeHex } from '@ap/tokens'
import { brandParamValue, buildSnippet, isValidHex, mirrorBrand, readBrandParam } from './logic.js'

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
  it.each(['?brand=%20c2185b%20', '?brand=+%23c2185b'])('reads a padded value %j', (s) => {
    // Perturbation: check for `#` before trimming, and the padded bare hex becomes `# c2185b`.
    expect(readBrandParam(s)).toBe('#c2185b')
  })
  it.each(['', '?brand=', '?brand=zz', '?brand=%23', '?other=1'])('returns null for %j', (s) => {
    // Perturbation: return the raw value without isValidHex, and "zz" leaks through.
    expect(readBrandParam(s)).toBeNull()
  })
})

describe('brandParamValue', () => {
  it('strips the hash and lowercases', () => expect(brandParamValue('#2E5FD9')).toBe('2e5fd9'))
})

/** A window stand-in: a URL and a history whose replaceState records or throws. */
function fakeWindow(href: string, refuses = false) {
  const w = {
    location: { href },
    history: {
      state: null,
      replaceState: (_s: unknown, _t: string, url: URL) => {
        if (refuses) throw new DOMException('denied', 'SecurityError')
        w.location.href = String(url)
      },
    },
    top: null as unknown,
  }
  return w
}
const asWindow = (w: ReturnType<typeof fakeWindow>) => w as unknown as Window

describe('mirrorBrand', () => {
  it('writes the same-origin top URL, keeping its other params', () => {
    const top = fakeWindow('http://x/?path=/docs/a--docs')
    const frame = fakeWindow('http://x/iframe.html?id=a')
    top.top = top
    frame.top = top
    mirrorBrand('00897b', asWindow(frame))
    expect(new URL(top.location.href).searchParams.get('path')).toBe('/docs/a--docs')
    expect(new URL(top.location.href).searchParams.get('brand')).toBe('00897b')
    expect(frame.location.href).toBe('http://x/iframe.html?id=a')
  })
  it('falls back to its own URL when the top is cross-origin', () => {
    const frame = fakeWindow('http://x/iframe.html?id=a')
    Object.defineProperty(frame, 'top', {
      get() {
        throw new DOMException('cross-origin', 'SecurityError')
      },
    })
    mirrorBrand('00897b', asWindow(frame))
    expect(new URL(frame.location.href).searchParams.get('brand')).toBe('00897b')
  })
  it('does not throw when its own window refuses the write too', () => {
    // Perturbation: drop the try/catch around the fallback replaceState, and this throws.
    const frame = fakeWindow('http://x/iframe.html?id=a', true)
    frame.top = frame
    expect(() => mirrorBrand('00897b', asWindow(frame))).not.toThrow()
    expect(frame.location.href).toBe('http://x/iframe.html?id=a')
  })
})
