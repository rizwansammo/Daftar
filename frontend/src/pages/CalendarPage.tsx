import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { listCalendarReminders } from '../api/reminders'
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

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return format(date, 'dd MMM yyyy')
}

function formatTimeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return format(date, 'hh:mm a')
}

function timeSlotLabel(hour: number) {
  return format(new Date(2026, 0, 1, hour, 0, 0), 'h a')
}

function dateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export function CalendarPage() {
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [isMonthOpen, setIsMonthOpen] = useState(false)
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [detailItem, setDetailItem] = useState<Reminder | null>(null)
  const [multiCellEvents, setMultiCellEvents] = useState<Reminder[] | null>(null)
  const hourGridRef = useRef<HTMLDivElement | null>(null)
  const autoScrollWeekRef = useRef<string>('')

  const weekStart = useMemo(() => startOfWeek(weekCursor, { weekStartsOn: 0 }), [weekCursor])
  const weekEnd = useMemo(() => endOfWeek(weekCursor, { weekStartsOn: 0 }), [weekCursor])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])

  const weekQuery = useQuery({
    queryKey: ['calendar-reminders', 'week', weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async () => {
      const res = await listCalendarReminders({
        start: startOfDay(weekStart).toISOString(),
        end: endOfDay(weekEnd).toISOString(),
        include_completed: true,
      })
      return res.data
    },
  })

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor])
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor])

  const monthQuery = useQuery({
    queryKey: ['calendar-reminders', 'month', monthStart.toISOString(), monthEnd.toISOString()],
    enabled: isMonthOpen,
    queryFn: async () => {
      const res = await listCalendarReminders({
        start: startOfDay(monthStart).toISOString(),
        end: endOfDay(monthEnd).toISOString(),
        include_completed: true,
      })
      return res.data
    },
  })

  const reminders = weekQuery.data ?? []
  const weeklyCellMap = useMemo(() => {
    const map = new Map<string, Reminder[]>()
    for (const reminder of reminders) {
      const date = new Date(reminder.remind_at)
      if (Number.isNaN(date.getTime())) continue
      const key = `${dateKey(date)}-${date.getHours()}`
      const current = map.get(key) ?? []
      current.push(reminder)
      map.set(key, current)
    }
    for (const [key, events] of map.entries()) {
      map.set(
        key,
        events.sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()),
      )
    }
    return map
  }, [reminders])

  const monthReminders = monthQuery.data ?? []
  const monthEventMap = useMemo(() => {
    const map = new Map<string, Reminder[]>()
    for (const reminder of monthReminders) {
      const date = new Date(reminder.remind_at)
      if (Number.isNaN(date.getTime())) continue
      const key = dateKey(date)
      const current = map.get(key) ?? []
      current.push(reminder)
      map.set(key, current)
    }
    return map
  }, [monthReminders])

  const monthGridDays = useMemo(() => {
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [monthStart, monthEnd])

  const weekError = weekQuery.isError ? getErrorMessage(weekQuery.error, 'Could not load calendar reminders') : null
  const monthError = monthQuery.isError ? getErrorMessage(monthQuery.error, 'Could not load month reminders') : null
  const weekStamp = format(weekStart, 'yyyy-MM-dd')

  useEffect(() => {
    if (!weekQuery.data || weekQuery.isPending || weekQuery.isError) return
    const container = hourGridRef.current
    if (!container) return
    if (autoScrollWeekRef.current === weekStamp) return
    autoScrollWeekRef.current = weekStamp

    const now = new Date()
    const inVisibleWeek = now >= startOfDay(weekStart) && now <= endOfDay(weekEnd)
    const targetHour = inVisibleWeek ? now.getHours() : 8
    const rowHeight = 67
    const targetTop = Math.max(0, targetHour * rowHeight - rowHeight * 1.25)
    container.scrollTo({ top: targetTop, behavior: 'smooth' })
  }, [weekQuery.data, weekQuery.isPending, weekQuery.isError, weekStart, weekEnd, weekStamp])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-2xl font-semibold">Calendar</div>
          <div className="mt-1 text-sm text-text-secondary">Weekly reminder timeline with hourly slots.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekCursor(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            className="inline-flex h-9 items-center rounded-lg border border-border-subtle bg-bg-card px-3 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekCursor((prev) => subWeeks(prev, 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekCursor((prev) => addWeeks(prev, 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMonthCursor(startOfMonth(weekStart))
              setIsMonthOpen(true)
            }}
            className="inline-flex h-9 items-center rounded-lg border border-border-subtle bg-bg-card px-3 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            Month
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
        <div className="mb-3 text-sm font-medium text-text-primary">
          {format(weekStart, 'MMM d, yyyy')} - {format(weekEnd, 'MMM d, yyyy')}
        </div>

        {weekQuery.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded bg-bg-hover" />
            ))}
          </div>
        ) : weekQuery.isError ? (
          <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3 text-sm text-text-secondary">
            {weekError}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1160px]">
              <div className="grid grid-cols-[80px_repeat(7,minmax(140px,1fr))] border border-border-subtle bg-bg-secondary">
                <div className="border-r border-border-subtle p-2 text-xs text-text-muted"></div>
                {weekDays.map((day) => (
                  <div key={day.toISOString()} className="border-r border-border-subtle p-2 last:border-r-0">
                    <div className="text-sm font-medium text-text-primary">{format(day, 'EEE')}</div>
                    <div className="text-xs text-text-secondary">{format(day, 'dd MMM')}</div>
                  </div>
                ))}
              </div>

              <div ref={hourGridRef} className="max-h-[68vh] overflow-y-auto">
                {Array.from({ length: 24 }).map((_, hour) => (
                  <div key={hour} className="grid grid-cols-[80px_repeat(7,minmax(140px,1fr))] border-x border-b border-border-subtle">
                    <div className="border-r border-border-subtle bg-bg-secondary px-2 py-3 text-xs text-text-muted">
                      {timeSlotLabel(hour)}
                    </div>
                    {weekDays.map((day) => {
                      const cellKey = `${dateKey(day)}-${hour}`
                      const events = weeklyCellMap.get(cellKey) ?? []
                      return (
                        <div
                          key={cellKey}
                          className="min-h-[66px] border-r border-border-subtle bg-bg-card px-2 py-2 last:border-r-0"
                        >
                          {events.length === 0 ? null : events.length === 1 ? (
                            <button
                              type="button"
                              onClick={() => setDetailItem(events[0])}
                              className={[
                                'w-full rounded-md border px-2 py-1 text-left text-xs transition',
                                events[0].is_completed
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-text-secondary'
                                  : 'border-emerald-500/45 bg-emerald-500/20 text-text-primary hover:bg-emerald-500/25',
                              ].join(' ')}
                              title={events[0].title}
                            >
                              <div className={events[0].is_completed ? 'line-through' : ''}>{events[0].title}</div>
                              <div className="mt-0.5 text-[11px] text-text-secondary">{formatTimeLabel(events[0].remind_at)}</div>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setMultiCellEvents(events)}
                              className="w-full rounded-md border border-emerald-500/40 bg-emerald-500/14 px-2 py-1 text-left text-xs text-text-primary hover:bg-emerald-500/20"
                            >
                              Multiple Event in this Time.
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {multiCellEvents ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[560px] rounded-xl border border-border-subtle bg-bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Multiple Events</div>
                <div className="mt-1 text-xs text-text-secondary">Select an event to view details.</div>
              </div>
              <button
                type="button"
                onClick={() => setMultiCellEvents(null)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {multiCellEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    setDetailItem(event)
                    setMultiCellEvents(null)
                  }}
                  className="w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 py-2 text-left hover:bg-bg-hover"
                >
                  <div className="text-sm font-medium text-text-primary">{event.title}</div>
                  <div className="mt-0.5 text-xs text-text-secondary">
                    {formatDateLabel(event.remind_at)} at {formatTimeLabel(event.remind_at)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {detailItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[680px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">{detailItem.title}</div>
                <div className="mt-1 text-xs text-text-secondary">
                  {formatDateLabel(detailItem.remind_at)} at {formatTimeLabel(detailItem.remind_at)}
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

      {isMonthOpen ? (
        <div className="fixed inset-0 z-[70] bg-black/55 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto max-w-[1080px] rounded-xl border border-border-subtle bg-bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Month View</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMonthCursor((prev) => subMonths(prev, 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-bg-secondary text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="min-w-[160px] text-center text-sm text-text-primary">{format(monthCursor, 'MMMM yyyy')}</div>
                <button
                  type="button"
                  onClick={() => setMonthCursor((prev) => addMonths(prev, 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-bg-secondary text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsMonthOpen(false)}
                  className="ml-2 inline-flex h-8 items-center rounded-md border border-border-subtle bg-bg-secondary px-3 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                >
                  Close
                </button>
              </div>
            </div>

            {monthQuery.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded bg-bg-hover" />
                ))}
              </div>
            ) : monthQuery.isError ? (
              <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3 text-sm text-text-secondary">
                {monthError}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border-subtle">
                <div className="grid grid-cols-7 border-b border-border-subtle bg-bg-secondary">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
                    <div key={weekday} className="px-3 py-2 text-xs font-medium text-text-muted">
                      {weekday}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthGridDays.map((day) => {
                    const key = dateKey(day)
                    const dayEvents = monthEventMap.get(key) ?? []
                    const inCurrentMonth = isSameMonth(day, monthCursor)
                    const isToday = isSameDay(day, new Date())
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const first = dayEvents[0]
                          if (first) {
                            setDetailItem(first)
                            setIsMonthOpen(false)
                          }
                        }}
                        className={[
                          'relative min-h-[96px] border-r border-b border-border-subtle p-2 text-left transition',
                          'hover:bg-bg-hover/40',
                          inCurrentMonth ? 'bg-bg-card' : 'bg-bg-secondary/45',
                        ].join(' ')}
                      >
                        <div
                          className={[
                            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                            isToday ? 'bg-accent-primary text-white' : 'text-text-secondary',
                          ].join(' ')}
                        >
                          {format(day, 'd')}
                        </div>
                        {dayEvents.length > 0 ? (
                          <div className="mt-2 flex items-center gap-1">
                            <span className="inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                            <span className="text-[11px] text-text-secondary">
                              {dayEvents.length > 1 ? `${dayEvents.length} events` : '1 event'}
                            </span>
                          </div>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
