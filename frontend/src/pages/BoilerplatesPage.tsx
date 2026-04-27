import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowLeft, Copy, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'

import { createBoilerplate, listBoilerplates, updateBoilerplate } from '../api/boilerplates'
import { getClient, listClients } from '../api/clients'
import type { Boilerplate } from '../types/boilerplates'

function getErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const data = err.response?.data as { message?: string; errors?: unknown; detail?: unknown } | undefined
    const detail =
      (typeof data?.detail === 'string' && data.detail) ||
      (typeof data?.message === 'string' && data.message) ||
      (data?.errors ? JSON.stringify(data.errors) : null)
    return detail ? `Request failed (${status}): ${detail}` : `Request failed (${status})`
  }
  return fallback
}

export function BoilerplatesPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { clientId } = useParams<{ clientId?: string }>()

  const [clientSearch, setClientSearch] = useState('')
  const [boilerplateSearch, setBoilerplateSearch] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createContent, setCreateContent] = useState('')

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  const [detailItem, setDetailItem] = useState<Boilerplate | null>(null)

  const clientQueryText = useMemo(() => clientSearch.trim(), [clientSearch])
  const boilerplateQueryText = useMemo(() => boilerplateSearch.trim(), [boilerplateSearch])

  const clientsQuery = useQuery({
    queryKey: ['boilerplate-clients', clientQueryText],
    enabled: !clientId,
    queryFn: async () => {
      const res = await listClients(clientQueryText || undefined)
      return res.data
    },
  })

  const selectedClientQuery = useQuery({
    queryKey: ['client', clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      if (!clientId) throw new Error('Missing client')
      const res = await getClient(clientId)
      return res.data
    },
  })

  const boilerplatesQuery = useQuery({
    queryKey: ['boilerplates', clientId, boilerplateQueryText],
    enabled: Boolean(clientId),
    queryFn: async () => {
      if (!clientId) throw new Error('Missing client')
      const res = await listBoilerplates({
        search: boilerplateQueryText || undefined,
        clientId,
      })
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Missing client')
      const title = createTitle.trim()
      if (!title) throw new Error('Title is required')
      const res = await createBoilerplate({
        client_id: clientId,
        title,
        content: createContent,
      })
      return res.data
    },
    onSuccess: () => {
      setIsCreateOpen(false)
      setCreateTitle('')
      setCreateContent('')
      queryClient.invalidateQueries({ queryKey: ['boilerplates'] })
      queryClient.invalidateQueries({ queryKey: ['boilerplate-clients'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Boilerplate created')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not create boilerplate'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editId) throw new Error('Missing boilerplate')
      const title = editTitle.trim()
      if (!title) throw new Error('Title is required')
      const res = await updateBoilerplate(editId, {
        title,
        content: editContent,
      })
      return res.data
    },
    onSuccess: () => {
      setIsEditOpen(false)
      setEditId(null)
      setEditTitle('')
      setEditContent('')
      queryClient.invalidateQueries({ queryKey: ['boilerplates'] })
      toast.success('Boilerplate updated')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not update boilerplate'))
    },
  })

  const toggleCheckMutation = useMutation({
    mutationFn: async (item: Boilerplate) => {
      const res = await updateBoilerplate(item.id, { is_checked: !item.is_checked })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boilerplates'] })
      queryClient.invalidateQueries({ queryKey: ['boilerplate-clients'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not update checkbox'))
    },
  })

  function openEdit(item: Boilerplate) {
    setDetailItem(null)
    setEditId(item.id)
    setEditTitle(item.title)
    setEditContent(item.content)
    setIsEditOpen(true)
  }

  async function copyDetailText() {
    if (!detailItem) return
    try {
      await navigator.clipboard.writeText(detailItem.content || '')
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy')
    }
  }

  if (!clientId) {
    const clients = clientsQuery.data?.results ?? []
    const clientsError = clientsQuery.isError ? getErrorMessage(clientsQuery.error, 'Could not load clients') : null

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-2xl font-semibold">Boilerplate</div>
            <div className="mt-1 text-sm text-text-secondary">Choose a client to manage canned messages.</div>
          </div>
          <div className="w-full md:w-[420px]">
            <label className="text-xs font-medium text-text-secondary">Search</label>
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              type="text"
              className="mt-2 h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
              placeholder="Search clients"
            />
          </div>
        </div>

        {clientsQuery.isPending ? (
          <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
            <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded bg-bg-hover" />
              ))}
            </div>
          </div>
        ) : clientsQuery.isError ? (
          <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
            <div className="text-sm font-medium">Could not load clients</div>
            <div className="mt-1 text-sm text-text-secondary">{clientsError}</div>
          </div>
        ) : clients.length === 0 ? (
          <div className="rounded-xl border border-border-subtle bg-bg-card p-6 text-center">
            <div className="text-sm font-medium">No clients found</div>
            <div className="mt-1 text-sm text-text-secondary">Try a different search.</div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-subtle text-xs text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Client Name</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="cursor-pointer hover:bg-bg-hover/50"
                    onClick={() => navigate(`/boilerplates/clients/${encodeURIComponent(client.id)}`)}
                  >
                    <td className="px-4 py-3 font-medium text-text-primary">{client.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{client.boilerplate_count ?? 0} boilerplates</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const boilerplates = boilerplatesQuery.data?.results ?? []
  const boilerplatesError = boilerplatesQuery.isError
    ? getErrorMessage(boilerplatesQuery.error, 'Could not load boilerplates')
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/boilerplates')}
            className="mb-3 inline-flex h-8 items-center gap-2 rounded-md border border-border-subtle bg-bg-secondary px-3 text-xs text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Clients
          </button>
          <div className="text-2xl font-semibold">{selectedClientQuery.data?.name ?? 'Boilerplate'}</div>
          <div className="mt-1 text-sm text-text-secondary">
            Store reusable canned messages with placeholders for this client.
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-end">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover"
          >
            New boilerplate
          </button>
          <div className="w-full md:w-[420px]">
            <label className="text-xs font-medium text-text-secondary">Search</label>
            <input
              value={boilerplateSearch}
              onChange={(e) => setBoilerplateSearch(e.target.value)}
              type="text"
              className="mt-2 h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
              placeholder="Search by title"
            />
          </div>
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[640px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Create boilerplate</div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Title</label>
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="Example: VPN setup response"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Message</label>
                <textarea
                  value={createContent}
                  onChange={(e) => setCreateContent(e.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="Use placeholders like {Name}, {Email}, {TicketNumber}"
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[640px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Edit boilerplate</div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Message</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[680px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{detailItem.title}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyDetailText}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-bg-secondary text-text-primary hover:bg-bg-hover"
                  aria-label="Copy message"
                  title="Copy message"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(detailItem)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-bg-secondary text-text-primary hover:bg-bg-hover"
                  aria-label="Edit boilerplate"
                  title="Edit boilerplate"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="text-sm text-text-secondary hover:text-text-primary"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border-subtle bg-bg-secondary p-4">
              <pre className="whitespace-pre-wrap break-words text-sm text-text-primary">{detailItem.content}</pre>
            </div>
          </div>
        </div>
      ) : null}

      {selectedClientQuery.isError ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="text-sm font-medium">Could not load client</div>
          <div className="mt-1 text-sm text-text-secondary">
            {getErrorMessage(selectedClientQuery.error, 'Could not load client')}
          </div>
        </div>
      ) : null}

      {boilerplatesQuery.isPending ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-bg-hover" />
            ))}
          </div>
        </div>
      ) : boilerplatesQuery.isError ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="text-sm font-medium">Could not load boilerplates</div>
          <div className="mt-1 text-sm text-text-secondary">{boilerplatesError}</div>
        </div>
      ) : boilerplates.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-6 text-center">
          <div className="text-sm font-medium">No boilerplates yet</div>
          <div className="mt-1 text-sm text-text-secondary">Create your first canned message for this client.</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle text-xs text-text-muted">
              <tr>
                <th className="w-14 px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Title</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {boilerplates.map((item) => (
                <tr key={item.id} className="hover:bg-bg-hover">
                  <td className="px-4 py-3">
                    <input
                      checked={item.is_checked}
                      onChange={() => toggleCheckMutation.mutate(item)}
                      type="checkbox"
                      className="h-4 w-4 rounded border border-border-subtle bg-bg-secondary accent-accent-primary"
                      aria-label={`Mark ${item.title}`}
                    />
                  </td>
                  <td
                    className="cursor-pointer px-4 py-3"
                    onClick={() => setDetailItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setDetailItem(item)
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="font-medium text-text-primary">{item.title}</div>
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
