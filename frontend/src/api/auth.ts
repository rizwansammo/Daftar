import { http } from './http'
import type { ApiEnvelope, Me } from '../types/auth'

export async function login(email: string, password: string) {
  const res = await http.post<ApiEnvelope<{}>>('/auth/login/', {
    email,
    password,
  })
  return res.data
}

export type UpdateProfileInput = Partial<Pick<Me, 'email' | 'full_name' | 'display_name' | 'timezone' | 'theme_preference'>>

export async function updateProfile(input: UpdateProfileInput) {
  const res = await http.patch<ApiEnvelope<Me>>('/auth/me/', input)
  return res.data
}

export async function refresh() {
  const res = await http.post<ApiEnvelope<{}>>('/auth/refresh/', {})
  return res.data
}

export async function logout() {
  const res = await http.post<ApiEnvelope<{}>>('/auth/logout/', {})
  return res.data
}

export async function me() {
  const res = await http.get<ApiEnvelope<Me>>('/auth/me/')
  return res.data
}
