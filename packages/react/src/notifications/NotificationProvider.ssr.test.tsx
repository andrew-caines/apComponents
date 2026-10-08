// Deliberately no environment docblock: this runs in the default node
// environment with no jsdom, like LocaleProvider.ssr.test.tsx.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ApProvider } from '../providers/ApProvider.js'
import { LocaleProvider } from '../providers/LocaleProvider.js'
import { BannerRegion } from '../components/Banner/BannerRegion.js'
import { NotificationProvider } from './NotificationProvider.js'

describe('NotificationProvider SSR', () => {
  it('renders two empty live regions and no toast viewport (fails if the viewport is outside the portal)', () => {
    expect(typeof window).toBe('undefined')
    const html = renderToString(
      <LocaleProvider>
        <NotificationProvider>
          <span>page</span>
        </NotificationProvider>
      </LocaleProvider>,
    )
    expect(html).toContain('page')
    expect(html.match(/aria-live="polite"[^>]*><\/div>/g)).toHaveLength(1)
    expect(html.match(/aria-live="assertive"[^>]*><\/div>/g)).toHaveLength(1)
    expect(html).not.toContain('role="region"')
    expect(html).not.toContain('alertdialog')
    expect(html).not.toContain('Notifications')
  })

  it('adds only those two regions to ApProvider server HTML', () => {
    const html = renderToString(
      <ApProvider>
        <span>ok</span>
      </ApProvider>,
    )
    expect(html).toContain('ok')
    expect(html.match(/aria-live=/g)).toHaveLength(2)
    expect(html).not.toContain('role="region"')
  })

  it('renders a BannerRegion as its empty wrapper with no status role (fails if the region renders nothing or a banner on the server)', () => {
    const html = renderToString(
      <LocaleProvider>
        <NotificationProvider>
          <BannerRegion className="slot" />
        </NotificationProvider>
      </LocaleProvider>,
    )
    expect(html).toMatch(/<div class="[^"]*slot[^"]*"><\/div>/)
    expect(html).not.toContain('role="status"')
    expect(html).not.toContain('role="alert"')
  })
})
