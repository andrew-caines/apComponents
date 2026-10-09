// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePrevious } from './usePrevious.js'

let prev: number | null
function Probe({ value, tick }: { value: number; tick?: number }) {
  prev = usePrevious(value)
  return <span>{tick}</span>
}

describe('usePrevious', () => {
  it('is null on the first render', () => {
    render(<Probe value={1} />)
    expect(prev).toBeNull()
  })

  it('is the earlier value after a change, and stays so across an unrelated re-render', () => {
    const { rerender } = render(<Probe value={1} />)
    rerender(<Probe value={2} />)
    expect(prev).toBe(1)
    rerender(<Probe value={2} tick={1} />)
    expect(prev, 'previous DISTINCT value: an unrelated re-render must not overwrite it with 2').toBe(1)
  })
})
