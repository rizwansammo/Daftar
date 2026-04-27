import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  Pencil,
  Printer,
  Save,
  Trash2,
} from 'lucide-react'

import { createDocVersion, deleteDoc, getDoc, listDocCategories, updateDoc } from '../api/docs'
import { RichDocumentEditor } from '../components/docs/RichDocumentEditor'
import type { Document, RichTextContent } from '../types/docs'
import { normalizeDocumentContent } from '../utils/docContent'

type Mode = 'view' | 'edit'

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data as { message?: string; errors?: unknown; detail?: unknown } | undefined
    const detail =
      (typeof data?.detail === 'string' && data.detail) ||
      (typeof data?.message === 'string' && data.message) ||
      (data?.errors ? JSON.stringify(data.errors) : null)

    return detail ? `Request failed (${status}): ${detail}` : `Request failed (${status})`
  }

  return fallback
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return format(date, 'MMM d, yyyy h:mm a')
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'document'
  )
}

function getAttr(node: RichTextContent, key: string) {
  const value = node.attrs?.[key]
  return typeof value === 'string' ? value : undefined
}

function applyMarks(text: string, marks: RichTextContent['marks']) {
  if (!marks?.length) return text

  return marks.reduce((current, mark) => {
    if (mark.type === 'bold') return `**${current}**`
    if (mark.type === 'italic') return `_${current}_`
    if (mark.type === 'strike') return `~~${current}~~`
    if (mark.type === 'code') return `\`${current}\``
    if (mark.type === 'link') {
      const href = mark.attrs?.href
      return typeof href === 'string' ? `[${current}](${href})` : current
    }
    return current
  }, text)
}

function inlineMarkdown(node: RichTextContent): string {
  if (node.type === 'text') return applyMarks(node.text ?? '', node.marks)
  if (!node.content?.length) return ''
  return node.content.map(inlineMarkdown).join('')
}

function nodeMarkdown(node: RichTextContent, index = 0): string {
  const children = node.content ?? []

  if (node.type === 'paragraph') return inlineMarkdown(node)
  if (node.type === 'heading') return `${'#'.repeat(Number(node.attrs?.level ?? 2))} ${inlineMarkdown(node)}`
  if (node.type === 'blockquote') return children.map((child) => `> ${nodeMarkdown(child)}`).join('\n')
  if (node.type === 'codeBlock') return `\`\`\`\n${inlineMarkdown(node)}\n\`\`\``
  if (node.type === 'horizontalRule') return '---'
  if (node.type === 'image') return `![${getAttr(node, 'alt') ?? ''}](${getAttr(node, 'src') ?? ''})`
  if (node.type === 'bulletList') {
    return children.map((child) => `- ${nodeMarkdown(child).replace(/\n/g, '\n  ')}`).join('\n')
  }
  if (node.type === 'orderedList') {
    return children.map((child, childIndex) => `${childIndex + 1}. ${nodeMarkdown(child).replace(/\n/g, '\n   ')}`).join('\n')
  }
  if (node.type === 'taskList') {
    return children.map((child) => nodeMarkdown(child)).join('\n')
  }
  if (node.type === 'taskItem') {
    const checked = node.attrs?.checked ? 'x' : ' '
    return `- [${checked}] ${children.map(nodeMarkdown).join(' ')}`
  }
  if (node.type === 'listItem') return children.map(nodeMarkdown).join('\n')
  if (node.type === 'table') return children.map(nodeMarkdown).join('\n')
  if (node.type === 'tableRow') {
    const cells = children.map((cell) => inlineMarkdown(cell).trim())
    const row = `| ${cells.join(' | ')} |`
    if (index === 0) return `${row}\n| ${cells.map(() => '---').join(' | ')} |`
    return row
  }
  if (node.type === 'tableCell' || node.type === 'tableHeader') return children.map(inlineMarkdown).join(' ')

  return children.map(nodeMarkdown).join('\n\n')
}

function toMarkdown(title: string, content: RichTextContent) {
  const body = (content.content ?? []).map((node, index) => nodeMarkdown(node, index)).filter(Boolean).join('\n\n')
  return `# ${title.trim() || 'Untitled'}\n\n${body}`.trim()
}

function snapshotFor(input: {
  title: string
  content: RichTextContent
  contentText: string
  categoryId: string
  isPublished: boolean
}) {
  return JSON.stringify({
    title: input.title.trim() || 'Untitled',
    content: input.content,
    content_text: input.contentText,
    category_id: input.categoryId || null,
    is_published: input.isPublished,
  })
}

function DocumentWorkspace({ doc }: { doc: Document }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [mode, setMode] = useState<Mode>('view')
  const [title, setTitle] = useState(() => doc.title || 'Untitled')
  const [content, setContent] = useState<RichTextContent>(() => normalizeDocumentContent(doc.content, doc.content_text))
  const [contentText, setContentText] = useState(() => doc.content_text || '')
  const [categoryId, setCategoryId] = useState(() => doc.category?.id ?? '')
  const [isPublished, setIsPublished] = useState(() => doc.is_published)
  const [lastSavedAt, setLastSavedAt] = useState<number>(() => Date.now())
  const [clock, setClock] = useState<number>(() => Date.now())
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    snapshotFor({
      title: doc.title || 'Untitled',
      content: normalizeDocumentContent(doc.content, doc.content_text),
      contentText: doc.content_text || '',
      categoryId: doc.category?.id ?? '',
      isPublished: doc.is_published,
    }),
  )

  const categoriesQuery = useQuery({
    queryKey: ['doc-categories'],
    queryFn: async () => {
      const res = await listDocCategories()
      return res.data
    },
  })

  const currentSnapshot = useMemo(
    () => snapshotFor({ title, content, contentText, categoryId, isPublished }),
    [categoryId, content, contentText, isPublished, title],
  )

  const isDirty = currentSnapshot !== savedSnapshot

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim() || 'Untitled',
        category_id: categoryId || null,
        content,
        content_text: contentText,
        is_published: isPublished,
      }
      const response = await updateDoc(doc.id, payload)
      return { document: response.data, snapshot: snapshotFor({ title, content, contentText, categoryId, isPublished }) }
    },
    onSuccess: (result) => {
      setSavedSnapshot(result.snapshot)
      setLastSavedAt(Date.now())
      queryClient.invalidateQueries({ queryKey: ['doc', doc.id] })
      queryClient.invalidateQueries({ queryKey: ['docs'], exact: false })
      toast.success('Saved')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Could not save'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => deleteDoc(doc.id),
    onSuccess: () => {
      toast.success('Deleted')
      queryClient.invalidateQueries({ queryKey: ['docs'], exact: false })
      if (doc.client) navigate(`/docs/clients/${encodeURIComponent(doc.client)}`)
      else navigate('/docs')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Could not delete'))
    },
  })

  const versionMutation = useMutation({
    mutationFn: async () => createDocVersion(doc.id),
    onSuccess: () => toast.success('Snapshot saved'),
    onError: (error) => toast.error(getErrorMessage(error, 'Could not save snapshot')),
  })

  const saveNow = useCallback(() => {
    if (!isDirty || saveMutation.isPending) return
    saveMutation.mutate()
  }, [isDirty, saveMutation])

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() !== 's') return
      event.preventDefault()
      saveNow()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveNow])

  useEffect(() => {
    if (mode !== 'edit') return
    const id = window.setInterval(() => {
      if (isDirty && !saveMutation.isPending) saveMutation.mutate()
    }, 10_000)
    return () => window.clearInterval(id)
  }, [isDirty, mode, saveMutation])

  const savedLabel = useMemo(() => {
    if (saveMutation.isPending) return 'Saving...'
    if (isDirty) return 'Unsaved changes'
    const seconds = Math.max(0, Math.floor((clock - lastSavedAt) / 1000))
    if (seconds < 5) return 'Saved just now'
    if (seconds < 60) return `Saved ${seconds}s ago`
    return `Saved ${Math.floor(seconds / 60)}m ago`
  }, [clock, isDirty, lastSavedAt, saveMutation.isPending])

  const onEditorChange = useCallback((nextContent: RichTextContent, nextText: string) => {
    setContent(nextContent)
    setContentText(nextText)
  }, [])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(toMarkdown(title, content))
      toast.success('Markdown copied')
    } catch {
      toast.error('Could not copy Markdown')
    }
  }

  function downloadMarkdown() {
    const blob = new Blob([toMarkdown(title, content)], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = `${slugify(title)}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => {
              if (doc.client) navigate(`/docs/clients/${encodeURIComponent(doc.client)}`)
              else navigate('/docs')
            }}
            className="mb-3 inline-flex h-8 items-center gap-2 rounded-md border border-border-subtle bg-bg-secondary px-3 text-xs text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Library
          </button>

          {mode === 'edit' ? (
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-transparent bg-transparent px-0 text-2xl font-semibold text-text-primary outline-none transition focus:border-border-subtle focus:bg-bg-card focus:px-3"
            />
          ) : (
            <h1 className="truncate text-2xl font-semibold">{title}</h1>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-card px-2 py-1">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDate(doc.updated_at)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-card px-2 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {savedLabel}
            </span>
            {mode === 'edit' ? (
              <label className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-bg-card px-2 py-1">
                <input
                  checked={isPublished}
                  onChange={(event) => setIsPublished(event.target.checked)}
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border-subtle bg-bg-secondary text-accent-primary focus:ring-accent-primary/30"
                />
                Published
              </label>
            ) : (
              <span className="inline-flex items-center rounded-md border border-border-subtle bg-bg-card px-2 py-1">
                {isPublished ? 'Published' : 'Draft'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 overflow-hidden rounded-lg border border-border-subtle bg-bg-card">
            <button
              type="button"
              onClick={() => setMode('view')}
              className={[
                'inline-flex items-center gap-2 px-3 text-sm transition',
                mode === 'view' ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:text-text-primary',
              ].join(' ')}
            >
              <Eye className="h-4 w-4" />
              View
            </button>
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={[
                'inline-flex items-center gap-2 border-l border-border-subtle px-3 text-sm transition',
                mode === 'edit' ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:text-text-primary',
              ].join(' ')}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          </div>

          {mode === 'edit' ? (
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-10 rounded-lg border border-border-subtle bg-bg-card px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
            >
              <option value="">General</option>
              {(categoriesQuery.data?.results ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            title="Save"
            aria-label="Save"
            onClick={saveNow}
            disabled={!isDirty || saveMutation.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-primary px-4 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-55"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>

          <button
            type="button"
            title="Snapshot"
            aria-label="Snapshot"
            onClick={() => versionMutation.mutate()}
            disabled={versionMutation.isPending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-card text-text-secondary transition hover:bg-bg-hover hover:text-text-primary disabled:opacity-55"
          >
            <History className="h-4 w-4" />
          </button>

          <button
            type="button"
            title="Copy link"
            aria-label="Copy link"
            onClick={copyLink}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-card text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          >
            <Copy className="h-4 w-4" />
          </button>

          <button
            type="button"
            title="Copy Markdown"
            aria-label="Copy Markdown"
            onClick={copyMarkdown}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-card text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          >
            <FileText className="h-4 w-4" />
          </button>

          <button
            type="button"
            title="Download Markdown"
            aria-label="Download Markdown"
            onClick={downloadMarkdown}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-card text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          >
            <Download className="h-4 w-4" />
          </button>

          <button
            type="button"
            title="Print"
            aria-label="Print"
            onClick={() => window.print()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-card text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          >
            <Printer className="h-4 w-4" />
          </button>

          <button
            type="button"
            title="Delete"
            aria-label="Delete"
            onClick={() => {
              if (!window.confirm(`Delete "${title}"?`)) return
              deleteMutation.mutate()
            }}
            disabled={deleteMutation.isPending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 transition hover:bg-red-500/15 disabled:opacity-55"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <RichDocumentEditor content={content} editable={mode === 'edit'} onChange={onEditorChange} />
    </div>
  )
}

export function DocsDocumentPage() {
  const params = useParams()
  const docId = params.docId

  const docQuery = useQuery({
    queryKey: ['doc', docId],
    enabled: Boolean(docId),
    queryFn: async () => {
      if (!docId) throw new Error('Missing document')
      const res = await getDoc(docId)
      return res.data
    },
  })

  if (docQuery.isPending) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-64 animate-pulse rounded bg-bg-hover" />
        <div className="rounded-lg border border-border-subtle bg-bg-card p-4">
          <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
          <div className="mt-4 h-[520px] animate-pulse rounded bg-bg-hover" />
        </div>
      </div>
    )
  }

  if (docQuery.isError || !docQuery.data) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {getErrorMessage(docQuery.error, 'Could not load document')}
      </div>
    )
  }

  return <DocumentWorkspace key={docQuery.data.id} doc={docQuery.data} />
}
