import type { Theme } from '@ap/tokens'
import { RampTable } from '../lib/Swatches.js'

export function RampView({ theme }: { theme: Theme }) {
  return (
    <section aria-labelledby="gen-ramps">
      <h2 id="gen-ramps">Ramps</h2>
      <div className="gen-two">
        <RampTable theme={theme} mode="light" />
        <RampTable theme={theme} mode="dark" />
      </div>
    </section>
  )
}
