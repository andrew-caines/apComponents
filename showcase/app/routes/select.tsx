import { Field, Select } from '@ap/react'
import { Page, Specimen } from '../Page.js'

const COUNTRIES = [
  { value: 'ca', label: 'Canada' },
  { value: 'fr', label: 'France' },
  { value: 'de', label: 'Germany' },
  { value: 'jp', label: 'Japan' },
]

const GROUPED_COUNTRIES = [
  {
    label: 'North America',
    options: [
      { value: 'ca', label: 'Canada' },
      { value: 'us', label: 'United States' },
    ],
  },
  {
    label: 'Europe',
    options: [
      { value: 'fr', label: 'France' },
      { value: 'de', label: 'Germany' },
    ],
  },
]

export default function SelectPage() {
  return (
    <Page slug="select">
      <Specimen label="single">
        <Field label="Country">
          <Select name="country" options={COUNTRIES} placeholder="Choose a country" defaultValue="ca" />
        </Field>
      </Specimen>

      <Specimen label="grouped">
        <Field label="Country">
          <Select name="country-grouped" options={GROUPED_COUNTRIES} placeholder="Choose a country" />
        </Field>
      </Specimen>

      <Specimen label="multiple">
        <Field label="Countries">
          <Select
            multiple
            name="countries"
            options={COUNTRIES}
            placeholder="Choose countries"
            defaultValue={['ca', 'fr']}
          />
        </Field>
      </Specimen>
    </Page>
  )
}
