import { http } from './http'
import type { ApiEnvelope } from '../types/auth'
import type { CursorPage } from '../types/pagination'
import type { Document, DocumentCategory, DocumentVersion, RichTextContent } from '../types/docs'

export type ListDocsParams = {
  cursor?: string
  search?: string
  client_id?: string
  category_id?: string
  folder_id?: string
  is_published?: boolean
  ordering?: string
}

export async function listDocs(params: ListDocsParams) {
  const res = await http.get<ApiEnvelope<CursorPage<Document>>>('/docs/', { params })
  return res.data
}

export async function getDoc(docId: string) {
  const res = await http.get<ApiEnvelope<Document>>(`/docs/${encodeURIComponent(docId)}/`)
  return res.data
}

export type CreateDocInput = {
  title: string
  client_id?: string | null
  category_id?: string | null
  content?: RichTextContent
  content_text?: string
}

export async function createDoc(input: CreateDocInput) {
  const res = await http.post<ApiEnvelope<Document>>('/docs/', {
    title: input.title,
    client_id: input.client_id ?? null,
    category_id: input.category_id ?? null,
    content: input.content ?? {},
    content_text: input.content_text ?? '',
  })
  return res.data
}

export type UpdateDocInput = Partial<{
  title: string
  client_id: string | null
  category_id: string | null
  content: RichTextContent
  content_text: string
  is_published: boolean
}>

export async function updateDoc(docId: string, input: UpdateDocInput) {
  const res = await http.patch<ApiEnvelope<Document>>(`/docs/${encodeURIComponent(docId)}/`, input)
  return res.data
}

export async function deleteDoc(docId: string) {
  const res = await http.delete<ApiEnvelope<Record<string, never>>>(`/docs/${encodeURIComponent(docId)}/`)
  return res.data
}

export type ListDocCategoriesParams = {
  cursor?: string
  search?: string
  ordering?: string
  client_id?: string
  parent_id?: string
}

export async function listDocCategories(params?: ListDocCategoriesParams) {
  const res = await http.get<ApiEnvelope<CursorPage<DocumentCategory>>>('/doc-categories/', { params })
  return res.data
}

export async function createDocCategory(input: {
  name: string
  color?: string
  icon?: string
  client_id?: string | null
  parent_id?: string | null
}) {
  const res = await http.post<ApiEnvelope<DocumentCategory>>('/doc-categories/', input)
  return res.data
}

export async function getDocCategoryPath(categoryId: string) {
  const res = await http.get<ApiEnvelope<Array<{ id: string; name: string }>>>(
    `/doc-categories/${encodeURIComponent(categoryId)}/path/`,
  )
  return res.data
}

export async function createDocVersion(docId: string) {
  const res = await http.post<ApiEnvelope<DocumentVersion>>(
    `/docs/${encodeURIComponent(docId)}/versions/`,
    {},
  )
  return res.data
}
