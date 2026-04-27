import { http } from './http'
import type { ApiEnvelope, Me } from '../types/auth'

export async function login(identifier: string, password: string) {
  const res = await http.post<ApiEnvelope<{}>>('/auth/login/', {
    email: identifier,
    username: identifier,
    password,
  })
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
