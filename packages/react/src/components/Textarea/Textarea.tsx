'use client'
import { forwardRef } from 'react'
import type { Ref, TextareaHTMLAttributes } from 'react'
import { FieldControl } from '../Field/FieldParts.js'
import type { FieldControlProps } from '../Field/FieldParts.js'
import { textareaRecipe } from './Textarea.css.js'
import { TEXTAREA_TOKENS } from './Textarea.tokens.js'

export { TEXTAREA_TOKENS }

/**
 * Base UI has no Textarea, so this is `Field.Control` rendering a native
 * <textarea>. That works at runtime — Base UI's control reads
 * `event.currentTarget.value` and its Enter-to-commit path is gated on the
 * tag being an INPUT, so Enter inserts a newline here as it should, and blur
 * is the only validation commit path.
 *
 * The type surface is the part that needs work: FieldControlProps is typed for
 * 'input', so `rows`, `cols` and `wrap` are invisible. The supported ones are
 * re-declared below and pushed onto the render element.
 */
type TextareaOnlyProps = Pick<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows' | 'cols' | 'wrap'>

export interface TextareaProps
  extends Omit<FieldControlProps, 'className' | 'render' | 'type' | 'size'>,
    TextareaOnlyProps {
  /** Control text size. Not the legacy character-count attribute. */
  size?: 'sm' | 'md' | 'lg'
  /**
   * `vertical` by default. Horizontal resizing is not offered: it breaks the
   * form's column grid, and `both` is the browser default we are overriding.
   * Auto-growing is deliberately out of scope for v1 — it needs measurement
   * on every keystroke.
   */
  resize?: 'none' | 'vertical'
  className?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = 'md', resize = 'vertical', rows, cols, wrap, className, ...rest },
  ref,
) {
  return (
    <FieldControl
      {...rest}
      // FieldControl's ref is `Ref<HTMLInputElement>` (see FieldParts.tsx) even
      // though this instance renders a real `<textarea>` — a mutable ref is
      // invariant in its element type, so the wider `HTMLTextAreaElement` ref
      // this component forwards is not assignable without a cast. Same
      // reasoning as the ref notes in FieldParts.tsx and Input.tsx.
      ref={ref as Ref<HTMLInputElement>}
      className={[textareaRecipe({ size, resize }), className].filter(Boolean).join(' ')}
      render={
        <textarea
          {...(rows !== undefined ? { rows } : {})}
          {...(cols !== undefined ? { cols } : {})}
          {...(wrap !== undefined ? { wrap } : {})}
        />
      }
    />
  )
})
