import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { format, formatDistanceToNow } from 'date-fns'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Grid2X2,
  List,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react'

import { getClient } from '../api/clients'
import { createDoc, createDocCategory, listDocCategories, listDocs } from '../api/docs'
import type { Document } from '../types/docs'

type ViewMode = 'grid' | 'list'
type SortMode = '-updated_at' | 'title' | '-created_at'

function formatUpdated(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return formatDistanceToNow(date, { addSuffix: true })
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return format(date, 'MMM d, yyyy')
}

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

function getPreview(doc: Document) {
  return doc.content_text.trim() || 'No preview yet.'
}

export function DocsClientLibraryPage() {
  const navigate = useNavigate()
  const params = useParams()
  const clientId = params.clientId
  const queryClient = useQueryClient()

  const [isNewOpen, setIsNewOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('-updated_at')
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('daftar-docs-view')
    return saved === 'list' ? 'list' : 'grid'
  })

  const docsParams = useMemo(
    () => ({
      client_id: clientId || undefined,
      search: search.trim() || undefined,
      ordering: sort,
    }),
    [clientId, search, sort],
  )

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      if (!clientId) throw new Error('Missing client')
      const res = await getClient(clientId)
      return res.data
    },
  })

  const docsQuery = useQuery({
    queryKey: ['docs', docsParams],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const res = await listDocs(docsParams)
      return res.data
    },
  })

  const categoriesQuery = useQuery({
    queryKey: ['doc-categories'],
    queryFn: async () => {
      const res = await listDocCategories()
      return res.data
    },
  })

  const docs = docsQuery.data?.results ?? []

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Missing client')
      const nextTitle = title.trim()
      if (!nextTitle) throw new Error('Title is required')

      let nextCategoryId = categoryId || null
      const categoryName = newCategoryName.trim()
      if (categoryName) {
        const createdCategory = await createDocCategory({
          name: categoryName,
          color: '#6366f1',
          icon: 'book-open',
        })
        nextCategoryId = createdCategory.data.id
      }

      const res = await createDoc({
        title: nextTitle,
        client_id: clientId,
        category_id: nextCategoryId,
      })
      return res.data
    },
    onSuccess: (doc) => {
      setIsNewOpen(false)
      setTitle('')
      setCategoryId('')
      setNewCategoryName('')
      queryClient.invalidateQueries({ queryKey: ['docs'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['doc-categories'] })
      toast.success('Document created')
      navigate(`/docs/${encodeURIComponent(doc.id)}`)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Could not create document'))
    },
  })

  function setAndStoreViewMode(nextViewMode: ViewMode) {
    setViewMode(nextViewMode)
    localStorage.setItem('daftar-docs-view', nextViewMode)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/docs')}
            className="mb-3 inline-flex h-8 items-center gap-2 rounded-md border border-border-subtle bg-bg-secondary px-3 text-xs text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Clients
          </button>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
            <BookOpen className="h-4 w-4" />
            Documentation
          </div>
          <h1 className="mt-2 text-2xl font-semibold">{clientQuery.data?.name ?? 'Client library'}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {clientQuery.isPending
              ? 'Loading...'
              : clientQuery.isError
                ? getErrorMessage(clientQuery.error, 'Could not load client')
                : `${docs.length} documents`}
          </p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <label className="relative w-full md:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents"
              className="h-10 w-full rounded-lg border border-border-subtle bg-bg-card pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
            />
          </label>

          <div className="flex items-center gap-2">
            <label className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                className="h-10 rounded-lg border border-border-subtle bg-bg-card pl-9 pr-8 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
              >
                <option value="-updated_at">Recently updated</option>
                <option value="title">Title</option>
                <option value="-created_at">Recently created</option>
              </select>
            </label>
            <div className="flex h-10 overflow-hidden rounded-lg border border-border-subtle bg-bg-card">
              <button
                type="button"
                title="Grid view"
                aria-label="Grid view"
                onClick={() => setAndStoreViewMode('grid')}
                className={[
                  'inline-flex w-10 items-center justify-center transition',
                  viewMode === 'grid' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary',
                ].join(' ')}
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="List view"
                aria-label="List view"
                onClick={() => setAndStoreViewMode('list')}
                className={[
                  'inline-flex w-10 items-center justify-center border-l border-border-subtle transition',
                  viewMode === 'list' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary',
                ].join(' ')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsNewOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-primary px-4 text-sm font-medium text-white transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>
        </div>
      </div>

      {isNewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-border-subtle bg-bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">New document</div>
                <div className="mt-1 text-sm text-text-secondary">Create a client runbook or support note.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsNewOpen(false)
                  setTitle('')
                  setCategoryId('')
                  setNewCategoryName('')
                }}
                className="rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-text-muted">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-text-muted">Category</span>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
                >
                  <option value="">General</option>
                  {(categoriesQuery.data?.results ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-text-muted">New category</span>
                <input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Optional"
                  className="mt-1 h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsNewOpen(false)
                  setTitle('')
                  setCategoryId('')
                  setNewCategoryName('')
                }}
                className="inline-flex h-10 items-center rounded-lg border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary transition hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="inline-flex h-10 items-center rounded-lg bg-accent-primary px-4 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {docsQuery.isPending ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-border-subtle bg-bg-card p-4">
              <div className="h-4 w-40 animate-pulse rounded bg-bg-hover" />
              <div className="mt-4 h-3 w-full animate-pulse rounded bg-bg-hover" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-bg-hover" />
            </div>
          ))}
        </div>
      ) : docsQuery.isError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {getErrorMessage(docsQuery.error, 'Could not load documents')}
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-bg-card p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-text-muted" />
          <div className="mt-3 text-sm font-medium">No documents yet</div>
          <div className="mt-1 text-sm text-text-secondary">Create the first reusable note for this client.</div>
          <button
            type="button"
            onClick={() => setIsNewOpen(true)}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-accent-primary px-4 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            New document
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {docs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => navigate(`/docs/${encodeURIComponent(doc.id)}`)}
              className="group min-h-[180px] rounded-lg border border-border-subtle bg-bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-accent-primary/40 hover:bg-bg-hover"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text-primary">{doc.title}</div>
                  <div className="mt-1 text-xs text-text-muted">{formatUpdated(doc.updated_at)}</div>
                </div>
                <div className="rounded-md border border-border-subtle bg-bg-secondary p-2 text-text-muted group-hover:text-text-primary">
                  <FileText className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-text-secondary">{getPreview(doc)}</p>
              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-text-muted">
                <span>{doc.category?.name ?? 'General'}</span>
                <span>{formatDate(doc.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-card">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-border-subtle bg-bg-secondary text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Category</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Updated</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {docs.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => navigate(`/docs/${encodeURIComponent(doc.id)}`)}
                  className="cursor-pointer transition hover:bg-bg-hover"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{doc.title}</div>
                    <div className="mt-1 line-clamp-1 text-xs text-text-muted">{getPreview(doc)}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">
                    {doc.category?.name ?? 'General'}
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">{formatUpdated(doc.updated_at)}</td>
                  <td className="px-4 py-3 text-right text-text-muted">
                    <FileText className="ml-auto h-4 w-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
