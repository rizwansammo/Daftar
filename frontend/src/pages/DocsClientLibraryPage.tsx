import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  Plus,
  Search,
} from 'lucide-react'

import { getClient } from '../api/clients'
import {
  createDoc,
  createDocCategory,
  getDocCategoryPath,
  listDocCategories,
  listDocs,
} from '../api/docs'

type DirectoryEntry =
  | {
      kind: 'folder'
      id: string
      title: string
      createdAt: string
    }
  | {
      kind: 'doc'
      id: string
      title: string
      createdAt: string
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

export function DocsClientLibraryPage() {
  const navigate = useNavigate()
  const params = useParams()
  const clientId = params.clientId
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentFolderId = (searchParams.get('folder') || '').trim() || null
  const [search, setSearch] = useState('')

  const [isNewDocOpen, setIsNewDocOpen] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false)
  const [newFolderTitle, setNewFolderTitle] = useState('')

  const trimmedSearch = useMemo(() => search.trim(), [search])

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      if (!clientId) throw new Error('Missing client')
      const res = await getClient(clientId)
      return res.data
    },
  })

  const breadcrumbQuery = useQuery({
    queryKey: ['doc-folder-path', currentFolderId],
    enabled: Boolean(currentFolderId),
    queryFn: async () => {
      const res = await getDocCategoryPath(currentFolderId!)
      return res.data
    },
  })

  const foldersQuery = useQuery({
    queryKey: ['doc-categories', clientId, currentFolderId, trimmedSearch],
    enabled: Boolean(clientId),
    queryFn: async () => {
      if (!clientId) throw new Error('Missing client')
      const res = await listDocCategories({
        client_id: clientId,
        parent_id: currentFolderId ?? '',
        search: trimmedSearch || undefined,
        ordering: 'name',
      })
      return res.data
    },
  })

  const docsQuery = useQuery({
    queryKey: ['docs', clientId, currentFolderId, trimmedSearch],
    enabled: Boolean(clientId),
    queryFn: async () => {
      if (!clientId) throw new Error('Missing client')
      const res = await listDocs({
        client_id: clientId,
        folder_id: currentFolderId ?? '',
        search: trimmedSearch || undefined,
        ordering: 'title',
      })
      return res.data
    },
  })

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Missing client')
      const title = newFolderTitle.trim()
      if (!title) throw new Error('Folder name is required')

      const response = await createDocCategory({
        name: title,
        icon: 'folder',
        client_id: clientId,
        parent_id: currentFolderId,
      })
      return response.data
    },
    onSuccess: () => {
      setIsNewFolderOpen(false)
      setNewFolderTitle('')
      queryClient.invalidateQueries({ queryKey: ['doc-categories'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['clients'], exact: false })
      toast.success('Folder created')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Could not create folder'))
    },
  })

  const createDocMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Missing client')
      const title = newDocTitle.trim()
      if (!title) throw new Error('Document title is required')

      const response = await createDoc({
        title,
        client_id: clientId,
        category_id: currentFolderId,
      })
      return response.data
    },
    onSuccess: (doc) => {
      setIsNewDocOpen(false)
      setNewDocTitle('')
      queryClient.invalidateQueries({ queryKey: ['docs'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['clients'], exact: false })
      toast.success('Document created')
      navigate(`/docs/${encodeURIComponent(doc.id)}`)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Could not create document'))
    },
  })

  const folders = foldersQuery.data?.results ?? []
  const docs = docsQuery.data?.results ?? []

  const entries = useMemo<DirectoryEntry[]>(() => {
    const folderEntries: DirectoryEntry[] = folders.map((folder) => ({
      kind: 'folder',
      id: folder.id,
      title: folder.name,
      createdAt: folder.created_at,
    }))
    const docEntries: DirectoryEntry[] = docs.map((doc) => ({
      kind: 'doc',
      id: doc.id,
      title: doc.title,
      createdAt: doc.updated_at,
    }))
    return [...folderEntries, ...docEntries]
  }, [docs, folders])

  const isLoading = foldersQuery.isPending || docsQuery.isPending
  const isError = foldersQuery.isError || docsQuery.isError
  const errorText = foldersQuery.isError
    ? getErrorMessage(foldersQuery.error, 'Could not load folders')
    : docsQuery.isError
      ? getErrorMessage(docsQuery.error, 'Could not load documents')
      : null

  const breadcrumb = breadcrumbQuery.data ?? []

  function openFolder(folderId: string) {
    const next = new URLSearchParams(searchParams)
    next.set('folder', folderId)
    setSearchParams(next, { replace: false })
  }

  function goRoot() {
    const next = new URLSearchParams(searchParams)
    next.delete('folder')
    setSearchParams(next, { replace: false })
  }

  function goToCrumb(folderId: string | null) {
    if (!folderId) {
      goRoot()
      return
    }
    const next = new URLSearchParams(searchParams)
    next.set('folder', folderId)
    setSearchParams(next, { replace: false })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate('/docs')}
            className="mb-3 inline-flex h-8 items-center gap-2 rounded-md border border-border-subtle bg-bg-secondary px-3 text-xs text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Clients
          </button>
          <h1 className="truncate text-2xl font-semibold">{clientQuery.data?.name ?? 'KB Docs'}</h1>
          <p className="mt-1 text-sm text-text-secondary">Folder and document directory for this client.</p>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <label className="relative w-full md:w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search current folder"
              className="h-10 w-full rounded-lg border border-border-subtle bg-bg-card pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
            />
          </label>

          <button
            type="button"
            onClick={() => setIsNewFolderOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-subtle bg-bg-card px-3 text-sm text-text-primary transition hover:bg-bg-hover"
          >
            <FolderPlus className="h-4 w-4" />
            Folder
          </button>

          <button
            type="button"
            onClick={() => setIsNewDocOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-primary px-4 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Doc
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => goToCrumb(null)}
          className="rounded-md px-2 py-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        >
          Root
        </button>
        {breadcrumb.map((node: { id: string; name: string }) => (
          <div key={node.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            <button
              type="button"
              onClick={() => goToCrumb(node.id)}
              className="rounded-md px-2 py-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              {node.name}
            </button>
          </div>
        ))}
      </div>

      {isNewFolderOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-[480px] rounded-lg border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="text-sm font-semibold">Create Folder</div>
            <div className="mt-1 text-sm text-text-secondary">This folder will be created in the current directory.</div>
            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-text-secondary">Folder name</label>
              <input
                value={newFolderTitle}
                onChange={(event) => setNewFolderTitle(event.target.value)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
              />
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewFolderOpen(false)}
                className="inline-flex h-10 items-center rounded-lg border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary transition hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createFolderMutation.mutate()}
                disabled={createFolderMutation.isPending}
                className="inline-flex h-10 items-center rounded-lg bg-accent-primary px-4 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
              >
                {createFolderMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isNewDocOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-[480px] rounded-lg border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="text-sm font-semibold">Create Document</div>
            <div className="mt-1 text-sm text-text-secondary">This document will be created in the current directory.</div>
            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-text-secondary">Title</label>
              <input
                value={newDocTitle}
                onChange={(event) => setNewDocTitle(event.target.value)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
              />
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewDocOpen(false)}
                className="inline-flex h-10 items-center rounded-lg border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary transition hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createDocMutation.mutate()}
                disabled={createDocMutation.isPending}
                className="inline-flex h-10 items-center rounded-lg bg-accent-primary px-4 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
              >
                {createDocMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-border-subtle bg-bg-card p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-bg-hover" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded bg-bg-hover" />
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorText}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-bg-card p-8 text-center">
          <Folder className="mx-auto h-8 w-8 text-text-muted" />
          <div className="mt-3 text-sm font-medium">This folder is empty</div>
          <div className="mt-1 text-sm text-text-secondary">Create a folder or a document to get started.</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-card">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-border-subtle bg-bg-secondary text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="w-[180px] px-4 py-3 font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {entries.map((entry) => (
                <tr
                  key={`${entry.kind}-${entry.id}`}
                  className="cursor-pointer transition hover:bg-bg-hover"
                  onClick={() =>
                    entry.kind === 'folder'
                      ? openFolder(entry.id)
                      : navigate(`/docs/${encodeURIComponent(entry.id)}`)
                  }
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-bg-secondary text-text-secondary">
                        {entry.kind === 'folder' ? <Folder className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </span>
                      <span className="font-medium text-text-primary">{entry.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{entry.kind === 'folder' ? 'Folder' : 'Document'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
