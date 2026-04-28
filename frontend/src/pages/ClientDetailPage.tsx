import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { getClient } from '../api/clients'
import { listUsers } from '../api/users'
import {
  addTicketNoteById,
  createTicket,
  createTimeEntry,
  deleteTicketById,
  listTicketNotes,
  listTickets,
  updateTicketNote,
  updateTicket,
} from '../api/tickets'
import { useAuthStore } from '../store/auth'

function formatHours(seconds?: number) {
  const s = seconds ?? 0
  const hours = s / 3600
  return `${hours.toFixed(1)}h`
}

function formatCreated(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatWorked(seconds?: number) {
  const s = Math.max(0, Math.floor(seconds ?? 0))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function ticketLevel(priority: string) {
  if (priority === 'HIGH' || priority === 'URGENT') return 'L3'
  if (priority === 'NORMAL') return 'L2'
  return 'L1'
}

function ticketLabel(ticket: { ticket?: string; ticket_number?: string; title?: string }) {
  const merged = (ticket.ticket || '').trim()
  if (merged) return merged
  const number = (ticket.ticket_number || '').trim()
  const title = (ticket.title || '').trim()
  if (number && title) return `${number} - ${title}`
  return number || title
}

function getAssignedAgentLabel(ticket: { assigned_agent: { display_name?: string; full_name?: string; email?: string } | null }) {
  const agent = ticket.assigned_agent
  if (!agent) return 'Unassigned'
  return agent.display_name || agent.full_name || agent.email || 'Unassigned'
}

function getAssignedAgentFirstName(ticket: { assigned_agent: { display_name?: string; full_name?: string; email?: string } | null }) {
  const label = getAssignedAgentLabel(ticket)
  if (label === 'Unassigned') return label
  const firstPart = label.split(/\s+/).filter(Boolean)[0]
  if (firstPart) return firstPart
  const emailPrefix = label.split('@')[0]
  return emailPrefix || label
}

function parseDurationToSeconds(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (trimmed.includes(':')) {
    const [hhRaw, mmRaw] = trimmed.split(':')
    const hh = Number.parseInt((hhRaw || '').trim(), 10)
    const mm = Number.parseInt((mmRaw || '').trim(), 10)
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || mm < 0 || mm >= 60) return null
    const seconds = hh * 3600 + mm * 60
    return seconds > 0 ? seconds : null
  }

  const hoursFloat = Number.parseFloat(trimmed)
  if (!Number.isFinite(hoursFloat) || hoursFloat <= 0) return null
  return Math.round(hoursFloat * 3600)
}

function Badge(props: { children: string; tone?: 'muted' | 'danger' | 'warning' | 'ok' }) {
  const tone = props.tone ?? 'muted'
  const cls =
    tone === 'danger'
      ? 'bg-[rgb(var(--danger))]/25 text-[rgb(var(--danger))] ring-[rgb(var(--danger))]/45'
      : tone === 'warning'
        ? 'bg-[rgb(var(--warning))]/25 text-[rgb(var(--warning))] ring-[rgb(var(--warning))]/45'
        : tone === 'ok'
          ? 'bg-[rgb(var(--success))]/25 text-[rgb(var(--success))] ring-[rgb(var(--success))]/45'
          : 'bg-white/5 text-text-secondary ring-border-subtle'

  return (
    <span className={[cls, 'inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1'].join(' ')}>
      {props.children}
    </span>
  )
}

function statusTone(status: string) {
  if (status === 'COMPLETED') return 'ok'
  if (status === 'ESCALATED') return 'danger'
  if (status === 'IN_PROGRESS') return 'warning'
  return 'muted'
}

export function ClientDetailPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.me)

  const clientId = params.clientId
  const [search, setSearch] = useState('')

  const [isNewOpen, setIsNewOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [ticket, setTicket] = useState('')
  const [summary, setSummary] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH'>('LOW')
  const [status, setStatus] = useState<'COMPLETED' | 'PENDING' | 'ESCALATED'>('COMPLETED')
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [workDate, setWorkDate] = useState('')
  const [hoursWorked, setHoursWorked] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTicketId, setEditTicketId] = useState<string | null>(null)
  const [editTicketNumber, setEditTicketNumber] = useState('')
  const [editTicket, setEditTicket] = useState('')
  const [editStatus, setEditStatus] = useState<'COMPLETED' | 'PENDING' | 'ESCALATED'>('PENDING')
  const [editPriority, setEditPriority] = useState<'LOW' | 'NORMAL' | 'HIGH'>('LOW')
  const [editSteps, setEditSteps] = useState('')
  const [editNoteId, setEditNoteId] = useState<string | null>(null)
  const [editWorkDate, setEditWorkDate] = useState('')
  const [editHoursWorked, setEditHoursWorked] = useState('')

  const ticketParams = useMemo(() => {
    const trimmed = search.trim()
    return {
      client: clientId,
      search: trimmed.length ? trimmed : undefined,
      ordering: '-created_at',
    }
  }, [search, clientId])

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const res = await getClient(clientId as string)
      return res.data
    },
  })

  const agentsQuery = useQuery({
    queryKey: ['users', 'ticket-agent-picker'],
    queryFn: async () => {
      const res = await listUsers()
      return res.data.results
    },
  })

  const editNotesQuery = useQuery({
    queryKey: ['ticket-notes', editTicketId],
    enabled: Boolean(isEditOpen && editTicketId),
    queryFn: async () => {
      const res = await listTicketNotes(editTicketId!)
      return res.data
    },
  })

  useEffect(() => {
    if (!isEditOpen) return
    const notes = editNotesQuery.data ?? null
    if (!notes) return
    const last = notes.length ? notes[notes.length - 1] : null
    setEditNoteId(last?.id ?? null)
    setEditSteps(last?.content ?? '')
  }, [isEditOpen, editNotesQuery.data])

  const ticketsQuery = useQuery({
    queryKey: ['tickets', ticketParams],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const res = await listTickets(ticketParams)
      return res.data
    },
  })

  const expandedTicket = useMemo(() => {
    if (!expandedId) return null
    return ticketsQuery.data?.results.find((t) => t.id === expandedId) ?? null
  }, [expandedId, ticketsQuery.data])

  const detailTicket = useMemo(() => {
    if (!detailId) return null
    return ticketsQuery.data?.results.find((t) => t.id === detailId) ?? null
  }, [detailId, ticketsQuery.data])

  const notesQuery = useQuery({
    queryKey: ['ticket-notes', expandedTicket?.id],
    enabled: Boolean(expandedTicket?.id),
    queryFn: async () => {
      const res = await listTicketNotes(expandedTicket!.id)
      return res.data
    },
  })

  const detailNotesQuery = useQuery({
    queryKey: ['ticket-notes', detailTicket?.id],
    enabled: Boolean(detailTicket?.id),
    queryFn: async () => {
      const res = await listTicketNotes(detailTicket!.id)
      return res.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ticketIds: string[]) => {
      for (const id of ticketIds) {
        await deleteTicketById(id)
      }
    },
    onSuccess: () => {
      setSelected({})
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Tickets deleted')
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? ((err.response?.data as { detail?: unknown; message?: unknown } | undefined)?.detail as string) ||
          ((err.response?.data as { detail?: unknown; message?: unknown } | undefined)?.message as string) ||
          `Request failed (${err.response?.status ?? 'error'})`
        : 'Could not delete tickets'
      toast.error(msg)
    },
  })

  const selectedTicketNumbers = useMemo(() => {
    const all = ticketsQuery.data?.results ?? []
    const selectedIds = new Set(Object.entries(selected).filter(([, v]) => v).map(([k]) => k))
    return all.filter((t) => selectedIds.has(t.id)).map((t) => ticketLabel(t))
  }, [selected, ticketsQuery.data?.results])

  const selectedTicketIds = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => v)
      .map(([id]) => id)
  }, [selected])

  const selectedCount = useMemo(() => {
    return Object.values(selected).filter(Boolean).length
  }, [selected])

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editTicketNumber) throw new Error('Missing ticket')
      const nextTicket = editTicket.trim()
      if (!nextTicket) throw new Error('Ticket required')
      const res = await updateTicket(editTicketNumber, {
        ticket: nextTicket,
        status: editStatus,
        priority: editPriority,
      })

      const steps = editSteps.trim()
      if (steps) {
        if (editNoteId) {
          await updateTicketNote(editNoteId, steps)
        } else if (editTicketId) {
          await addTicketNoteById(editTicketId, steps)
        }
      }

      const wd = editWorkDate.trim()
      const hrs = editHoursWorked.trim()
      if (wd && hrs && editTicketId) {
        const seconds = parseDurationToSeconds(hrs)
        if (!seconds) {
          throw new Error('Time worked must be in HH:MM (e.g. 00:17)')
        }

        const base = new Date(`${wd}T09:00:00`)
        const started_at = new Date(base.getTime()).toISOString()
        const ended_at = new Date(base.getTime() + seconds * 1000).toISOString()
        await createTimeEntry({
          ticket_id: editTicketId,
          started_at,
          ended_at,
          note: 'Manual entry',
        })

        queryClient.setQueriesData({ queryKey: ['tickets'], exact: false }, (old: any) => {
          const results = old?.results
          if (!Array.isArray(results)) return old
          return {
            ...old,
            results: results.map((t: any) =>
              t?.id === editTicketId
                ? { ...t, total_time_seconds: (Number(t.total_time_seconds) || 0) + seconds }
                : t,
            ),
          }
        })

        queryClient.invalidateQueries({ queryKey: ['tickets'], exact: false })
      }

      return res.data
    },
    onSuccess: () => {
      setIsEditOpen(false)
      setEditTicketId(null)
      setEditTicketNumber('')
      setEditTicket('')
      setEditSteps('')
      setEditNoteId(null)
      setEditWorkDate('')
      setEditHoursWorked('')
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Ticket updated')
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? ((err.response?.data as { detail?: unknown; message?: unknown } | undefined)?.detail as string) ||
          ((err.response?.data as { detail?: unknown; message?: unknown } | undefined)?.message as string) ||
          `Request failed (${err.response?.status ?? 'error'})`
        : (err as Error).message
      toast.error(msg)
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Missing client id')
      const raw = ticket.trim()
      if (!raw) throw new Error('Missing fields')

      const created = await createTicket({
        ticket: raw,
        client_id: clientId,
        priority,
        status,
        assigned_agent_id: selectedAgentId || me?.id || null,
      })

      const createdTicket = created.data

      const s = summary.trim()
      if (s) {
        try {
          await addTicketNoteById(createdTicket.id, s)
        } catch (err) {
          toast.error('Ticket created, but could not save steps')
        }
      }

      const wd = workDate.trim()
      const hrs = hoursWorked.trim()
      if (wd && hrs) {
        const seconds = parseDurationToSeconds(hrs)
        if (!seconds) {
          throw new Error('Time worked must be in HH:MM (e.g. 00:17)')
        }

        const base = new Date(`${wd}T09:00:00`)
        const started_at = new Date(base.getTime()).toISOString()
        const ended_at = new Date(base.getTime() + seconds * 1000).toISOString()
        try {
          await createTimeEntry({
            ticket_id: createdTicket.id,
            started_at,
            ended_at,
            note: 'Manual entry',
          })

          queryClient.setQueriesData({ queryKey: ['tickets'], exact: false }, (old: any) => {
            const results = old?.results
            if (!Array.isArray(results)) return old
            return {
              ...old,
              results: results.map((t: any) =>
                t?.id === createdTicket.id
                  ? { ...t, total_time_seconds: (Number(t.total_time_seconds) || 0) + seconds }
                  : t,
              ),
            }
          })

          queryClient.invalidateQueries({ queryKey: ['tickets'], exact: false })
        } catch (err) {
          toast.error('Ticket created, but could not save worked time')
        }
      }

      return createdTicket
    },
    onSuccess: () => {
      setIsNewOpen(false)
      setTicket('')
      setSummary('')
      setPriority('LOW')
      setStatus('PENDING')
      setSelectedAgentId('')
      setWorkDate('')
      setHoursWorked('')
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Ticket created')
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? ((err.response?.data as { detail?: unknown; message?: unknown } | undefined)?.detail as string) ||
          ((err.response?.data as { detail?: unknown; message?: unknown } | undefined)?.message as string) ||
          `Request failed (${err.response?.status ?? 'error'})`
        : (err as Error).message
      toast.error(msg)
    },
  })

  const visibleTicketIds = useMemo(() => {
    return (ticketsQuery.data?.results ?? []).map((t) => t.id)
  }, [ticketsQuery.data?.results])

  const allVisibleSelected = useMemo(() => {
    if (!visibleTicketIds.length) return false
    return visibleTicketIds.every((id) => Boolean(selected[id]))
  }, [visibleTicketIds, selected])

  const errorMessage = (err: unknown, fallback: string) => {
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

    return fallback
  }

  if (!clientId) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
        <div className="text-sm font-medium">Missing client</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold">{clientQuery.data?.name ?? 'Client'}</div>
          <div className="mt-3 flex items-center gap-2">
            <Badge>{`${clientQuery.data?.ticket_count ?? 0} tickets`}</Badge>
            <Badge>{`${formatHours(clientQuery.data?.total_time_seconds)} total`}</Badge>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-end">
          {selectedTicketNumbers.length ? (
            <button
              type="button"
              onClick={() => deleteMutation.mutate(selectedTicketIds)}
              disabled={deleteMutation.isPending}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
            >
              {deleteMutation.isPending
                ? 'Deleting…'
                : `Delete (${selectedTicketNumbers.length})`}
            </button>
          ) : null}

          {selectedCount === 1 ? (
            <button
              type="button"
              onClick={() => {
                const all = ticketsQuery.data?.results ?? []
                const selectedId = Object.entries(selected).find(([, v]) => v)?.[0] ?? null
                if (!selectedId) return
                const t = all.find((x) => x.id === selectedId)
                if (!t) return
                setEditTicketId(t.id)
                setEditTicketNumber(t.ticket_number)
                setEditTicket(ticketLabel(t))
                setEditStatus(t.status as 'COMPLETED' | 'PENDING' | 'ESCALATED')
                setEditPriority(t.priority as 'LOW' | 'NORMAL' | 'HIGH')
                setEditWorkDate(new Date().toISOString().slice(0, 10))
                setEditHoursWorked(formatWorked(t.total_time_seconds))
                setIsEditOpen(true)
              }}
              className="inline-flex h-10 items-center justify-center border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
            >
              Edit
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setSelectedAgentId(me?.id ?? '')
              setIsNewOpen(true)
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover"
          >
            New ticket
          </button>
          <div className="w-full md:w-[420px]">
            <label className="text-xs font-medium text-text-secondary">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              className="mt-2 h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
              placeholder="Search by ticket"
            />
          </div>
        </div>
      </div>

      {detailTicket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-[820px] border border-border-subtle bg-bg-card p-5 shadow-sm transition"
            style={{ animation: 'daftar-pop 140ms ease-out' }}
          >
            <style>{`@keyframes daftar-pop { from { opacity: 0; transform: translateY(8px) scale(0.98);} to { opacity: 1; transform: translateY(0) scale(1);} }`}</style>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">{ticketLabel(detailTicket)}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(detailTicket.status)}>{detailTicket.status}</Badge>
                  <Badge>{`Level ${ticketLevel(detailTicket.priority)}`}</Badge>
                  <Badge>{`Created ${formatCreated(detailTicket.created_at)}`}</Badge>
                  <Badge>{`Worked ${formatWorked(detailTicket.total_time_seconds)}`}</Badge>
                  <Badge>{`Agent ${getAssignedAgentFirstName(detailTicket)}`}</Badge>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-5 border border-border-subtle bg-bg-secondary p-4">
              <div className="text-xs font-medium text-text-secondary">Steps / Summary</div>
              {detailNotesQuery.isPending ? (
                <div className="mt-2 text-sm text-text-muted">Loading…</div>
              ) : detailNotesQuery.isError ? (
                <div className="mt-2 text-sm text-text-muted">Could not load steps.</div>
              ) : (detailNotesQuery.data?.length ?? 0) === 0 ? (
                <div className="mt-2 text-sm text-text-muted">No steps added yet.</div>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-primary">
                  {(detailNotesQuery.data?.[detailNotesQuery.data.length - 1]?.content ?? '')
                    .split(/\r?\n/)
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isNewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[560px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">New ticket</div>
                <div className="mt-1 text-sm text-text-secondary">Create a new ticket under this client.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsNewOpen(false)
                  setSelectedAgentId('')
                }}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-1">
                <label className="text-xs font-medium text-text-secondary">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'COMPLETED' | 'PENDING' | 'ESCALATED')}
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                >
                  <option value="PENDING">Pending</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ESCALATED">Handed over</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <label className="text-xs font-medium text-text-secondary">Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                >
                  <option value={me?.id ?? ''}>{me?.display_name || me?.full_name || me?.email || 'Me'}</option>
                  {(agentsQuery.data ?? [])
                    .filter((agent) => agent.id !== me?.id)
                    .map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.display_name || agent.full_name || agent.email}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-text-secondary">Ticket Number</label>
                <input
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="Ticket Number"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-text-secondary">Summary / steps</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="Short steps of what you did…"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary">Ticket level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'LOW' | 'NORMAL' | 'HIGH')}
                    className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  >
                    <option value="LOW">L1</option>
                    <option value="NORMAL">L2</option>
                    <option value="HIGH">L3</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary">Work date</label>
                  <input
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    type="date"
                    className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Time worked</label>
                <input
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="00:17"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsNewOpen(false)
                  setSelectedAgentId('')
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (createMutation.isPending) return
                  createMutation.mutate()
                }}
                disabled={createMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-60"
              >
                {createMutation.isPending ? 'Creating…' : 'Create ticket'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[560px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Edit ticket</div>
                <div className="mt-1 text-sm text-text-secondary">{editTicket}</div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-text-secondary">Ticket</label>
                <input
                  value={editTicket}
                  onChange={(e) => setEditTicket(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-text-secondary">Steps / Summary</label>
                <textarea
                  value={editSteps}
                  onChange={(e) => setEditSteps(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="Short steps of what you did…"
                />
                {editNotesQuery.isPending ? (
                  <div className="text-xs text-text-muted">Loading existing steps…</div>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Ticket level</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as 'LOW' | 'NORMAL' | 'HIGH')}
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                >
                  <option value="LOW">L1</option>
                  <option value="NORMAL">L2</option>
                  <option value="HIGH">L3</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'COMPLETED' | 'PENDING' | 'ESCALATED')}
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                >
                  <option value="PENDING">Pending</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ESCALATED">Handed over</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Work date</label>
                <input
                  value={editWorkDate}
                  onChange={(e) => setEditWorkDate(e.target.value)}
                  type="date"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Time worked</label>
                <input
                  value={editHoursWorked}
                  onChange={(e) => setEditHoursWorked(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="00:17"
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
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-60"
              >
                {editMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {clientQuery.isPending ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-bg-hover" />
            ))}
          </div>
        </div>
      ) : clientQuery.isError ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="text-sm font-medium">Could not load client</div>
          <div className="mt-1 text-sm text-text-secondary">
            {errorMessage(clientQuery.error, 'Could not load client')}
          </div>
        </div>
      ) : null}

      {ticketsQuery.isPending ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-bg-hover" />
            ))}
          </div>
        </div>
      ) : ticketsQuery.isError ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="text-sm font-medium">Could not load tickets</div>
          <div className="mt-1 text-sm text-text-secondary">
            {errorMessage(ticketsQuery.error, 'Could not load tickets')}
          </div>
        </div>
      ) : (ticketsQuery.data?.results?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-6 text-center">
          <div className="text-sm font-medium">No tickets found</div>
          <div className="mt-1 text-sm text-text-secondary">Create your first ticket for this client.</div>
        </div>
      ) : (
        <div className="overflow-hidden border border-border-subtle bg-bg-card">
          <div className="grid grid-cols-12 gap-3 border-b border-border-subtle bg-bg-secondary px-4 py-3 text-xs font-medium text-text-secondary">
            <div className="col-span-1"></div>
            <div className="col-span-1 flex items-center">
              <input
                checked={allVisibleSelected}
                onChange={(e) => {
                  const checked = e.target.checked
                  setSelected((prev) => {
                    const next = { ...prev }
                    for (const id of visibleTicketIds) next[id] = checked
                    return next
                  })
                }}
                type="checkbox"
                className="h-4 w-4 rounded border border-[rgb(var(--text-primary))]/70 bg-transparent accent-[rgb(var(--accent-primary))]"
                aria-label="Select all"
              />
            </div>
            <div className="col-span-1">Date</div>
            <div className="col-span-5">Ticket</div>
            <div className="col-span-1">Agent</div>
            <div className="col-span-1">Level</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-right">Worked</div>
          </div>
          <div className="divide-y divide-border-subtle">
            {ticketsQuery.data.results.map((t) => (
              <div key={t.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setExpandedId(null)
                    setDetailId(t.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setExpandedId(null)
                      setDetailId(t.id)
                    }
                  }}
                  className="grid w-full grid-cols-12 gap-3 px-4 py-3 text-left text-sm hover:bg-bg-hover/50"
                >
                  <div className="col-span-1 flex items-start pt-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedId((prev) => (prev === t.id ? null : t.id))
                      }}
                      aria-label={expandedId === t.id ? 'Collapse ticket' : 'Expand ticket'}
                      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border border-[rgb(var(--text-primary))]/65 bg-transparent text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--text-primary))]/10"
                    >
                      {expandedId === t.id ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                  </div>

                  <div className="col-span-1 flex items-start pt-0.5">
                    <input
                      checked={Boolean(selected[t.id])}
                      onChange={(e) =>
                        setSelected((prev) => ({
                          ...prev,
                          [t.id]: e.target.checked,
                        }))
                      }
                      onClick={(e) => e.stopPropagation()}
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border border-[rgb(var(--text-primary))]/70 bg-transparent accent-[rgb(var(--accent-primary))]"
                      aria-label={`Select ${ticketLabel(t)}`}
                    />
                  </div>

                  <div className="col-span-1 whitespace-nowrap text-text-secondary">{formatCreated(t.created_at)}</div>

                  <div className="col-span-5 min-w-0 pr-3 font-medium text-text-primary">
                    <div className="truncate">{ticketLabel(t)}</div>
                  </div>

                  <div className="col-span-1 whitespace-nowrap text-text-secondary">
                    {getAssignedAgentFirstName(t)}
                  </div>

                  <div className="col-span-1 text-text-secondary">{ticketLevel(t.priority)}</div>
                  <div className="col-span-1">
                    <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  </div>
                  <div className="col-span-1 whitespace-nowrap text-right font-medium text-text-secondary">
                    {formatWorked(t.total_time_seconds)}
                  </div>
                </div>

                {expandedId === t.id ? (
                  <div className="px-4 pb-4">
                    <div className="border border-border-subtle bg-bg-secondary p-4">
                      <div className="text-xs font-medium text-text-secondary">Steps / Summary</div>
                      {notesQuery.isPending ? (
                        <div className="mt-2 text-sm text-text-muted">Loading…</div>
                      ) : notesQuery.isError ? (
                        <div className="mt-2 text-sm text-text-muted">Could not load steps.</div>
                      ) : (notesQuery.data?.length ?? 0) === 0 ? (
                        <div className="mt-2 text-sm text-text-muted">No steps added yet.</div>
                      ) : (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-primary">
                          {(notesQuery.data?.[notesQuery.data.length - 1]?.content ?? '')
                            .split(/\r?\n/)
                            .map((x) => x.trim())
                            .filter(Boolean)
                            .map((line, idx) => (
                              <li key={idx}>{line}</li>
                            ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
