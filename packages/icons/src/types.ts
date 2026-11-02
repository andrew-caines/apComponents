export interface IconDefinition {
  readonly name: string
  readonly primary: readonly string[]
  readonly secondary?: readonly string[] | 'halo'
  readonly viewBox?: string
}

export interface IconInput {
  name: string
  primary: readonly string[]
  secondary?: readonly string[] | 'halo'
  viewBox?: string
}
