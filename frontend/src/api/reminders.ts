import { http } from './http'
import type { ApiEnvelope } from '../types/auth'
import type { CursorPage } from '../types/pagination'
import type { Reminder, ReminderPriority, ReminderRepeatType } from '../types/reminders'

export type ListRemindersParams = {
  search?: string
  ordering?: string
  is_completed?: boolean
  start?: string
  end?: string
}

export async function listReminders(params?: ListRemindersParams) {
  const res = await http.get<ApiEnvelope<CursorPage<Reminder>>>('/reminders/', {
    params: {
      ordering: params?.ordering ?? 'remind_at',
      ...(params?.search ? { search: params.search } : {}),
      ...(typeof params?.is_completed === 'boolean' ? { is_completed: params.is_completed } : {}),
      ...(params?.start ? { start: params.start } : {}),
      ...(params?.end ? { end: params.end } : {}),
    },
  })
  return res.data
}

export type ListCalendarRemindersParams = {
  start?: string
  end?: string
  include_completed?: boolean
}

export async function listCalendarReminders(params?: ListCalendarRemindersParams) {
  const res = await http.get<ApiEnvelope<Reminder[]>>('/reminders/calendar/', {
    params: {
      ...(params?.start ? { start: params.start } : {}),
      ...(params?.end ? { end: params.end } : {}),
      ...(typeof params?.include_completed === 'boolean'
        ? { include_completed: params.include_completed }
        : {}),
    },
  })
  return res.data
}

export type CreateReminderInput = {
  title: string
  description: string
  remind_at: string
  priority?: ReminderPriority
  repeat_type?: ReminderRepeatType
}

export async function createReminder(input: CreateReminderInput) {
  const res = await http.post<ApiEnvelope<Reminder>>('/reminders/', input)
  return res.data
}

export type UpdateReminderInput = Partial<CreateReminderInput> & {
  is_completed?: boolean
  is_snoozed?: boolean
  snoozed_until?: string | null
}

export async function updateReminder(reminderId: string, input: UpdateReminderInput) {
  const res = await http.patch<ApiEnvelope<Reminder>>(`/reminders/${encodeURIComponent(reminderId)}/`, input)
  return res.data
}
