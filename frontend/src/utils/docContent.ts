import type { RichTextContent } from '../types/docs'

const defaultContent: RichTextContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

function isRichTextContent(value: unknown): value is RichTextContent {
  return Boolean(value && typeof value === 'object' && 'type' in value)
}

function textToContent(text: string): RichTextContent {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (!paragraphs.length) return defaultContent

  return {
    type: 'doc',
    content: paragraphs.map((part) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: part }],
    })),
  }
}

export function normalizeDocumentContent(content: unknown, fallbackText = ''): RichTextContent {
  if (isRichTextContent(content) && content.type === 'doc') return content
  return textToContent(fallbackText)
}
