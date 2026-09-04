import { Button, Surface, ThemeProvider, generateTheme, useTheme, vars } from '@ap/react'
import { Page } from '../Page.js'

// Generated once at module scope, not per render: `generateTheme` is real
// computation over a colour space, and regenerating an identical theme on every
// render would be pure waste. A product doing this per tenant does the same —
// generate when the tenant is known, not in the render path.
const PINK = generateTheme({ brand: '#c2185b' })
const TEAL = generateTheme({ brand: '#00897b' })

/** A small spread of real components, so a theme change is visible rather than described. */
function Sample({ name }: { name: string }) {
  return (
    <Surface tone="raised" pad="md">
      <div className="row">
        <Button>{name}</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <span
          className="mono"
          style={{ color: vars.color.actionText }}
        >
          action text
        </span>
      </div>
    </Surface>
  )
}

function CurrentScheme() {
  const { scheme } = useTheme()
  return (
    <p className="blurb">
      The switch in the nav is <code className="mono">useTheme()</code>. It currently reads{' '}
      <strong>{scheme}</strong>.
    </p>
  )
}

export default function Theming() {
  return (
    <Page slug="theming">
      <h2>Two delivery paths</h2>
      <p className="blurb">
        Theming is a build-time concern by default, with a runtime path you opt into. The split
        exists because generating a theme in the browser costs JavaScript before anything can paint,
        and under SSR the server would have to guess.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ minInlineSize: '34rem' }}>
          <thead>
            <tr>
              <th>&nbsp;</th>
              <th>Build-time (default)</th>
              <th>Runtime override</th>
            </tr>
          </thead>
          <tbody className="blurb">
            <tr>
              <td>You write</td>
              <td>
                <code className="mono">&lt;ThemeProvider&gt;</code>
              </td>
              <td>
                <code className="mono">&lt;ThemeProvider theme={'{…}'}&gt;</code>
              </td>
            </tr>
            <tr>
              <td>Tokens come from</td>
              <td>
                <code className="mono">@ap/react/theme.css</code>
              </td>
              <td>a generated theme, emitted inline</td>
            </tr>
            <tr>
              <td>Renders</td>
              <td>nothing — context only</td>
              <td>
                a <code className="mono">&lt;style&gt;</code> and a scoping element
              </td>
            </tr>
            <tr>
              <td>Cost</td>
              <td>zero</td>
              <td>the generator in your bundle, one sheet per provider</td>
            </tr>
            <tr>
              <td>Use when</td>
              <td>the palette is known when you build</td>
              <td>it is not — a per-tenant brand from the request</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>The default path costs nothing</h2>
      <p className="blurb">
        With no <code className="mono">theme</code> prop the provider emits no CSS and adds no
        element to the DOM. Everything below this heading is on that path — the tokens come from the
        stylesheet already on the page. That is also why dark mode keeps working with JavaScript
        disabled: nothing about it depends on React.
      </p>
      <Sample name="Default" />

      <h2>The runtime override</h2>
      <p className="blurb">
        Pass a generated theme and the provider emits that theme&rsquo;s tokens scoped to an element
        it wraps your children in. Same components, same classes, no props threaded anywhere — the
        buttons below are identical to the ones above.
      </p>
      <pre className="mono" style={{ overflowX: 'auto' }}>
        {`import { ThemeProvider, generateTheme } from '@ap/react'

const theme = generateTheme({ brand: tenant.brandColour })

<ThemeProvider theme={theme}>
  <App />
</ThemeProvider>`}
      </pre>
      <ThemeProvider theme={PINK}>
        <Sample name="brand #c2185b" />
      </ThemeProvider>

      <h2>Nesting re-scopes</h2>
      <p className="blurb">
        Because the tokens are CSS custom properties, a nested provider simply wins for its own
        subtree through the cascade. No React re-render, no context gymnastics, and the outer theme
        is untouched — which is what makes a differently-branded panel inside a page possible.
      </p>
      <ThemeProvider theme={PINK}>
        <div className="stack" style={{ maxInlineSize: 'none' }}>
          <Sample name="outer" />
          <ThemeProvider theme={TEAL}>
            <Sample name="nested" />
          </ThemeProvider>
        </div>
      </ThemeProvider>

      <h2>Colour scheme</h2>
      <CurrentScheme />
      <p className="blurb">
        Three states, not two. <code className="mono">light</code> and{' '}
        <code className="mono">dark</code> set <code className="mono">data-ap-scheme</code> on the
        root; <code className="mono">system</code> is expressed by the <em>absence</em> of that
        attribute, so the <code className="mono">prefers-color-scheme</code> media query decides.
        Writing <code className="mono">data-ap-scheme=&quot;system&quot;</code> would match neither
        selector and silently pin everything to light.
      </p>
      <p className="blurb">
        A <em>scoped</em> provider puts that attribute on its own element instead of the document
        root. Anything else would let a nested subtree re-theme the entire page.
      </p>

      <h2>Getting it right on the server</h2>
      <p className="blurb">
        The provider renders its <code className="mono">&lt;style&gt;</code> in place rather than
        injecting it from an effect, so a per-tenant palette is already in the server response and
        the first paint is correct. Injecting after hydration would repaint — a visible flash of the
        wrong brand.
      </p>
      <p className="blurb">
        For the colour scheme, read the user&rsquo;s choice from a cookie server-side and render the
        attribute into the initial HTML; no script is needed at all. In a client-only app there is
        nothing to read it from, so <code className="mono">&lt;ThemeScript /&gt;</code> puts a tiny
        synchronous script in the head. It blocks by necessity, and that is the one place blocking is
        the right answer — any deferred script paints the wrong theme first.
      </p>
    </Page>
  )
}
