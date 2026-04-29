import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'

import { archiveClient, createClient, listClients, updateClient } from '../api/clients'
import { useAuthStore } from '../store/auth'

export function ClientsPage() {
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.me)
  const isManager = me?.role === 'ADMIN'
  const [search, setSearch] = useState('')
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [renameClientId, setRenameClientId] = useState<string>('')
  const [renameName, setRenameName] = useState('')

  const params = useMemo(() => search.trim(), [search])

  const query = useQuery({
    queryKey: ['clients', params],
    queryFn: async () => {
      const res = await listClients(params || undefined)
      return res.data
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!isManager) throw new Error('Only managers can archive clients')
      if (selectedIds.length === 0) throw new Error('Select at least one client')
      await Promise.all(selectedIds.map((id) => archiveClient(id)))
    },
    onSuccess: () => {
      setIsArchiveOpen(false)
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client(s) archived')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not archive clients')
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const nextName = name.trim()
      if (!nextName) throw new Error('Client name is required')
      const res = await createClient({ name: nextName })
      return res.data
    },
    onSuccess: () => {
      setIsNewOpen(false)
      setName('')
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client created')
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string } | undefined)?.message
        toast.error(msg || 'Could not create client')
        return
      }
      toast.error('Could not create client')
    },
  })

  const renameMutation = useMutation({
    mutationFn: async () => {
      const clientId = renameClientId.trim()
      const nextName = renameName.trim()
      if (!clientId) throw new Error('Missing client')
      if (!nextName) throw new Error('Client name is required')
      const res = await updateClient(clientId, { name: nextName })
      return res.data
    },
    onSuccess: () => {
      setIsRenameOpen(false)
      setRenameClientId('')
      setRenameName('')
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client renamed')
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string } | undefined)?.message
        toast.error(msg || 'Could not rename client')
        return
      }
      toast.error(err instanceof Error ? err.message : 'Could not rename client')
    },
  })

  const errorMessage = (() => {
    if (!query.isError) return null
    const err = query.error
    if (axios.isAxiosError(err)) {
      const status = err.response?.status
      const data = err.response?.data as
        | { message?: string; errors?: unknown; detail?: unknown }
        | undefined

      const detail =
        (typeof data?.detail === 'string' && data.detail) ||
        (typeof data?.message === 'string' && data.message) ||
        (data?.errors ? JSON.stringify(data.errors) : null)

      return detail ? `Request failed (${status}): ${detail}` : `Request failed (${status})`
    }
    return 'Could not load clients'
  })()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold">Clients</div>
          <div className="mt-1 text-sm text-text-secondary">Client list with ticket and documentation totals.</div>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-end">
          {isManager && selectedIds.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsArchiveOpen(true)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm font-medium text-text-primary hover:bg-bg-hover"
            >
              Archive ({selectedIds.length})
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsNewOpen(true)}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover"
          >
            New client
          </button>
          <div className="w-full md:w-[420px]">
            <label className="text-xs font-medium text-text-secondary">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              className="mt-2 h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
              placeholder="Search clients"
            />
          </div>
        </div>
      </div>

      {isNewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[520px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">New client</div>
                <div className="mt-1 text-sm text-text-secondary">Create a client entry.</div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewOpen(false)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Client name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="Company name"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewOpen(false)}
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
                {createMutation.isPending ? 'Creating...' : 'Create client'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isArchiveOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[520px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Archive clients</div>
                <div className="mt-1 text-sm text-text-secondary">
                  Archive {selectedIds.length} selected client(s). You can restore them from Archived.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsArchiveOpen(false)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsArchiveOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {archiveMutation.isPending ? 'Archiving...' : 'Confirm archive'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isRenameOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[520px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Rename client</div>
                <div className="mt-1 text-sm text-text-secondary">Update the client name.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRenameOpen(false)
                  setRenameClientId('')
                  setRenameName('')
                }}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Client name</label>
                <input
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="Client name"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsRenameOpen(false)
                  setRenameClientId('')
                  setRenameName('')
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => renameMutation.mutate()}
                disabled={renameMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {renameMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {query.isPending ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-bg-hover" />
            ))}
          </div>
        </div>
      ) : query.isError ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="text-sm font-medium">Could not load clients</div>
          <div className="mt-1 text-sm text-text-secondary">{errorMessage}</div>
        </div>
      ) : (query.data?.results?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-6 text-center">
          <div className="text-sm font-medium">No clients found</div>
          <div className="mt-1 text-sm text-text-secondary">Try a different search.</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle text-xs text-text-muted">
              <tr>
                <th className="w-12 px-4 py-3 font-medium">
                  <input
                    type="checkbox"
                    checked={
                      (query.data?.results?.length ?? 0) > 0 &&
                      selectedIds.length === (query.data?.results?.length ?? 0)
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(query.data.results.map((c) => c.id))
                      } else {
                        setSelectedIds([])
                      }
                    }}
                    className="h-4 w-4 rounded border border-[rgb(var(--text-primary))]/70 bg-transparent accent-[rgb(var(--accent-primary))]"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Client Name</th>
                <th className="px-4 py-3 font-medium">Total Tickets</th>
                <th className="px-4 py-3 font-medium">Total Docs</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {query.data.results.map((client) => (
                <tr key={client.id} className="hover:bg-bg-hover/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(client.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds((prev) => (prev.includes(client.id) ? prev : [...prev, client.id]))
                        } else {
                          setSelectedIds((prev) => prev.filter((id) => id !== client.id))
                        }
                      }}
                      className="h-4 w-4 rounded border border-[rgb(var(--text-primary))]/70 bg-transparent accent-[rgb(var(--accent-primary))]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{client.name}</div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{client.ticket_count ?? 0}</td>
                  <td className="px-4 py-3 text-text-secondary">{client.doc_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRenameClientId(client.id)
                        setRenameName(client.name)
                        setIsRenameOpen(true)
                      }}
                      className="inline-flex h-8 items-center rounded-lg border border-border-subtle bg-bg-secondary px-3 text-xs font-medium text-text-primary hover:bg-bg-hover"
                    >
                      Rename
                    </button>
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
