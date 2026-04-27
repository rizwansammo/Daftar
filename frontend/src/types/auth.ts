export type UserRole = 'ADMIN' | 'AGENT'
export type ThemePreference = 'light' | 'dark' | 'system'

export interface Me {
  id: string
  email: string
  display_name: string
  full_name: string
  avatar: string | null
  role: UserRole
  timezone: string
  theme_preference: ThemePreference
  is_active: boolean
  date_joined: string
  last_login: string | null
  color_tag: string
}

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  message: string
  errors: unknown
}
