export type BoilerplateClient = {
  id: string
  name: string
}

export type Boilerplate = {
  id: string
  title: string
  content: string
  is_checked: boolean
  client: BoilerplateClient | null
  created_at: string
  updated_at: string
}
