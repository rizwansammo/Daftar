import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { createClient, deleteClientWithPassword, listClients, updateClient } from '../api/clients'

function formatHours(seconds?: number) {
  const s = seconds ?? 0
  const hours = s / 3600
  return `${hours.toFixed(1)}h`
}

export function ClientsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [name, setName] = useState('')

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deletePassword, setDeletePassword] = useState('')

  const params = useMemo(() => search.trim(), [search])

  const query = useQuery({
    queryKey: ['clients', params],
    queryFn: async () => {
      const res = await listClients(params || undefined)
      return res.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editId) throw new Error('Missing client')
      const n = editName.trim()
      if (!n) throw new Error('Client name is required')
      const res = await updateClient(editId, { name: n })
      return res.data
    },
    onSuccess: () => {
      setIsEditOpen(false)
      setEditId(null)
      setEditName('')
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client updated')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteId) throw new Error('Missing client')
      const pw = deletePassword
      if (!pw) throw new Error('Password required')
      const res = await deleteClientWithPassword(deleteId, pw)
      return res
    },
    onSuccess: () => {
      setIsDeleteOpen(false)
      setDeleteId(null)
      setDeletePassword('')
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client deleted')
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const n = name.trim()
      if (!n) throw new Error('Client name is required')
      const res = await createClient({ name: n })
      return res.data
    },
    onSuccess: () => {
      setIsNewOpen(false)
      setName('')
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client created')
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
          <div className="mt-1 text-sm text-text-secondary">Browse clients and their workload.</div>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-end">
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
                <div className="mt-1 text-sm text-text-secondary">Create a client to group tickets.</div>
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
                {createMutation.isPending ? 'Creating…' : 'Create client'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[520px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Edit client</div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-text-secondary">Client name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                type="text"
                className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
              />
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
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[520px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-red-200">Delete client</div>
                <div className="mt-1 text-sm text-text-secondary">Enter your password to confirm.</div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-text-secondary">Your password</label>
              <input
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-red-500 px-4 text-sm font-medium text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
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
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Completed</th>
                <th className="px-4 py-3 font-medium">Pending</th>
                <th className="px-4 py-3 font-medium">Handed over</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Hours</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {query.data.results.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer hover:bg-bg-hover"
                  onClick={() => navigate(`/tickets/clients/${encodeURIComponent(c.id)}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{c.name}</div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{c.completed_ticket_count ?? 0}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.pending_ticket_count ?? 0}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.handed_over_ticket_count ?? 0}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.ticket_count ?? 0}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatHours(c.total_time_seconds)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setEditId(c.id)
                          setEditName(c.name)
                          setIsEditOpen(true)
                        }}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-border-subtle bg-bg-secondary px-3 text-xs text-text-primary hover:bg-bg-hover"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDeleteId(c.id)
                          setDeletePassword('')
                          setIsDeleteOpen(true)
                        }}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-xs text-red-200 hover:bg-red-500/15"
                      >
                        Delete
                      </button>
                    </div>
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
