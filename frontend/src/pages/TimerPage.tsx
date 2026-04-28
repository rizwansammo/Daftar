import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'

import { listClients } from '../api/clients'
import { addTicketNoteById, createTicket, createTimeEntry, getTicket, updateTicket } from '../api/tickets'
import { useAuthStore } from '../store/auth'

type TicketLevel = 'L1' | 'L2' | 'L3'
type TimerStatus = 'idle' | 'running' | 'paused'

type PersistedTimerState = {
  ticketField: string
  steps: string
  clientId: string
  level: TicketLevel
  status: TimerStatus
  accumulatedSeconds: number
  runningStartedAtIso: string | null
}

const TIMER_STORAGE_KEY = 'daftar-timer-state-v1'

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

function parseTicketField(raw: string) {
  const value = raw.trim()
  if (!value) return null
  const separator = value.indexOf(' - ')
  const ticketNumber = separator >= 0 ? value.slice(0, separator).trim() : value
  if (!ticketNumber) return null
  return { ticketNumber }
}

function mapLevelToPriority(level: TicketLevel) {
  if (level === 'L1') return 'LOW'
  if (level === 'L2') return 'NORMAL'
  return 'HIGH'
}

function formatElapsed(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const hh = Math.floor(safe / 3600)
  const mm = Math.floor((safe % 3600) / 60)
  const ss = safe % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function loadPersistedState(): PersistedTimerState {
  const fallback: PersistedTimerState = {
    ticketField: '',
    steps: '',
    clientId: '',
    level: 'L1',
    status: 'idle',
    accumulatedSeconds: 0,
    runningStartedAtIso: null,
  }

  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PersistedTimerState>
    return {
      ticketField: typeof parsed.ticketField === 'string' ? parsed.ticketField : '',
      steps: typeof parsed.steps === 'string' ? parsed.steps : '',
      clientId: typeof parsed.clientId === 'string' ? parsed.clientId : '',
      level: parsed.level === 'L2' || parsed.level === 'L3' ? parsed.level : 'L1',
      status: parsed.status === 'running' || parsed.status === 'paused' ? parsed.status : 'idle',
      accumulatedSeconds:
        typeof parsed.accumulatedSeconds === 'number' && Number.isFinite(parsed.accumulatedSeconds)
          ? Math.max(0, parsed.accumulatedSeconds)
          : 0,
      runningStartedAtIso: typeof parsed.runningStartedAtIso === 'string' ? parsed.runningStartedAtIso : null,
    }
  } catch {
    return fallback
  }
}

export function TimerPage() {
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.me)
  const persisted = useMemo(() => loadPersistedState(), [])

  const [ticketField, setTicketField] = useState(persisted.ticketField)
  const [steps, setSteps] = useState(persisted.steps)
  const [clientId, setClientId] = useState(persisted.clientId)
  const [level, setLevel] = useState<TicketLevel>(persisted.level)
  const [status, setStatus] = useState<TimerStatus>(persisted.status)
  const [accumulatedSeconds, setAccumulatedSeconds] = useState<number>(persisted.accumulatedSeconds)
  const [runningStartedAtIso, setRunningStartedAtIso] = useState<string | null>(persisted.runningStartedAtIso)
  const [nowTick, setNowTick] = useState<number>(Date.now())

  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false)
  const [resumeOnCancel, setResumeOnCancel] = useState(false)

  useEffect(() => {
    localStorage.setItem(
      TIMER_STORAGE_KEY,
      JSON.stringify({
        ticketField,
        steps,
        clientId,
        level,
        status,
        accumulatedSeconds,
        runningStartedAtIso,
      } as PersistedTimerState),
    )
  }, [ticketField, steps, clientId, level, status, accumulatedSeconds, runningStartedAtIso])

  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [status])

  const clientsQuery = useQuery({
    queryKey: ['clients', 'timer-selector'],
    queryFn: async () => {
      const res = await listClients(undefined)
      return res.data
    },
  })

  const elapsedSeconds = useMemo(() => {
    if (status !== 'running' || !runningStartedAtIso) return accumulatedSeconds
    const startedAt = new Date(runningStartedAtIso)
    if (Number.isNaN(startedAt.getTime())) return accumulatedSeconds
    const live = Math.max(0, Math.floor((nowTick - startedAt.getTime()) / 1000))
    return accumulatedSeconds + live
  }, [accumulatedSeconds, nowTick, runningStartedAtIso, status])

  const primaryActionLabel = status === 'paused' ? 'Resume' : 'Start'

  function handleResume() {
    if (status === 'running') return
    const parsed = parseTicketField(ticketField)
    if (!parsed) {
      toast.error('Ticket number is required')
      return
    }
    if (!clientId) {
      toast.error('Select a client')
      return
    }
    setRunningStartedAtIso(new Date().toISOString())
    setStatus('running')
  }

  function handlePause() {
    if (status !== 'running' || !runningStartedAtIso) return
    const startedAt = new Date(runningStartedAtIso)
    const delta = Number.isNaN(startedAt.getTime()) ? 0 : Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000))
    setAccumulatedSeconds((prev) => prev + delta)
    setRunningStartedAtIso(null)
    setStatus('paused')
  }

  function openStopConfirm() {
    if (status === 'idle') {
      toast.error('No running timer to stop')
      return
    }

    if (status === 'running' && runningStartedAtIso) {
      const startedAt = new Date(runningStartedAtIso)
      const delta = Number.isNaN(startedAt.getTime()) ? 0 : Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000))
      setAccumulatedSeconds((prev) => prev + delta)
      setRunningStartedAtIso(null)
      setStatus('paused')
      setResumeOnCancel(true)
    } else {
      setResumeOnCancel(false)
    }

    setIsStopConfirmOpen(true)
  }

  function cancelStopConfirm() {
    setIsStopConfirmOpen(false)
    if (resumeOnCancel) {
      setRunningStartedAtIso(new Date().toISOString())
      setStatus('running')
    }
    setResumeOnCancel(false)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = parseTicketField(ticketField)
      if (!parsed) throw new Error('Ticket number is required')
      if (!clientId) throw new Error('Select a client')
      if (accumulatedSeconds <= 0) throw new Error('Timer has no tracked time')

      const priority = mapLevelToPriority(level)
      const { ticketNumber } = parsed

      let ticketId: string

      try {
        const existing = await getTicket(ticketNumber)
        ticketId = existing.data.id
        await updateTicket(ticketNumber, {
          ticket: ticketField.trim() || ticketNumber,
          client_id: clientId,
          priority,
          status: 'PENDING',
          assigned_agent_id: me?.id || null,
        })
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          const created = await createTicket({
            ticket: ticketField.trim() || ticketNumber,
            client_id: clientId,
            priority,
            status: 'PENDING',
            assigned_agent_id: me?.id || null,
          })
          ticketId = created.data.id
        } else {
          throw error
        }
      }

      const endedAt = new Date()
      const startedAt = new Date(endedAt.getTime() - accumulatedSeconds * 1000)
      const noteText = steps.trim()

      if (noteText) {
        await addTicketNoteById(ticketId, noteText)
      }

      await createTimeEntry({
        ticket_id: ticketId,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        note: noteText ? noteText.slice(0, 255) : 'Timer session',
      })
    },
    onSuccess: () => {
      setStatus('idle')
      setAccumulatedSeconds(0)
      setRunningStartedAtIso(null)
      setTicketField('')
      setSteps('')
      setClientId('')
      setLevel('L1')
      setNowTick(Date.now())
      setIsStopConfirmOpen(false)
      setResumeOnCancel(false)
      localStorage.removeItem(TIMER_STORAGE_KEY)
      queryClient.invalidateQueries({ queryKey: ['tickets'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      toast.success('Timer saved to ticket')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not save timer session'))
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Timer</div>
        <div className="mt-1 text-sm text-text-secondary">
          Track work time and save it to a ticket in the selected client.
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
        <div className="text-5xl font-semibold tabular-nums">{formatElapsed(elapsedSeconds)}</div>
        <div className="mt-2 text-sm text-text-secondary">
          {status === 'running' ? 'Running' : status === 'paused' ? 'Paused' : 'Idle'}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-1">
            <label className="text-xs font-medium text-text-secondary">Ticket Number</label>
            <input
              value={ticketField}
              onChange={(e) => setTicketField(e.target.value)}
              type="text"
              placeholder="Ticket Number"
              className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
            >
              <option value="">Select client</option>
              {(clientsQuery.data?.results ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as TicketLevel)}
              className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
            >
              <option value="L1">L1</option>
              <option value="L2">L2</option>
              <option value="L3">L3</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium text-text-secondary">Ticket detail / steps</label>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            rows={3}
            placeholder="Write what you did in this session..."
            className="w-full resize-none rounded-xl border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResume}
            disabled={status === 'running'}
            className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-55"
          >
            {primaryActionLabel}
          </button>
          <button
            type="button"
            onClick={handlePause}
            disabled={status !== 'running'}
            className="inline-flex h-10 items-center rounded-xl bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-400 disabled:opacity-55"
          >
            Pause
          </button>
          <button
            type="button"
            onClick={openStopConfirm}
            disabled={status === 'idle'}
            className="inline-flex h-10 items-center rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-55"
          >
            Stop
          </button>
        </div>
      </div>

      {isStopConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[460px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="text-sm font-semibold">Save Timer</div>
            <div className="mt-2 text-sm text-text-secondary">
              Save this timer session to ticket now?
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelStopConfirm}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {saveMutation.isPending ? 'Saving...' : 'Confirm Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
