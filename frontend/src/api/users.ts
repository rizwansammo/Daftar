import { http } from './http'
import type { ApiEnvelope } from '../types/auth'
import type { CursorPage } from '../types/pagination'
import type { AgentUser } from '../types/users'

export async function listUsers(search?: string) {
  const res = await http.get<ApiEnvelope<CursorPage<AgentUser>>>('/auth/users/', {
    params: search ? { search, ordering: 'display_name' } : { ordering: 'display_name' },
  })
  return res.data
}

export type CreateUserInput = {
  full_name: string
  display_name: string
  email: string
  role: 'ADMIN' | 'AGENT'
  password: string
}

export async function createUser(input: CreateUserInput) {
  const res = await http.post<ApiEnvelope<AgentUser>>('/auth/users/', input)
  return res.data
}

export async function deleteUser(userId: string) {
  const res = await http.delete<ApiEnvelope<{}>>(`/auth/users/${encodeURIComponent(userId)}/`)
  return res.data
}

export type UpdateUserInput = {
  full_name?: string
  display_name?: string
  email?: string
  role?: 'ADMIN' | 'AGENT'
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  const res = await http.patch<ApiEnvelope<AgentUser>>(`/auth/users/${encodeURIComponent(userId)}/`, input)
  return res.data
}

export type ResetUserPasswordInput = {
  new_password: string
  current_password?: string
}

export async function resetUserPassword(userId: string, input: ResetUserPasswordInput) {
  const res = await http.post<ApiEnvelope<{}>>(`/auth/users/${encodeURIComponent(userId)}/reset-password/`, input)
  return res.data
}
