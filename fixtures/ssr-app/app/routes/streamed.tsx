import { Suspense } from 'react'
import { Await } from 'react-router'
import { Button, Field, Input, Spinner, Surface } from '@ap/react'

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
              {/*
                Gate 6 wants every component exercised behind a streaming
                boundary, not just one. Content flushed AFTER the shell is the
                harder case: its markup arrives in a second chunk and is
                reconciled separately, so a component that hydrates cleanly at
                the top of a document can still mismatch here. Dialog is covered
                by its own route instead — it needs the message registry, and a
                provider inside a Suspense boundary would be testing the
                provider rather than the streaming.
              */}
              <Button id="streamed-button">streamed button</Button>
              <Spinner size="lg" />
              <Field label="Streamed field" hint="Rendered after the shell flushed.">
                <Input name="streamed" id="streamed-input" defaultValue="late" />
              </Field>
            </Surface>
          )}
        </Await>
      </Suspense>
    </main>
  )
}
