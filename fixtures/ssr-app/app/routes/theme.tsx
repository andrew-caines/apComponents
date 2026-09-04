import { Surface, ThemeProvider, generateTheme } from '@ap/react'

/**
 * ADR-0009's runtime theming path, proved end to end.
 *
 * The themes are generated in the module rather than in a loader only because
 * this fixture has no tenant store. The shape is the real one: a palette that is
 * not knowable at build time, turned into tokens and rendered into the server
 * response — which is what makes it paint correctly on first paint, with nothing
 * to reconcile after hydration.
 *
 * Three regions, deliberately:
 *
 * - `#outside` sits before any provider and must keep the build-time tokens.
 *   Without it, a test asserting the tenant colour inside the scope would pass
 *   just as well if the override had leaked to the whole document.
 * - `#tenant` is inside the outer provider.
 * - `#nested` is inside a second provider with a different palette, which is the
 *   claim that scoping composes through the cascade rather than fighting itself.
 */
const TENANT = generateTheme({ brand: '#c2185b' })
const NESTED = generateTheme({ brand: '#00897b' })

export default function ThemeRoute() {
  return (
    <main>
      <h1>theme</h1>

      <Surface tone="raised" pad="md" id="outside">
        outside every provider
      </Surface>

      <ThemeProvider theme={TENANT}>
        <Surface tone="raised" pad="md" id="tenant">
          tenant theme
        </Surface>

        <ThemeProvider theme={NESTED}>
          <Surface tone="raised" pad="md" id="nested">
            nested theme
          </Surface>
        </ThemeProvider>
      </ThemeProvider>
    </main>
  )
}
