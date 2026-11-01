// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, forwardRef, type ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Check, Info, defineIcon } from '../index.js'
import { Icon, type ForeignIconProps } from './index.js'

const plain = defineIcon({ name: 'plain', primary: ['M0 0L1 1'] })

function svgOf(el: ReactElement): SVGSVGElement {
  return render(el).container.querySelector('svg')!
}

function styleOf(svg: SVGSVGElement): CSSStyleDeclaration {
  return (svg as unknown as HTMLElement).style
}

describe('Icon (standalone)', () => {
  it('renders outline only by default: one <g>, stroke-width 1.5, stroke currentColor, no style.color', () => {
    const svg = svgOf(<Icon icon={Info} />)
    const groups = svg.querySelectorAll(':scope > g')
    expect(groups).toHaveLength(1)
    expect(groups[0]!.getAttribute('stroke-width')).toBe('1.5')
    expect(groups[0]!.getAttribute('stroke')).toBe('currentColor')
    expect(styleOf(svg).color).toBe('')
  })

  it('color sets style.color when duotone is not active', () => {
    expect(styleOf(svgOf(<Icon icon={Info} color="red" />)).color).toBe('red')
  })

  it('ignores duoTonePrimary and duoToneSecondary when duoTone is absent', () => {
    const svg = svgOf(<Icon icon={Info} duoTonePrimary="red" duoToneSecondary="blue" />)
    expect(svg.querySelectorAll(':scope > g')).toHaveLength(1)
    expect(styleOf(svg).color).toBe('')
  })

  it('ignores them when duoTone={false}', () => {
    const svg = svgOf(
      <Icon icon={Info} duoTone={false} duoTonePrimary="red" duoToneSecondary="blue" />,
    )
    expect(svg.querySelectorAll(':scope > g')).toHaveLength(1)
    expect(styleOf(svg).color).toBe('')
  })

  it('duoTone on a filled icon (Info) paints the secondary group first with fill-opacity 0.4, then the outline', () => {
    const svg = svgOf(<Icon icon={Info} duoTone />)
    const groups = svg.querySelectorAll(':scope > g')
    expect(groups).toHaveLength(2)
    expect(groups[0]!.getAttribute('fill')).toBe('currentColor')
    expect(groups[0]!.getAttribute('fill-opacity')).toBe('0.4')
    expect(groups[0]!.getAttribute('stroke')).toBe('none')
    expect(groups[1]!.getAttribute('stroke-width')).toBe('1.5')
  })

  it('duoTone on a halo icon (Check) paints primary paths at stroke-width 5, stroke-opacity 0.4, under the outline', () => {
    const svg = svgOf(<Icon icon={Check} duoTone />)
    const groups = svg.querySelectorAll(':scope > g')
    expect(groups).toHaveLength(2)
    expect(groups[0]!.getAttribute('stroke-width')).toBe('5')
    expect(groups[0]!.getAttribute('stroke-opacity')).toBe('0.4')
    expect(groups[0]!.getAttribute('fill')).toBe('none')
    expect(groups[0]!.querySelectorAll('path')).toHaveLength(Check.primary.length)
    expect(groups[1]!.getAttribute('stroke-width')).toBe('1.5')
  })

  it('duoTonePrimary wins over color for the outline when active', () => {
    const svg = svgOf(<Icon icon={Info} duoTone color="red" duoTonePrimary="green" />)
    expect(styleOf(svg).color).toBe('green')
  })

  it('color is the outline when active and duoTonePrimary is absent', () => {
    expect(styleOf(svgOf(<Icon icon={Info} duoTone color="red" />)).color).toBe('red')
  })

  it('duoToneSecondary is used as given, with no opacity attribute', () => {
    const filled = svgOf(<Icon icon={Info} duoTone duoToneSecondary="blue" />)
    const g = filled.querySelectorAll(':scope > g')[0]!
    expect(g.getAttribute('fill')).toBe('blue')
    expect(g.hasAttribute('fill-opacity')).toBe(false)
    const halo = svgOf(<Icon icon={Check} duoTone duoToneSecondary="blue" />)
    const h = halo.querySelectorAll(':scope > g')[0]!
    expect(h.getAttribute('stroke')).toBe('blue')
    expect(h.hasAttribute('stroke-opacity')).toBe(false)
  })

  it('duoTone on a definition with no secondary renders outline only and does not throw', () => {
    const svg = svgOf(<Icon icon={plain} duoTone duoTonePrimary="red" duoToneSecondary="blue" />)
    expect(svg.querySelectorAll(':scope > g')).toHaveLength(1)
    expect(styleOf(svg).color).toBe('')
  })

  it('a size number becomes px in style; a string passes through: size="var(--x)" gives style.width "var(--x)"', () => {
    const a = styleOf(svgOf(<Icon icon={Info} size={20} />))
    expect(a.width).toBe('20px')
    expect(a.height).toBe('20px')
    const b = styleOf(svgOf(<Icon icon={Info} size="var(--x)" />))
    expect(b.width).toBe('var(--x)')
    expect(b.height).toBe('var(--x)')
    expect(styleOf(svgOf(<Icon icon={Info} />)).width).toBe('1em')
  })

  it('no width/height attributes on the svg', () => {
    const svg = svgOf(<Icon icon={Info} size={20} />)
    expect(svg.hasAttribute('width')).toBe(false)
    expect(svg.hasAttribute('height')).toBe(false)
  })

  it('decorative by default: aria-hidden, focusable false, no role', () => {
    const svg = svgOf(<Icon icon={Info} />)
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
    expect(svg.hasAttribute('role')).toBe(false)
  })

  it('label gives role="img" and aria-label, and no aria-hidden', () => {
    const svg = svgOf(<Icon icon={Info} label="Information" />)
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Information')
    expect(svg.hasAttribute('aria-hidden')).toBe(false)
  })

  it('a function component receives className, style (with color) and aria props only', () => {
    let received: Record<string, unknown> = {}
    const Foreign = (props: ForeignIconProps) => {
      received = props as Record<string, unknown>
      return <svg />
    }
    render(<Icon icon={Foreign} className="c" size={16} color="red" />)
    expect(Object.keys(received).sort()).toEqual(
      ['aria-hidden', 'className', 'focusable', 'style'].sort(),
    )
    expect(received['className']).toBe('c')
    expect(received['style']).toEqual({ width: '16px', height: '16px', color: 'red' })
  })

  it('a forwardRef component is rendered as foreign, not mistaken for a definition', () => {
    const Fwd = forwardRef<SVGSVGElement, ForeignIconProps>((props, ref) => (
      <svg ref={ref} data-testid="fwd" {...(props as object)} />
    ))
    const { container } = render(<Icon icon={Fwd} label="L" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('data-testid')).toBe('fwd')
    expect(svg.getAttribute('aria-label')).toBe('L')
  })

  it('duoTone and duoToneSecondary on a foreign component render it and are not passed to it as props', () => {
    let received: Record<string, unknown> = {}
    const Foreign = (props: ForeignIconProps) => {
      received = props as Record<string, unknown>
      return <svg />
    }
    const { container } = render(
      <Icon icon={Foreign} duoTone duoTonePrimary="red" duoToneSecondary="blue" />,
    )
    expect(container.querySelector('svg')).not.toBeNull()
    for (const k of ['duoTone', 'duoTonePrimary', 'duoToneSecondary', 'color', 'size', 'icon']) {
      expect(k in received).toBe(false)
    }
  })

  it('renders under renderToString (react-dom/server) with no error', () => {
    const html = renderToString(createElement(Icon, { icon: Check, duoTone: true }))
    expect(html).toContain('<svg')
  })

  it("Icon.tsx does not start with 'use client' and imports no React hook", () => {
    const src = readFileSync(join(import.meta.dirname, 'Icon.tsx'), 'utf8')
    expect(src).not.toMatch(/use client/)
    expect(src).not.toMatch(/\buse[A-Z]\w*\(/)
  })

  it('throws a clear error for an unbranded plain object or a spread copy of a built-in', () => {
    const msg =
      'Icon: "icon" must be a defineIcon() result or a component; wrap plain icon data in defineIcon()'
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<Icon icon={{ name: 'x', primary: ['M0 0'] } as never} />)).toThrow(msg)
      expect(() => render(<Icon icon={{ ...Check } as never} />)).toThrow(msg)
    } finally {
      quiet.mockRestore()
    }
  })

  it('duoToneSecondary="" behaves like absent: currentColor at 0.4', () => {
    const filled = svgOf(<Icon icon={Info} duoTone duoToneSecondary="" />)
    const fg = filled.querySelector(':scope > g')!
    expect(fg.getAttribute('fill')).toBe('currentColor')
    expect(fg.getAttribute('fill-opacity')).toBe('0.4')
    const halo = svgOf(<Icon icon={Check} duoTone duoToneSecondary="" />)
    const hg = halo.querySelector(':scope > g')!
    expect(hg.getAttribute('stroke')).toBe('currentColor')
    expect(hg.getAttribute('stroke-opacity')).toBe('0.4')
  })
})
