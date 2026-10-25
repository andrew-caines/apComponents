import { useActionData } from 'react-router'

// The action behind the Getting started guide's form (routes/start.tsx posts here).
// The guide quotes only the form; in a reader's app this action is their own.
export async function action({ request }: { request: Request }) {
  const data = await request.formData()
  return { email: String(data.get('email') ?? '') }
}

export default function Subscribe() {
  const data = useActionData<typeof action>()
  return (
    <main>
      <h1>Thanks</h1>
      <p data-testid="subscribed">{data ? `Subscribed ${data.email}.` : 'Nothing was submitted.'}</p>
    </main>
  )
}
