import { Surface } from '@ap/react'

export default function Home() {
  return (
    <main>
      <h1>ap fixture</h1>
      {/* `id`, not `data-testid`: SurfaceProps extends HTMLAttributes, which
          does not admit arbitrary `data-*` keys on a component. */}
      <Surface tone="raised" pad="lg" id="surface-raised">
        server rendered surface
      </Surface>
      <Surface tone="canvas" pad="sm">
        canvas surface
      </Surface>
    </main>
  )
}
