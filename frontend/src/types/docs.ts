import type { Me } from './auth'

export type RichTextContent = {
  type: string
  attrs?: Record<string, unknown>
  content?: RichTextContent[]
  marks?: Array<{
    type: string
    attrs?: Record<string, unknown>
  }>
  text?: string
}

export type DocumentCategory = {
  id: string
  name: string
  color: string
  icon: string
  client: string | null
  parent: string | null
  created_by: Me | null
  created_at: string
}

export type DocumentTag = {
  id: string
  name: string
  color: string
}

export type Document = {
  id: string
  title: string
  client: string | null
  content: RichTextContent | Record<string, never>
  content_text: string
  category: DocumentCategory | null
  author: Me
  tags: DocumentTag[]
  is_published: boolean
  created_at: string
  updated_at: string
  last_edited_by: Me | null
}

export type DocumentVersion = {
  id: string
  document: string
  content: RichTextContent | Record<string, never>
  saved_by: Me | null
  saved_at: string
  version_number: number
}
