import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { getDashboardStats } from '../api/dashboard'
import { useAuthStore } from '../store/auth'

function formatHhMm(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function formatUptime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const days = Math.floor(s / 86400)
  const hh = Math.floor((s % 86400) / 3600)
  const mm = Math.floor((s % 3600) / 60)
  if (days > 0) return `${days}d ${hh}h ${mm}m`
  if (hh > 0) return `${hh}h ${mm}m`
  return `${mm}m`
}

function TrendBars({ points }: { points: { date: string | null; seconds: number }[] }) {
  const max = useMemo(() => Math.max(1, ...points.map((p) => p.seconds)), [points])
  return (
    <div className="flex h-20 items-end gap-1">
      {points.map((p, idx) => (
        <div
          key={`${p.date ?? 'x'}-${idx}`}
          className="w-2 rounded bg-accent-primary/70"
          style={{ height: `${Math.max(4, Math.round((p.seconds / max) * 80))}px` }}
          title={`${p.date ?? ''} • ${formatHhMm(p.seconds)}`}
        />
      ))}
    </div>
  )
}

export function DashboardPage() {
  useAuthStore((s) => s.me)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [q, setQ] = useState('')
  const [submittedQ, setSubmittedQ] = useState('')

  const statsQuery = useQuery({
    queryKey: ['dashboard', { date, q: submittedQ }],
    queryFn: async () => {
      const res = await getDashboardStats({ date, q: submittedQ || undefined })
      return res.data
    },
  })

  const data = statsQuery.data
  const manager = data?.manager ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold">Dashboard</div>
          <div className="mt-1 text-sm text-text-secondary">Work hours, docs coverage, and system status.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium text-text-secondary">Date</div>
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              type="date"
              className="h-9 rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
            />
          </div>
        </div>
      </div>

      {statsQuery.isPending ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded bg-bg-hover" />
            ))}
          </div>
        </div>
      ) : statsQuery.isError ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="text-sm font-medium">Could not load dashboard</div>
          <div className="mt-1 text-sm text-text-secondary">Please refresh the page.</div>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
              <div className="text-xs text-text-muted">My hours ({data.selected_date})</div>
              <div className="mt-2 text-2xl font-semibold">{formatHhMm(data.agent.hours.today_seconds)}</div>
              <div className="mt-2 text-xs text-text-secondary">Based on time entries</div>
            </div>
            <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
              <div className="text-xs text-text-muted">My hours this week</div>
              <div className="mt-2 text-2xl font-semibold">{formatHhMm(data.agent.hours.week_seconds)}</div>
              <div className="mt-2 text-xs text-text-secondary">Mon → selected day</div>
            </div>
            <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
              <div className="text-xs text-text-muted">System uptime</div>
              <div className="mt-2 text-2xl font-semibold">{formatUptime(data.system.uptime_seconds)}</div>
              <div className="mt-2 text-xs text-text-secondary">Version: {data.system.version ?? '—'}</div>
            </div>
            <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
              <div className="text-xs text-text-muted">Quick links</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  to="/tickets/clients"
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary text-sm text-text-primary hover:bg-bg-hover"
                >
                  Tickets
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary text-sm text-text-primary hover:bg-bg-hover"
                >
                  Docs
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">My trend</div>
                  <div className="mt-1 text-xs text-text-secondary">Last {data.trend_days} days</div>
                </div>
                <div className="text-xs text-text-secondary">Total: {formatHhMm(data.agent.trend.reduce((a, p) => a + p.seconds, 0))}</div>
              </div>
              <div className="mt-4">
                <TrendBars points={data.agent.trend} />
              </div>
            </div>

            {manager ? (
              <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Team trend</div>
                    <div className="mt-1 text-xs text-text-secondary">Last {data.trend_days} days</div>
                  </div>
                  <div className="text-xs text-text-secondary">
                    Total: {formatHhMm((manager?.trend ?? []).reduce((a, p) => a + p.seconds, 0))}
                  </div>
                </div>
                <div className="mt-4">
                  <TrendBars points={manager?.trend ?? []} />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
                <div className="text-sm font-medium">Docs</div>
                <div className="mt-1 text-xs text-text-secondary">Jump into documentation work</div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    to="/docs"
                    className="inline-flex h-9 items-center justify-center rounded-xl bg-accent-primary text-sm font-medium text-white hover:bg-accent-hover"
                  >
                    Open Docs
                  </Link>
                  <Link
                    to="/clients"
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary text-sm text-text-primary hover:bg-bg-hover"
                  >
                    Clients
                  </Link>
                </div>
              </div>
            )}
          </div>

          {manager ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-border-subtle bg-bg-card p-4 lg:col-span-1">
                <div className="text-sm font-medium">Agent leaderboard</div>
                <div className="mt-1 text-xs text-text-secondary">Selected day</div>
                <div className="mt-4 space-y-2">
                  {(manager?.leaderboard ?? []).slice(0, 10).map((row, idx) => (
                    <div key={row.user_id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-text-primary">
                          {idx + 1}. {row.name}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-text-secondary">{formatHhMm(row.seconds)}</div>
                    </div>
                  ))}
                  {(manager?.leaderboard ?? []).length === 0 ? (
                    <div className="text-sm text-text-secondary">No time entries yet.</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-border-subtle bg-bg-card p-4 lg:col-span-2">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-sm font-medium">Documentation status</div>
                    <div className="mt-1 text-xs text-text-secondary">Coverage and recent edits</div>
                  </div>
                  <form
                    className="flex w-full max-w-[420px] gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      setSubmittedQ(q.trim())
                    }}
                  >
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search docs…"
                      className="h-9 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
                    />
                    <button
                      type="submit"
                      className="h-9 rounded-xl bg-accent-primary px-3 text-sm font-medium text-white hover:bg-accent-hover"
                    >
                      Search
                    </button>
                  </form>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary p-3">
                    <div className="text-xs text-text-muted">Docs created this week</div>
                    <div className="mt-2 text-2xl font-semibold">{manager?.docs.created_this_week ?? 0}</div>
                    <div className="mt-2 text-xs text-text-secondary">
                      Runbook category: {manager?.docs.runbook_category_exists ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary p-3 md:col-span-2">
                    <div className="text-xs font-medium text-text-secondary">Docs updated recently</div>
                    <div className="mt-2 space-y-1">
                      {(manager?.docs.updated_recently ?? []).slice(0, 6).map((d) => (
                        <Link
                          key={d.id}
                          to={`/docs/${d.id}`}
                          className="block truncate text-sm text-text-primary hover:underline"
                        >
                          {d.title || 'Untitled'}
                          <span className="text-xs text-text-muted">{d.last_edited_by ? ` • ${d.last_edited_by}` : ''}</span>
                        </Link>
                      ))}
                      {(manager?.docs.updated_recently ?? []).length === 0 ? (
                        <div className="text-sm text-text-secondary">No docs yet.</div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary p-3">
                    <div className="text-xs font-medium text-text-secondary">Who added docs ({data.selected_date})</div>
                    <div className="mt-2 space-y-1">
                      {(manager?.docs.created_today ?? []).slice(0, 8).map((d) => (
                        <Link
                          key={d.id}
                          to={`/docs/${d.id}`}
                          className="block truncate text-sm text-text-primary hover:underline"
                        >
                          {d.title || 'Untitled'}
                          <span className="text-xs text-text-muted">{d.author ? ` • ${d.author}` : ''}</span>
                        </Link>
                      ))}
                      {(manager?.docs.created_today ?? []).length === 0 ? (
                        <div className="text-sm text-text-secondary">No docs created today.</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border-subtle bg-bg-secondary p-3">
                    <div className="text-xs font-medium text-text-secondary">Clients missing Runbook</div>
                    <div className="mt-2 space-y-1">
                      {(manager?.docs.clients_missing_runbook ?? []).slice(0, 10).map((c) => (
                        <Link
                          key={c.id}
                          to={`/docs/clients/${c.id}`}
                          className="block truncate text-sm text-text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                      ))}
                      {(manager?.docs.clients_missing_runbook ?? []).length === 0 ? (
                        <div className="text-sm text-text-secondary">All covered (or no Runbook category).</div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {submittedQ.trim() ? (
                  <div className="mt-4 rounded-xl border border-border-subtle bg-bg-secondary p-3">
                    <div className="text-xs font-medium text-text-secondary">Search results</div>
                    <div className="mt-2 space-y-1">
                      {(manager?.search.results ?? []).map((d) => (
                        <Link
                          key={d.id}
                          to={`/docs/${d.id}`}
                          className="block truncate text-sm text-text-primary hover:underline"
                        >
                          {d.title || 'Untitled'}
                        </Link>
                      ))}
                      {(manager?.search.results ?? []).length === 0 ? (
                        <div className="text-sm text-text-secondary">No matches.</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
