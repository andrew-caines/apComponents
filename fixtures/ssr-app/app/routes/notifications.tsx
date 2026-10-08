import { useEffect, useState } from 'react'
import { announce, ApProvider, banner, BannerRegion, Button, confirm, toast } from '@ap/react'

/**
 * The surface the notification SSR, hydration and keyboard checks assert against.
 *
 * `ApProvider` rather than `LocaleProvider`: this is the first route that needs
 * the notification provider, and `ApProvider` mounts it.
 *
 * `MountToast` raises a toast from its own mount effect. Base UI's provider
 * subscribes in a passive effect that runs after its children's, so this is the
 * call a naive design drops silently (Review Focus 1, in a real browser).
 *
 * Routed in both SSR and SPA modes: it exports no loader and no action.
 */
function MountToast() {
  useEffect(() => {
    toast({ title: 'Mounted toast' })
  }, [])
  return null
}

export default function NotificationsRoute() {
  const [answer, setAnswer] = useState('')
  return (
    <ApProvider>
      <main>
        <h1>notifications</h1>
        <MountToast />
        <BannerRegion />
        <p id="confirm-result">{answer}</p>
        <Button id="toast-info" onClick={() => toast.info('Info toast')}>
          Info toast
        </Button>
        <Button id="toast-error" onClick={() => toast.error('Error toast')}>
          Error toast
        </Button>
        <Button id="banner-warning" onClick={() => banner({ title: 'Warning banner', severity: 'warning' })}>
          Warning banner
        </Button>
        <Button
          id="confirm-danger"
          onClick={() => {
            void confirm({ title: 'Delete record', tone: 'danger' }).then((ok) => setAnswer(String(ok)))
          }}
        >
          Delete
        </Button>
        <Button id="announce" onClick={() => announce('Saved')}>
          Announce
        </Button>
      </main>
    </ApProvider>
  )
}
