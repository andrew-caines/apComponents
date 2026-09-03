// @vitest-environment jsdom
import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Input } from './Input.js'
import { inputRecipe } from './Input.css.js'
import { INPUT_ICON_COLORS } from './Input.tokens.js'

describe('Input', () => {
  it('renders a real <input>', () => {
    render(<Input aria-label="Email" />)
    const el = screen.getByRole('textbox', { name: 'Email' })
    expect(el.tagName).toBe('INPUT')
  })

  // Tied to the recipe's own output for the default size rather than a bare
  // "className is non-empty" check: a non-empty check passes for a class from
  // the wrong variant, so it could not catch a default being changed.
  it('applies the recipe class for the default size', () => {
    render(<Input aria-label="Email" />)
    expect(screen.getByRole('textbox').className).toBe(inputRecipe({ size: 'md' }))
  })

  it('merges className rather than replacing it', () => {
    render(<Input aria-label="Email" className="mine" />)
    const cls = screen.getByRole('textbox').className
    expect(cls).toContain('mine')
    expect(cls.trim().split(/\s+/).length).toBeGreaterThan(1)
  })

  it('gives different sizes different classes', () => {
    const { rerender } = render(<Input aria-label="Email" size="sm" />)
    const sm = screen.getByRole('textbox').className
    rerender(<Input aria-label="Email" size="lg" />)
    expect(screen.getByRole('textbox').className).not.toBe(sm)
  })

  // `size` on our API is a recipe variant, not the legacy HTML width-in-
  // characters attribute. Assert the attribute is NOT emitted: leaking
  // size="sm" onto the element would be invalid HTML and would silently
  // change the field's intrinsic width.
  it('does not leak the size variant onto the DOM as an attribute', () => {
    render(<Input aria-label="Email" size="lg" />)
    expect(screen.getByRole('textbox').hasAttribute('size')).toBe(false)
  })

  it('forwards a ref to the input element', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input aria-label="Email" ref={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('INPUT')
  })

  it('spreads id, data-* and aria-* through to the element', () => {
    render(<Input aria-label="Email" id="email" data-testid="email-input" aria-describedby="hint" />)
    const el = screen.getByTestId('email-input')
    expect(el.id).toBe('email')
    expect(el.getAttribute('aria-describedby')).toBe('hint')
  })

  // The uncontrolled path is the one ADR-0011 §4 exists for: the value must
  // live in the DOM, so a native form submit carries it with no React state.
  it('submits its value from a native form with no React state (uncontrolled)', () => {
    const seen = vi.fn()
    const { container } = render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen(new FormData(e.currentTarget).get('email'))
        }}
      >
        <Input aria-label="Email" name="email" defaultValue="a@b.c" />
        <button type="submit">Go</button>
      </form>,
    )
    // The value is read out of the DOM by FormData, not out of React state —
    // which is the whole claim: a browser submitting this form before any
    // JavaScript has hydrated carries the same value (ADR-0011 §4).
    fireEvent.submit(container.querySelector('form')!)
    expect(seen).toHaveBeenCalledWith('a@b.c')
  })

  it('reports changes through onValueChange when controlled', () => {
    const onValueChange = vi.fn()
    render(<Input aria-label="Email" value="" onValueChange={onValueChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } })
    expect(onValueChange).toHaveBeenCalled()
    expect(onValueChange.mock.calls[0]?.[0]).toBe('x')
  })
})

describe('Input adornments', () => {
  it('renders a decorative start icon, hidden from assistive technology', () => {
    const { container } = render(
      <Input aria-label="Amount" startIcon={{ icon: <span data-testid="euro">€</span> }} />,
    )
    const icon = screen.getByTestId('euro')
    expect(icon.parentElement?.getAttribute('aria-hidden')).toBe('true')
    // Decorative means decorative: no button, nothing focusable.
    expect(container.querySelector('button')).toBeNull()
  })

  it('renders an actionable end icon as a real button with its accessible name', () => {
    const onClick = vi.fn()
    render(
      <Input
        aria-label="Amount"
        endIcon={{ icon: <span>x</span>, onClick, label: 'Clear amount' }}
      />,
    )
    const button = screen.getByRole('button', { name: 'Clear amount' })
    // `type="button"`, or it submits the form it happens to be sitting in.
    expect(button.getAttribute('type')).toBe('button')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not submit the form it sits in when the adornment is clicked', () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    const onClick = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <Input aria-label="Amount" endIcon={{ icon: <span>x</span>, onClick, label: 'Clear' }} />
      </form>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables the adornment button when the input is disabled', () => {
    render(
      <Input
        aria-label="Amount"
        disabled
        endIcon={{ icon: <span>x</span>, onClick: () => {}, label: 'Clear' }}
      />,
    )
    // `.disabled`, not a jest-dom matcher — this repo does not install one.
    expect((screen.getByRole('button', { name: 'Clear' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('reserves padding on the adorned side, and only that side', () => {
    // jsdom does not apply the vanilla-extract stylesheet, so the assertion is
    // on the class the recipe produces rather than on computed padding — the
    // computed value is asserted in a browser by gen:input-demo's check 7.
    const plain = inputRecipe({ size: 'md', adornStart: false, adornEnd: false })
    expect(inputRecipe({ size: 'md', adornStart: true, adornEnd: false })).not.toBe(plain)
    expect(inputRecipe({ size: 'md', adornStart: false, adornEnd: true })).not.toBe(plain)
    expect(inputRecipe({ size: 'md', adornStart: true, adornEnd: false })).not.toBe(
      inputRecipe({ size: 'md', adornStart: false, adornEnd: true }),
    )
  })

  it('applies the adorned classes to the real input, driven by the props', () => {
    render(<Input aria-label="Amount" startIcon={{ icon: <span>€</span> }} />)
    expect(screen.getByRole('textbox').className).toBe(
      inputRecipe({ size: 'md', adornStart: true, adornEnd: false }),
    )
  })

  it('still forwards the ref to the input, not the wrapper, when adorned', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input aria-label="Amount" ref={ref} startIcon={{ icon: <span>€</span> }} />)
    expect(ref.current?.tagName).toBe('INPUT')
  })

  // The wrapper exists only when it has something to hold. Without this, the
  // "adding adornments changed no existing markup" claim is just a comment.
  it('renders no wrapper at all when there is no adornment', () => {
    const { container } = render(<Input aria-label="Amount" />)
    expect(container.firstElementChild?.tagName).toBe('INPUT')
    expect(container.querySelectorAll('span')).toHaveLength(0)
  })

  it('wraps only when adorned', () => {
    const { container } = render(<Input aria-label="Amount" endIcon={{ icon: <span>x</span> }} />)
    expect(container.firstElementChild?.tagName).toBe('SPAN')
    expect(container.querySelector('input')).not.toBeNull()
  })

  // A compile-time test, and the only kind that can prove this rule. If the
  // union is ever flattened into a plain object, `onClick` without `label`
  // starts compiling, `@ts-expect-error` becomes an unused suppression, and
  // `npm run typecheck` fails on THIS line — which is exactly the alarm we
  // want, because the runtime consequence is a button no screen-reader user
  // can identify.
  it('rejects an onClick with no accessible name, at compile time', () => {
    render(
      <Input
        aria-label="Amount"
        // @ts-expect-error `label` is required whenever `onClick` is supplied
        endIcon={{ icon: <span>x</span>, onClick: () => {} }}
      />,
    )
    // The adornment still renders; the point of this test is the type error
    // above, which `npm run typecheck` enforces.
    expect(screen.getByRole('textbox')).not.toBeNull()
  })
})

describe('Input adornment colour', () => {
  it('leaves the icon on the default token when no colour is given', () => {
    render(<Input aria-label="Amount" startIcon={{ icon: <span data-testid="i">€</span> }} />)
    // No inline override at all — the slot's own `--ap-input-icon` fallback
    // (secondary text) applies. Asserting "no style" rather than "some style"
    // is what keeps the default a real default instead of a duplicated value.
    expect(screen.getByTestId('i').parentElement?.getAttribute('style')).toBeNull()
  })

  it('sets the icon colour from a semantic role', () => {
    render(
      <Input
        aria-label="Amount"
        startIcon={{ icon: <span data-testid="i">€</span>, color: 'danger' }}
      />,
    )
    const style = screen.getByTestId('i').parentElement!.getAttribute('style') ?? ''
    expect(style).toContain(INPUT_ICON_COLORS.danger)
  })

  // A deliberately coloured icon keeps its hue under the cursor; only the chip
  // behind it changes. Without this the hover rule would repaint a red icon in
  // the neutral hover colour.
  it('pins the hover colour to the same role', () => {
    render(
      <Input
        aria-label="Amount"
        endIcon={{ icon: <span>x</span>, color: 'success', onClick: () => {}, label: 'Apply' }}
      />,
    )
    const style = screen.getByRole('button', { name: 'Apply' }).getAttribute('style') ?? ''
    expect(style).toContain('--ap-input-icon:')
    expect(style).toContain('--ap-input-icon-hover:')
    expect(style.match(/--ap-input-icon(-hover)?:\s*[^;]+/g)).toHaveLength(2)
  })

  it('every colour role resolves to a real Tier 2 token reference', () => {
    for (const [role, value] of Object.entries(INPUT_ICON_COLORS)) {
      expect(value, `${role} is not a var() reference`).toMatch(/^var\(--ap-color-/)
    }
  })

  it('paints the button chip inside the control, not across its full height', () => {
    // The hit area is the full-height button; the painted surface is the inner
    // chip. Asserting they are different elements is what stops the background
    // going back to running edge-to-edge into the input's border.
    render(
      <Input
        aria-label="Amount"
        endIcon={{ icon: <span data-testid="glyph">x</span>, onClick: () => {}, label: 'Clear' }}
      />,
    )
    const button = screen.getByRole('button', { name: 'Clear' })
    const glyph = screen.getByTestId('glyph')
    expect(glyph.parentElement).not.toBe(button)
    expect(glyph.parentElement?.parentElement).toBe(button)
  })
})
