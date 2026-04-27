import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, FileText, Search, Users } from 'lucide-react'

import { listClients } from '../api/clients'

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data as { message?: string; errors?: unknown; detail?: unknown } | undefined
    const detail =
      (typeof data?.detail === 'string' && data.detail) ||
      (typeof data?.message === 'string' && data.message) ||
      (data?.errors ? JSON.stringify(data.errors) : null)

    return detail ? `Request failed (${status}): ${detail}` : `Request failed (${status})`
  }

  return 'Could not load clients'
}

export function DocsClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const params = useMemo(() => search.trim(), [search])

  const query = useQuery({
    queryKey: ['clients', params],
    queryFn: async () => {
      const res = await listClients(params || undefined)
      return res.data
    },
  })

  const clients = query.data?.results ?? []
  const totalDocs = clients.reduce((sum, client) => sum + (client.doc_count ?? 0), 0)
  const documentedClients = clients.filter((client) => (client.doc_count ?? 0) > 0).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
            <BookOpen className="h-4 w-4" />
            Knowledge base
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Documentation</h1>
          <p className="mt-1 text-sm text-text-secondary">Client runbooks, fixes, and implementation notes.</p>
        </div>

        <label className="relative w-full xl:w-[420px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search clients"
            className="h-10 w-full rounded-lg border border-border-subtle bg-bg-card pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border-subtle bg-bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-muted">Clients</div>
            <Users className="h-4 w-4 text-text-muted" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{clients.length}</div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-muted">Documents</div>
            <FileText className="h-4 w-4 text-text-muted" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{totalDocs}</div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-muted">Documented</div>
            <BookOpen className="h-4 w-4 text-text-muted" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{documentedClients}</div>
        </div>
      </div>

      {query.isPending ? (
        <div className="rounded-lg border border-border-subtle bg-bg-card p-4">
          <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded bg-bg-hover" />
            ))}
          </div>
        </div>
      ) : query.isError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {getErrorMessage(query.error)}
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-bg-card p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-text-muted" />
          <div className="mt-3 text-sm font-medium">No clients found</div>
          <div className="mt-1 text-sm text-text-secondary">Try another search.</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-card">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-border-subtle bg-bg-secondary text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Documents</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Ticket load</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="cursor-pointer transition hover:bg-bg-hover"
                  onClick={() => navigate(`/docs/clients/${encodeURIComponent(client.id)}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-secondary text-sm font-semibold text-text-secondary">
                        {client.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-text-primary">{client.name}</div>
                        <div className="mt-0.5 text-xs text-text-muted md:hidden">{client.doc_count ?? 0} docs</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">{client.doc_count ?? 0}</td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">{client.ticket_count ?? 0}</td>
                  <td className="px-4 py-3 text-right text-text-muted">
                    <ChevronRight className="ml-auto h-4 w-4" />
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
