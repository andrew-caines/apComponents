import { describe, expect, it } from 'vitest'
import { extractRegion, regionNames } from './extractRegion.js'

const SRC = [
  "import x from 'y'",
  '  // #region docs:alpha',
  '  const a = 1',
  '',
  '    nested()',
  '  // #endregion docs:alpha',
  '<div>',
  '  {/* #region docs:beta */}',
  '  <Button />',
  '  {/* #endregion docs:beta */}',
  '</div>',
].join('\n')

describe('extractRegion', () => {
  it('returns the lines between the markers with common indentation removed', () => {
    expect(extractRegion(SRC, 'alpha')).toBe('const a = 1\n\n  nested()')
  })
  it('reads the JSX comment form', () => {
    expect(extractRegion(SRC, 'beta')).toBe('<Button />')
  })
  it('handles CRLF input', () => {
    expect(extractRegion(SRC.replace(/\n/g, '\r\n'), 'beta')).toBe('<Button />')
  })
  it('throws when the region is missing', () => {
    expect(() => extractRegion(SRC, 'gamma')).toThrow(/no region "docs:gamma"/)
  })
  it('does not match a region whose name merely starts with the one asked for', () => {
    // Perturbation: drop the end anchor from the marker pattern, and "alph" matches "alpha".
    expect(() => extractRegion(SRC, 'alph')).toThrow(/no region/)
  })
  it('throws when the region appears twice', () => {
    expect(() => extractRegion(`${SRC}\n// #region docs:alpha\n// #endregion docs:alpha`, 'alpha')).toThrow(
      /appears 2 times/,
    )
  })
  it('throws when the region is not closed', () => {
    expect(() => extractRegion('// #region docs:open\nx', 'open')).toThrow(/not closed/)
  })
  it('throws on an empty region, so a guide never renders a blank block', () => {
    expect(() => extractRegion('// #region docs:e\n// #endregion docs:e', 'e')).toThrow(/is empty/)
  })
})

describe('regionNames', () => {
  it('lists every opened region once, in order', () => {
    expect(regionNames(SRC)).toEqual(['alpha', 'beta'])
  })
})
