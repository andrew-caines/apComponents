import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { generateTheme, toCssText } from '@ap/tokens'
import { SEED_DEBOUNCE_MS, ThemeGenerator } from './ThemeGenerator.js'

const meta = {
  // Not 'Foundations/Theme generator/Stories': the MDX page owns
  // 'Foundations/Theme generator', and a docs leaf cannot also be a story group.
  title: 'Foundations/Theme generator stories',
  component: ThemeGenerator,
  args: { syncUrl: false },
} satisfies Meta<typeof ThemeGenerator>
export default meta
type Story = StoryObj<typeof meta>

const snippet = (root: HTMLElement) => within(root).getByTestId('snippet')

/** Perturbation: build the snippet from DEFAULT_BRAND instead of state, and Pink fails. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(snippet(canvasElement)).toHaveTextContent("brand: '#2e5fd9'")
    // Perturbation: count the failing rows of one mode only, and the summary disagrees with the table.
    const all = within(canvasElement).getByText(/^All \d+ pairings$/).closest('details')!
    await expect(all.open).toBe(false)
    const rows = [...all.querySelectorAll('tbody tr')]
    const fails = rows.filter((r) => r.getAttribute('data-pass') === 'false').length
    await expect(within(canvasElement).getByTestId('contrast-summary')).toHaveTextContent(
      `${rows.length} pairings, ${fails ? `${fails} fail` : 'all pass'}.`,
    )
  },
}

/** Perturbation: render Preview's children without ThemeProvider, and the backgrounds match. */
export const Pink: Story = {
  args: { initialBrand: '#c2185b' },
  play: async ({ canvasElement }) => {
    await expect(snippet(canvasElement)).toHaveTextContent("brand: '#c2185b'")
    const btn = within(within(canvasElement).getByTestId('preview')).getAllByRole('button', { name: 'Primary' })[0]!
    const expected = generateTheme({ brand: '#c2185b' }).ramps.light.brand.steps[8]!.hex
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(expected.slice(i, i + 2), 16))
    await expect(getComputedStyle(btn).backgroundColor).toBe(`rgb(${r}, ${g}, ${b})`)
  },
}

/** Perturbation: pass the draft hex to generateTheme unvalidated, and this throws or blanks. */
export const InvalidHex: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement)
    const hex = c.getByLabelText('Brand colour (hex)')
    await userEvent.clear(hex)
    await userEvent.type(hex, '#zz')
    await expect(await c.findByText('Use #rgb or #rrggbb')).toBeVisible()
    // Well past the debounce, so an invalid value that leaked into the theme
    // would have reached generateTheme by now. Nothing changes on screen when
    // the component is right, so there is no event to wait for instead.
    await new Promise((r) => setTimeout(r, SEED_DEBOUNCE_MS * 3))
    await expect(snippet(canvasElement)).toHaveTextContent("brand: '#2e5fd9'")
  },
}

/** Perturbation: build the Blob from a theme memoised once on mount, and the text differs after the edit. */
export const Download: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement)
    const hex = c.getByLabelText('Brand colour (hex)')
    await userEvent.clear(hex)
    await userEvent.type(hex, '#00897b')
    await waitFor(() => expect(snippet(canvasElement)).toHaveTextContent("brand: '#00897b'"))
    const link = c.getByRole('link', { name: 'Download theme.css' }) as HTMLAnchorElement
    await expect(link).toHaveAttribute('download', 'theme.css')
    // The Blob URL is replaced in an effect one commit after the snippet, and the
    // old URL is revoked, so a fetch of a stale href throws. waitFor retries until
    // the link serves the theme for the brand the snippet shows.
    const expected = toCssText(generateTheme({ brand: '#00897b' }))
    await waitFor(async () => expect(await (await fetch(link.href)).text()).toBe(expected))
  },
}

/** Review focus 4. Perturbation: drop useDebouncedValue, and the theme regenerates per event (the counter exceeds 2). */
export const PickerDebounce: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement)
    const picker = c.getByLabelText('Brand colour (picker)') as HTMLInputElement
    const before = Number(c.getByTestId('generations').dataset.count)
    // A drag, as the browser reports it: one `input` event per value. The value
    // goes through the prototype's setter, as the browser's own does; assigning
    // `picker.value` directly also updates React's value tracker, and React
    // then sees no change and drops the event.
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    for (const v of ['#111111', '#222222', '#333333', '#444444', '#c2185b']) {
      setValue.call(picker, v)
      picker.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await waitFor(() => expect(snippet(canvasElement)).toHaveTextContent("brand: '#c2185b'"))
    await expect(Number(c.getByTestId('generations').dataset.count) - before).toBeLessThanOrEqual(2)
  },
}
