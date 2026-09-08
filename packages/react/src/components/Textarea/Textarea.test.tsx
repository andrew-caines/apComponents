// @vitest-environment jsdom
import { createRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Field } from '../Field/Field.js'
import { Textarea } from './Textarea.js'
import { textareaRecipe } from './Textarea.css.js'

describe('Textarea', () => {
  it('renders a real textarea, not an input', () => {
    render(<Textarea aria-label="Notes" />)
    const el = screen.getByRole('textbox', { name: 'Notes' })
    expect(el.tagName).toBe('TEXTAREA')
  })

  it('applies the recipe class for its size and resize', () => {
    render(<Textarea aria-label="Notes" size="lg" resize="none" />)
    expect(screen.getByRole('textbox').className).toBe(
      textareaRecipe({ size: 'lg', resize: 'none' }),
    )
  })

  it('forwards rows to the element, which Field.Control does not type', () => {
    render(<Textarea aria-label="Notes" rows={7} />)
    // `.getAttribute`, not a jest-dom matcher — this repo does not install one
    // (see the same note in Input.test.tsx).
    expect(screen.getByRole('textbox').getAttribute('rows')).toBe('7')
  })

  it('takes its label and description from Field without hand-passed ids', () => {
    render(
      <Field label="Notes" hint="Markdown is supported.">
        <Textarea />
      </Field>,
    )
    const el = screen.getByRole('textbox', { name: 'Notes' })
    const ids = el.getAttribute('aria-describedby')!.split(' ').filter(Boolean)
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toContain(
      'Markdown is supported.',
    )
  })

  it('submits its value uncontrolled', () => {
    const seen = vi.fn()
    const { container } = render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen(new FormData(e.currentTarget).get('notes'))
        }}
      >
        <Textarea name="notes" defaultValue="hello" aria-label="Notes" />
      </form>,
    )
    fireEvent.submit(container.querySelector('form')!)
    expect(seen).toHaveBeenCalledWith('hello')
  })

  /**
   * `Textarea.tsx` forwards its ref through `ref as Ref<HTMLInputElement>` —
   * a hand-written cast under a public `forwardRef<HTMLTextAreaElement, …>`,
   * because `FieldControl`'s ref is typed for the `<input>` it usually
   * renders and a mutable ref is invariant in its element type.
   *
   * A cast asserts something TypeScript cannot check, so the only thing that
   * can catch it being wrong is a ref that receives a real node and reports
   * its `tagName`. Asserting the TAG, not just non-nullness: a bare
   * `not.toBeNull()` would pass for a ref pointed at the wrong element
   * entirely, which is precisely what a cast can cause. Same shape as
   * Input.test.tsx:48-51, FieldParts.test.tsx:198-256 and
   * RadioGroupParts.test.tsx's ref-forwarding block.
   */
  it('forwards its ref to the real textarea element, across the cast', () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(<Textarea aria-label="Notes" ref={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('TEXTAREA')
    // And it is the element a form reads, not a wrapper: the value round-trips
    // through the node the ref points at.
    ref.current!.value = 'typed'
    expect(screen.getByRole('textbox')).toBe(ref.current)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('typed')
  })

  it('merges a consumer className rather than replacing the recipe', () => {
    render(<Textarea aria-label="Notes" className="mine" />)
    const cls = screen.getByRole('textbox').className
    expect(cls).toContain('mine')
    expect(cls).toContain(textareaRecipe({ size: 'md', resize: 'vertical' }).split(' ')[0])
  })
})
