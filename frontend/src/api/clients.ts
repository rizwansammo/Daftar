import { http } from './http'
import type { ApiEnvelope } from '../types/auth'
import type { CursorPage } from '../types/pagination'
import type { Client } from '../types/tickets'

export async function listClients(search?: string) {
  const res = await http.get<ApiEnvelope<CursorPage<Client>>>('/clients/', {
    params: search ? { search, ordering: 'name' } : { ordering: 'name' },
  })
  return res.data
}

export async function getClient(clientId: string) {
  const res = await http.get<ApiEnvelope<Client>>(`/clients/${encodeURIComponent(clientId)}/`)
  return res.data
}

export type CreateClientInput = {
  name: string
  color_tag?: string
  notes?: string
}

export async function createClient(input: CreateClientInput) {
  const res = await http.post<ApiEnvelope<Client>>('/clients/', input)
  return res.data
}

export type UpdateClientInput = {
  name?: string
  color_tag?: string
  notes?: string
}

export async function updateClient(clientId: string, input: UpdateClientInput) {
  const res = await http.patch<ApiEnvelope<Client>>(`/clients/${encodeURIComponent(clientId)}/`, input)
  return res.data
}

export async function deleteClientWithPassword(clientId: string, password: string) {
  const res = await http.post<ApiEnvelope<{}>>(`/clients/${encodeURIComponent(clientId)}/delete/`, { password })
  return res.data
}

export async function bulkDeleteClientsWithPassword(clientIds: string[], password: string) {
  const res = await http.post<ApiEnvelope<{ deleted_count: number; not_found_ids?: string[] }>>(
    '/clients/bulk-delete/',
    {
      client_ids: clientIds,
      password,
    },
  )
  return res.data
}
