export type AgentUser = {
  id: string
  email: string
  display_name: string
  full_name: string
  role: 'ADMIN' | 'AGENT'
  is_active: boolean
  date_joined: string
  last_login: string | null
  color_tag: string
}
