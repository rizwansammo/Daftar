import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

import { listClients } from '../api/clients'

function formatHours(seconds?: number) {
  const s = seconds ?? 0
  const hours = s / 3600
  return `${hours.toFixed(1)}h`
}

export function TicketsClientsPage() {
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

  const clients = query.data?.results ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold">Tickets</div>
          <div className="mt-1 text-sm text-text-secondary">Select a client to view tickets.</div>
        </div>

        <div className="w-full md:w-[360px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients"
            className="h-10 w-full rounded-xl border border-border-subtle bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
          />
        </div>
      </div>

      {query.isPending ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
          <div className="mt-4 space-y-3">
            <div className="h-8 animate-pulse rounded bg-bg-hover" />
            <div className="h-8 animate-pulse rounded bg-bg-hover" />
            <div className="h-8 animate-pulse rounded bg-bg-hover" />
          </div>
        </div>
      ) : errorMessage ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4 text-sm text-red-400">{errorMessage}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-border-subtle text-xs text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                  <th className="px-4 py-3 font-medium">Pending</th>
                  <th className="px-4 py-3 font-medium">Handed over</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
