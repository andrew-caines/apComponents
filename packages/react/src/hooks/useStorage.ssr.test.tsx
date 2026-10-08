// Deliberately no environment docblock: this runs in the node environment so
// the server pass really has no window and no storage.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useLocalStorage, useSessionStorage } from './useStorage.js'

function Local() {
  const [v] = useLocalStorage('k', 'fallback-local')
  return <span>{v}</span>
}

function Session() {
  const [v] = useSessionStorage('k', 'fallback-session')
  return <span>{v}</span>
}

describe('useLocalStorage and useSessionStorage (server)', () => {
  it('render the default without throwing', () => {
    expect(typeof window).toBe('undefined')
    expect(renderToString(<Local />)).toContain('fallback-local')
    expect(renderToString(<Session />)).toContain('fallback-session')
  })
})
