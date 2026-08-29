import { describe, expect, it } from 'vitest'
import { ELEVATION, MISC, RADIUS, SPACE, TEXT, Z } from './scales.js'
import { breakpoints, media } from '../breakpoints.js'

describe('scales', () => {
  it('z-order encodes toast above dialog and tooltip above everything (ADR-0016)', () => {
    expect(Z['toast']!).toBeGreaterThan(Z['dialog']!)
    expect(Z['tooltip']!).toBeGreaterThan(Z['toast']!)
    expect(Z['popover']!).toBeGreaterThan(Z['dialog']!)
  })
  it('space scale starts at 0 and is strictly increasing', () => {
    expect(SPACE['0']).toBe('0px')
    const px = Object.values(SPACE).map((v) => parseInt(v, 10))
    for (let i = 1; i < px.length; i++) expect(px[i]!).toBeGreaterThan(px[i - 1]!)
  })
  it('text sizes are px pairs', () => {
    expect(TEXT['md']).toEqual({ size: '16px', lineHeight: '24px' })
  })
  it('media strings match breakpoint values', () => {
    expect(media.sm).toBe(`(min-width: ${breakpoints.sm}px)`)
    expect(media.coarse).toBe('(pointer: coarse)')
  })
  it('hit targets follow ADR-0017', () => {
    expect(MISC['hit-target']).toBe('24px')
    expect(MISC['hit-target-coarse']).toBe('44px')
  })
  it('elevation has three levels per mode', () => {
    expect(Object.keys(ELEVATION.light)).toEqual(['1', '2', '3'])
    expect(Object.keys(ELEVATION.dark)).toEqual(['1', '2', '3'])
  })
  it('dark elevation uses fewer shadow layers than light (ADR-0006)', () => {
    const levels = ['1', '2', '3'] as const
    for (const level of levels) {
      const lightLayers = (ELEVATION.light[level] || '').split('), ').length
      const darkLayers = (ELEVATION.dark[level] || '').split('), ').length
      expect(darkLayers).toBeLessThan(lightLayers)
    }
  })
  it('radius exposes sm/md/lg/xl/full', () => {
    expect(RADIUS['full']).toBe('9999px')
  })
})
