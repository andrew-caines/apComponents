import { useEffect, useMemo, useState } from 'react'
import { Button } from '@ap/react'
import { useCopyToClipboard } from '@ap/react/hooks'
import { contrastPairings, toCssText, type Theme } from '@ap/tokens'
import { buildSnippet } from './logic.js'

/** `brand` must already be a valid hex: `buildSnippet` throws on anything else. */
export function Export({ theme, brand }: { theme: Theme; brand: string }) {
  const snippet = buildSnippet(brand)
  const failing = useMemo(() => contrastPairings(theme).filter((p) => !p.pass).length, [theme])
  const [copied, copy] = useCopyToClipboard()
  const [copyFailed, setCopyFailed] = useState(false)
  const [href, setHref] = useState<string>('')
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([toCssText(theme)], { type: 'text/css' }))
    setHref(url)
    return () => URL.revokeObjectURL(url)
  }, [theme])

  return (
    <section aria-labelledby="gen-export">
      <h2 id="gen-export">Use it</h2>
      {failing > 0 && (
        <p role="status" className="gen-warn">
          {failing} pairing{failing === 1 ? '' : 's'} fail WCAG AA in this theme.
        </p>
      )}
      <pre data-testid="snippet"><code>{snippet}</code></pre>
      <div className="row">
        <Button
          onClick={() => {
            void copy(snippet).then((ok) => setCopyFailed(!ok))
          }}
        >
          {copied ? 'Copied' : 'Copy code'}
        </Button>
        {href && <a href={href} download="theme.css">Download theme.css</a>}
      </div>
      {copyFailed && <p role="status">Copy failed; select the text instead.</p>}
    </section>
  )
}
