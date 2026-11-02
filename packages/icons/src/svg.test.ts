import { describe, expect, it } from 'vitest'
import { Check } from './icons/check.js'
import { Info } from './icons/info.js'
import { toSvg } from './svg.js'
import type { IconDefinition } from './types.js'

const ROOT_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'

describe('toSvg', () => {
  it('serialises Info as outline', () => {
    expect(toSvg(Info, { duoTone: false })).toBe(
      [
        ROOT_OPEN,
        '  <path d="M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
        '</svg>',
        '',
      ].join('\n'),
    )
  })

  it('serialises Info as duotone with the filled secondary painted first', () => {
    expect(toSvg(Info, { duoTone: true })).toBe(
      [
        ROOT_OPEN,
        '  <g fill="currentColor" fill-opacity="0.4" stroke="none">',
        '    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
        '  </g>',
        '  <path d="M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
        '</svg>',
        '',
      ].join('\n'),
    )
  })

  it('serialises Check as duotone with a halo group repeating the primary paths', () => {
    expect(toSvg(Check, { duoTone: true })).toBe(
      [
        ROOT_OPEN,
        '  <g stroke-width="5" stroke-opacity="0.4">',
        '    <path d="M20 6 9 17l-5-5"/>',
        '  </g>',
        '  <path d="M20 6 9 17l-5-5"/>',
        '</svg>',
        '',
      ].join('\n'),
    )
  })

  it('duotone on an icon with no secondary equals the outline output', () => {
    const plain: IconDefinition = { name: 'plain', primary: ['M0 0h1'] }
    expect(toSvg(plain, { duoTone: true })).toBe(toSvg(plain, { duoTone: false }))
  })

  it('takes the root viewBox from the definition when it has one', () => {
    const wide: IconDefinition = { name: 'wide', primary: ['M0 0h1'], viewBox: '0 0 32 32' }
    expect(toSvg(wide, { duoTone: false })).toContain('viewBox="0 0 32 32"')
  })
})
