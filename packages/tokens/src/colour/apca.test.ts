import { describe, expect, it } from 'vitest'
import { apcaLc } from './apca.js'

// Reference vectors from the apca-w3 package documentation (0.0.98G-4g)
describe('apcaLc', () => {
  it('#888 text on #fff bg ≈ 63.06', () => {
    expect(apcaLc('#888888', '#ffffff')).toBeCloseTo(63.06, 1)
  })
  it('#fff text on #888 bg ≈ -68.54', () => {
    expect(apcaLc('#ffffff', '#888888')).toBeCloseTo(-68.54, 1)
  })
  it('#000 text on #aaa bg ≈ 58.15', () => {
    expect(apcaLc('#000000', '#aaaaaa')).toBeCloseTo(58.15, 1)
  })
  it('#aaa text on #000 bg ≈ -56.24', () => {
    expect(apcaLc('#aaaaaa', '#000000')).toBeCloseTo(-56.24, 1)
  })
  it('identical colours → 0', () => {
    expect(apcaLc('#777777', '#777777')).toBe(0)
  })
})
