import { banner, BannerRegion, Button, confirm, toast } from '@ap/react'
import { Page, Specimen } from '../Page.js'

export default function NotificationsPage() {
  return (
    <Page slug="notifications">
      <BannerRegion />

      <Specimen label="toast()">
        <Button onClick={() => toast.success({ title: 'Saved', description: 'Your changes are live.' })}>
          Show a toast
        </Button>
      </Specimen>

      <Specimen label="banner()">
        <Button
          variant="outline"
          onClick={() => banner({ title: 'Scheduled maintenance tonight', severity: 'warning' })}
        >
          Show a banner
        </Button>
      </Specimen>

      <Specimen label="confirm()">
        <Button
          variant="outline"
          onClick={() => {
            void confirm({ title: 'Delete this record?', tone: 'danger' }).then((ok) =>
              toast({ title: ok ? 'Deleted' : 'Kept' }),
            )
          }}
        >
          Ask to confirm
        </Button>
      </Specimen>
    </Page>
  )
}
