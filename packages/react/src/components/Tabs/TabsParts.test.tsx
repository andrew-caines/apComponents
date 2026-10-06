// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '../Button/Button.js'
import {
  tabRecipe,
  tabsIndicatorRecipe,
  tabsListRecipe,
  tabsPanelClass,
  tabsRootRecipe,
} from './Tabs.css.js'
import {
  TabsIndicator,
  TabsList,
  TabsPanel,
  TabsRoot,
  type TabsRootProps,
  TabsTab,
} from './TabsParts.js'

afterEach(cleanup)

function assembly(rootProps: Partial<TabsRootProps> = {}, panelProps: { keepMounted?: boolean } = {}) {
  return (
    <TabsRoot defaultValue="a" {...rootProps}>
      <TabsList aria-label="Sections">
        <TabsIndicator />
        <TabsTab value="a">Alpha</TabsTab>
        <TabsTab value="b">Beta</TabsTab>
        <TabsTab value="c">Gamma</TabsTab>
      </TabsList>
      <TabsPanel value="a" {...panelProps}>
        Alpha content
      </TabsPanel>
      <TabsPanel value="b" {...panelProps}>
        Beta content
      </TabsPanel>
      <TabsPanel value="c" {...panelProps}>
        Gamma content
      </TabsPanel>
    </TabsRoot>
  )
}

const classes = (el: Element): string[] => (el.getAttribute('class') ?? '').split(' ')

describe('Tabs parts', () => {
  // Regression guard: none of our code sets these. It pins Base UI's wiring
  // of roles, aria-selected and the panel's label, which we rely on.
  it('wires tablist, tab and tabpanel roles, and labels the panel by its tab', () => {
    render(assembly())
    expect(screen.getByRole('tablist').getAttribute('aria-label')).toBe('Sections')
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    const alpha = screen.getByRole('tab', { name: 'Alpha' })
    expect(alpha.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('false')
    const panel = screen.getByRole('tabpanel')
    expect(panel.textContent).toBe('Alpha content')
    expect(panel.getAttribute('aria-labelledby')).toBe(alpha.id)
  })

  // Fails if `activateOnFocus` is passed to the list: selection would then
  // follow focus to Beta on ArrowRight.
  it('moves focus on ArrowRight without selecting, and activating it selects', async () => {
    render(assembly())
    const alpha = screen.getByRole('tab', { name: 'Alpha' })
    const beta = screen.getByRole('tab', { name: 'Beta' })
    alpha.focus()
    fireEvent.keyDown(alpha, { key: 'ArrowRight' })
    await waitFor(() => expect(document.activeElement).toBe(beta))
    expect(alpha.getAttribute('aria-selected')).toBe('true')
    expect(beta.getAttribute('aria-selected')).toBe('false')
    // Activation is a click here. jsdom does not turn Enter on a native
    // button into a click, so real Enter is pinned by a browser story.
    fireEvent.click(beta)
    await waitFor(() => expect(beta.getAttribute('aria-selected')).toBe('true'))
    expect(screen.getByRole('tabpanel').textContent).toBe('Beta content')
  })

  // Regression guard on Base UI's list reading orientation from the root
  // (`tabs/list/TabsList.js:33-37,83`). Fails if TabsRoot does not forward
  // `orientation` to Base UI's Tabs.Root.
  it('sets aria-orientation from the root, and ArrowDown moves focus', async () => {
    render(assembly({ orientation: 'vertical' }))
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical')
    const alpha = screen.getByRole('tab', { name: 'Alpha' })
    alpha.focus()
    fireEvent.keyDown(alpha, { key: 'ArrowDown' })
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Beta' })),
    )
  })

  // Fails if the parts ignore `variant` from context: the pills combination
  // would then carry the underline classes.
  it('gives the list, tab and indicator the recipe classes for variant and orientation', () => {
    const combos = [
      { variant: 'underline', orientation: 'horizontal' },
      { variant: 'pills', orientation: 'vertical' },
    ] as const
    const seen: string[] = []
    for (const combo of combos) {
      const { container } = render(assembly(combo))
      const list = screen.getByRole('tablist')
      const tab = screen.getByRole('tab', { name: 'Alpha' })
      const indicator = container.querySelector('[role="presentation"]')
      expect(classes(list)).toEqual(expect.arrayContaining(tabsListRecipe(combo).split(' ')))
      expect(classes(tab)).toEqual(expect.arrayContaining(tabRecipe(combo).split(' ')))
      expect(indicator).not.toBeNull()
      expect(classes(indicator as Element)).toEqual(
        expect.arrayContaining(tabsIndicatorRecipe(combo).split(' ')),
      )
      seen.push(list.getAttribute('class') ?? '', tab.getAttribute('class') ?? '')
      cleanup()
    }
    // Differential: the two combinations really emit different classes.
    expect(seen[0]).not.toBe(seen[2])
    expect(seen[1]).not.toBe(seen[3])
  })

  // Fails if Button loses its `[NATIVE_BUTTON_DERIVABLE]` marker: the derived
  // `nativeButton` becomes false, so Base UI drops `type` and logs an error.
  it('renders a Button tab as a native button with role="tab", and logs nothing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <TabsRoot defaultValue="a">
          <TabsList>
            <TabsTab value="a" render={<Button variant="ghost" />}>
              Alpha
            </TabsTab>
          </TabsList>
        </TabsRoot>,
      )
      const tab = screen.getByRole('tab', { name: 'Alpha' })
      expect(tab.tagName).toBe('BUTTON')
      expect(tab.getAttribute('type')).toBe('button')
      expect(tab.getAttribute('role')).toBe('tab')
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  // Fails if the `nativeButton` derivation is dropped: Base UI's default
  // `true` would then put `type="button"` on a span.
  it('does not tell Base UI a span tab is a native button', () => {
    render(
      <TabsRoot defaultValue="a">
        <TabsList>
          <TabsTab value="a" render={<span />}>
            Alpha
          </TabsTab>
        </TabsList>
      </TabsRoot>,
    )
    const tab = screen.getByRole('tab', { name: 'Alpha' })
    expect(tab.tagName).toBe('SPAN')
    expect(tab.hasAttribute('type')).toBe(false)
  })

  // Pins Base UI's default (`tabs/panel/TabsPanel.js:36,100`). The first half
  // fails if TabsPanel sets `keepMounted` itself; the second if it drops the
  // consumer's `keepMounted`.
  it('unmounts an inactive panel, and keepMounted keeps it hidden', () => {
    render(assembly())
    expect(screen.queryByText('Beta content')).toBeNull()
    cleanup()
    render(assembly({}, { keepMounted: true }))
    const beta = screen.getByText('Beta content')
    expect(beta.hasAttribute('hidden')).toBe(true)
    expect(screen.getByText('Alpha content').hasAttribute('hidden')).toBe(false)
  })

  // Fails if className replaces a recipe class instead of joining it.
  it('merges className on every styled part', () => {
    const { container } = render(
      <TabsRoot defaultValue="a" className="x-root">
        <TabsList className="x-list">
          <TabsIndicator className="x-indicator" />
          <TabsTab value="a" className="x-tab">
            Alpha
          </TabsTab>
        </TabsList>
        <TabsPanel value="a" className="x-panel">
          Alpha content
        </TabsPanel>
      </TabsRoot>,
    )
    const root = container.firstElementChild as Element
    expect(classes(root)).toEqual(
      expect.arrayContaining([...tabsRootRecipe({}).split(' '), 'x-root']),
    )
    expect(classes(screen.getByRole('tablist'))).toEqual(
      expect.arrayContaining([...tabsListRecipe({}).split(' '), 'x-list']),
    )
    expect(classes(screen.getByRole('tab'))).toEqual(
      expect.arrayContaining([...tabRecipe({}).split(' '), 'x-tab']),
    )
    const indicator = container.querySelector('[role="presentation"]') as Element
    expect(classes(indicator)).toEqual(
      expect.arrayContaining([...tabsIndicatorRecipe({}).split(' '), 'x-indicator']),
    )
    expect(classes(screen.getByRole('tabpanel'))).toEqual(
      expect.arrayContaining([tabsPanelClass, 'x-panel']),
    )
  })
})
