import { http } from './http'
import type { ApiEnvelope } from '../types/auth'
import type { CursorPage } from '../types/pagination'
import type { Boilerplate } from '../types/boilerplates'

export type ListBoilerplatesParams = {
  search?: string
  clientId?: string
}

export async function listBoilerplates(params?: ListBoilerplatesParams) {
  const res = await http.get<ApiEnvelope<CursorPage<Boilerplate>>>('/boilerplates/', {
    params: {
      ordering: 'title',
      ...(params?.search ? { search: params.search } : {}),
      ...(params?.clientId ? { client_id: params.clientId } : {}),
    },
  })
  return res.data
}

export type CreateBoilerplateInput = {
  client_id: string
  title: string
  content: string
  is_checked?: boolean
}

export async function createBoilerplate(input: CreateBoilerplateInput) {
  const res = await http.post<ApiEnvelope<Boilerplate>>('/boilerplates/', input)
  return res.data
}

export type UpdateBoilerplateInput = Partial<Omit<CreateBoilerplateInput, 'client_id'>> & {
  client_id?: string | null
}

export async function updateBoilerplate(boilerplateId: string, input: UpdateBoilerplateInput) {
  const res = await http.patch<ApiEnvelope<Boilerplate>>(
    `/boilerplates/${encodeURIComponent(boilerplateId)}/`,
    input,
  )
  return res.data
}
