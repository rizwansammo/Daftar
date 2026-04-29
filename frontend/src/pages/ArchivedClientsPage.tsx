import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'

import { purgeClientWithPassword, restoreClient, listClients } from '../api/clients'
import { useAuthStore } from '../store/auth'

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

export function ArchivedClientsPage() {
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.me)
  const isManager = me?.role === 'ADMIN'

  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [isPurgeOpen, setIsPurgeOpen] = useState(false)
  const [purgePassword, setPurgePassword] = useState('')

  const params = useMemo(() => search.trim(), [search])

  const query = useQuery({
    queryKey: ['clients', 'archived', params],
    queryFn: async () => {
      const res = await listClients(params || undefined, { archived: true })
      return res.data
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!isManager) throw new Error('Only managers can restore clients')
      if (selectedIds.length === 0) throw new Error('Select at least one client')
      await Promise.all(selectedIds.map((id) => restoreClient(id)))
    },
    onSuccess: () => {
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client(s) restored')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not restore clients')
    },
  })

  const purgeMutation = useMutation({
    mutationFn: async () => {
      if (!isManager) throw new Error('Only managers can delete clients')
      const password = purgePassword.trim()
      if (!password) throw new Error('Password is required')
      if (selectedIds.length === 0) throw new Error('Select at least one client')

      await Promise.all(selectedIds.map((id) => purgeClientWithPassword(id, password)))
    },
    onSuccess: () => {
      setIsPurgeOpen(false)
      setPurgePassword('')
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client(s) deleted')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not delete clients'))
    },
  })

  const errorMessage = (() => {
    if (!query.isError) return null
    return getErrorMessage(query.error, 'Could not load clients')
  })()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold">Archived</div>
          <div className="mt-1 text-sm text-text-secondary">Archived clients. Restore or permanently delete.</div>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-end">
          {isManager && selectedIds.length > 0 ? (
            <button
              type="button"
              onClick={() => restoreMutation.mutate()}
              disabled={restoreMutation.isPending}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm font-medium text-text-primary hover:bg-bg-hover disabled:opacity-60"
            >
              {restoreMutation.isPending ? 'Restoring...' : `Restore (${selectedIds.length})`}
            </button>
          ) : null}

          {isManager && selectedIds.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsPurgeOpen(true)}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete ({selectedIds.length})
            </button>
          ) : null}

          <div className="w-full md:w-[420px]">
            <label className="text-xs font-medium text-text-secondary">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              className="mt-2 h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
              placeholder="Search archived clients"
            />
          </div>
        </div>
      </div>

      {isPurgeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[520px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Delete permanently</div>
                <div className="mt-1 text-sm text-text-secondary">
                  Enter your password to permanently delete {selectedIds.length} client(s).
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPurgeOpen(false)
                  setPurgePassword('')
                }}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Password</label>
                <input
                  value={purgePassword}
                  onChange={(e) => setPurgePassword(e.target.value)}
                  type="password"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="Your password"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsPurgeOpen(false)
                  setPurgePassword('')
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => purgeMutation.mutate()}
                disabled={purgeMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {purgeMutation.isPending ? 'Deleting...' : 'Confirm delete'}
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
          <div className="text-sm font-medium">No archived clients found</div>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
