'use client'

import { forwardRef, type HTMLAttributes } from 'react'
import { surfaceRecipe } from './Surface.css.js'

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** Background role. Defaults to `surface`. */
  tone?: 'canvas' | 'surface' | 'raised'
  /** Internal spacing. Defaults to `md`. */
  pad?: 'none' | 'sm' | 'md' | 'lg'
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { tone = 'surface', pad = 'md', className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={[surfaceRecipe({ tone, pad }), className].filter(Boolean).join(' ')}
      data-ap-tone={tone}
      data-ap-pad={pad}
      {...rest}
    >
      {children}
    </div>
  )
})
