import { Suspense } from 'react'
import { Await } from 'react-router'
import {
  Accordion,
  Button,
  Checkbox,
  Field,
  Input,
  LocaleProvider,
  RadioGroup,
  Select,
  Spinner,
  Surface,
  Switch,
  Tabs,
  Textarea,
} from '@ap/react'

const COUNTRIES = [
  { value: 'ca', label: 'Canada' },
  { value: 'fr', label: 'France' },
  { value: 'de', label: 'Germany' },
]

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
    // `LocaleProvider` sits OUTSIDE the Suspense boundary, for the reason the
    // comment inside the boundary gives about Dialog: a provider inside would
    // be testing the provider rather than the streaming. `Select` throws
    // without one, and the provider itself is not what this route is about.
    <LocaleProvider>
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
                <Field label="Streamed message">
                  <Textarea name="streamed-message" defaultValue="streamed message" />
                </Field>
                <Checkbox name="streamed-subscribe" value="yes" label="Streamed subscribe" defaultChecked />
                <Switch name="streamed-alerts" value="on" label="Streamed alerts" defaultChecked />
                <RadioGroup
                  label="Streamed contact"
                  name="streamed-contact"
                  defaultValue="sms"
                  options={[
                    { value: 'email', label: 'Streamed email' },
                    { value: 'sms', label: 'Streamed text' },
                  ]}
                />
                <Field label="Streamed country">
                  <Select name="streamed-country" defaultValue="fr" options={COUNTRIES} />
                </Field>
                <Tabs
                  aria-label="Streamed sections"
                  items={[
                    { value: 'one', label: 'Streamed one', content: <p id="streamed-tab-one">first</p> },
                    { value: 'two', label: 'Streamed two', content: <p id="streamed-tab-two">second</p> },
                  ]}
                />
                <Accordion
                  defaultValue={['a']}
                  items={[
                    { value: 'a', title: 'Streamed A', content: <p id="streamed-acc-a">open</p> },
                    { value: 'b', title: 'Streamed B', content: <p id="streamed-acc-b">closed</p> },
                  ]}
                />
              </Surface>
            )}
          </Await>
        </Suspense>
      </main>
    </LocaleProvider>
  )
}
