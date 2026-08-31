import { Suspense } from 'react'
import { Await } from 'react-router'
import { Surface } from '@ap/react'

export async function loader() {
  // Deliberately deferred: this content flushes after the shell.
  const slow = new Promise<string>((resolve) => {
    setTimeout(() => resolve('streamed surface content'), 120)
  })
  return { slow }
}

// `react-router typegen` produces `./+types/streamed`, but that requires a
// `rootDirs` entry pointing at `.react-router/types` that this fixture's
// tsconfig.json doesn't declare. Per the brief's sanctioned fallback, the
// fixture's job is the runtime behaviour, not its typings, so this is typed
// inline instead.
export default function Streamed({ loaderData }: { loaderData: { slow: Promise<string> } }) {
  return (
    <main>
      <h1>streamed</h1>
      <Suspense fallback={<p>loading…</p>}>
        <Await resolve={loaderData.slow}>
          {(value: string) => (
            <Surface tone="surface" pad="md" id="streamed-surface">
              {value}
            </Surface>
          )}
        </Await>
      </Suspense>
    </main>
  )
}
