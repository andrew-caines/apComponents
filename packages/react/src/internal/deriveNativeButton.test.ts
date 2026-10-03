import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { Button } from '../components/Button/Button.js'
import { deriveNativeButton } from './deriveNativeButton.js'

describe('deriveNativeButton', () => {
  it('treats a render-absent Button as a native button', () => {
    // Perturbation: swapping this branch's return to `false` makes this
    // assertion fail (it would then also fail for the plain-Button case,
    // where render is never supplied).
    expect(deriveNativeButton(undefined)).toBe(true)
  })

  it('treats a render element whose type is the literal string "button" as native', () => {
    expect(deriveNativeButton(createElement('button'))).toBe(true)
  })

  it('treats a render element of any other tag as not native', () => {
    expect(deriveNativeButton(createElement('a', { href: '#' }))).toBe(false)
  })

  it('treats a render function as not native, since its output cannot be inspected before it runs', () => {
    expect(deriveNativeButton(() => createElement('span'))).toBe(false)
  })

  // Perturbation: removing the marker branch makes the first case fail.
  it('sees through our own Button element', () => {
    expect(deriveNativeButton(createElement(Button))).toBe(true)
    expect(deriveNativeButton(createElement(Button, { render: createElement('a', { href: '#' }) }))).toBe(false)
    expect(deriveNativeButton(createElement(Button, { nativeButton: false }))).toBe(false)
  })

  it('still treats an arbitrary composite as not native', () => {
    const Other = () => createElement('button')
    expect(deriveNativeButton(createElement(Other))).toBe(false)
  })
})
