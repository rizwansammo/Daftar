import { Fragment } from 'react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

import { createReminder, listReminders, updateReminder } from '../api/reminders'
import type { Reminder } from '../types/reminders'

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

function formatDueDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return format(date, 'dd MMM yyyy').toUpperCase()
}

function formatDueTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return format(date, 'hh:mm a').toUpperCase()
}

function toDateInputValue(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function toTimeInputValue(date: Date) {
  return format(date, 'HH:mm')
}

export function RemindersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<Reminder | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createDate, setCreateDate] = useState(() => toDateInputValue(new Date()))
  const [createTime, setCreateTime] = useState(() => {
    const nextHour = new Date(Date.now() + 60 * 60 * 1000)
    return toTimeInputValue(nextHour)
  })

  const params = useMemo(() => search.trim(), [search])

  const remindersQuery = useQuery({
    queryKey: ['reminders', params],
    queryFn: async () => {
      const res = await listReminders({
        search: params || undefined,
        ordering: 'remind_at',
      })
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const title = createTitle.trim()
      const description = createDescription.trim()
      if (!title) throw new Error('Title is required')
      if (!createDate || !createTime) throw new Error('Date and time are required')

      const remindAt = new Date(`${createDate}T${createTime}:00`)
      if (Number.isNaN(remindAt.getTime())) throw new Error('Invalid reminder date/time')

      const res = await createReminder({
        title,
        description,
        remind_at: remindAt.toISOString(),
      })
      return res.data
    },
    onSuccess: () => {
      setIsCreateOpen(false)
      setCreateTitle('')
      setCreateDescription('')
      setCreateDate(toDateInputValue(new Date()))
      setCreateTime(toTimeInputValue(new Date(Date.now() + 60 * 60 * 1000)))
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-reminders'] })
      toast.success('Reminder created')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not create reminder'))
    },
  })

  const toggleCompleteMutation = useMutation({
    mutationFn: async (item: Reminder) => {
      const res = await updateReminder(item.id, { is_completed: !item.is_completed })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-reminders'] })
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not update reminder'))
    },
  })

  const reminders = remindersQuery.data?.results ?? []
  const errorMessage = remindersQuery.isError
    ? getErrorMessage(remindersQuery.error, 'Could not load reminders')
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold">Reminders</div>
          <div className="mt-1 text-sm text-text-secondary">Track follow-ups with due date and due time.</div>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-end">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover"
          >
            New reminder
          </button>
          <div className="w-full md:w-[420px]">
            <label className="text-xs font-medium text-text-secondary">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              className="mt-2 h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
              placeholder="Search reminders"
            />
          </div>
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[620px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Create reminder</div>
                <div className="mt-1 text-sm text-text-secondary">Add title, details, due date, and due time.</div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-text-secondary">Title</label>
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="Reminder title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Due date</label>
                <input
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  type="date"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Due time</label>
                <input
                  value={createTime}
                  onChange={(e) => setCreateTime(e.target.value)}
                  type="time"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-text-secondary">Detail</label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="Reminder details"
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

      {detailItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[680px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{detailItem.title}</div>
                <div className="mt-1 text-xs text-text-secondary">
                  {formatDueDate(detailItem.remind_at)} at {formatDueTime(detailItem.remind_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-border-subtle bg-bg-secondary p-4">
              <pre className="whitespace-pre-wrap break-words text-sm text-text-primary">
                {detailItem.description || 'No detail provided.'}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      {remindersQuery.isPending ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-bg-hover" />
            ))}
          </div>
        </div>
      ) : remindersQuery.isError ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="text-sm font-medium">Could not load reminders</div>
          <div className="mt-1 text-sm text-text-secondary">{errorMessage}</div>
        </div>
      ) : reminders.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-6 text-center">
          <div className="text-sm font-medium">No reminders yet</div>
          <div className="mt-1 text-sm text-text-secondary">Create your first reminder.</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle text-xs text-text-muted">
              <tr>
                <th className="w-12 px-3 py-3 font-medium"></th>
                <th className="w-14 px-3 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Due Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {reminders.map((item) => (
                <Fragment key={item.id}>
                  <tr
                    className={['hover:bg-bg-hover', item.is_completed ? 'opacity-65' : ''].join(' ')}
                  >
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedId((prev) => (prev === item.id ? null : item.id))
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-secondary text-text-secondary hover:bg-bg-hover"
                        aria-label={expandedId === item.id ? 'Collapse' : 'Expand'}
                      >
                        {expandedId === item.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        checked={item.is_completed}
                        onChange={() => toggleCompleteMutation.mutate(item)}
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
                      <div className={['font-medium text-text-primary', item.is_completed ? 'line-through' : ''].join(' ')}>
                        {item.title}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{formatDueDate(item.remind_at)}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDueTime(item.remind_at)}</td>
                  </tr>
                  {expandedId === item.id ? (
                    <tr className="bg-bg-secondary/40">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3 text-sm text-text-primary">
                          {item.description || 'No detail provided.'}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
