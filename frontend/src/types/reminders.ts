import type { Me } from './auth'

export type ReminderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type ReminderRepeatType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'

export type Reminder = {
  id: string
  user: Me
  title: string
  description: string
  remind_at: string
  priority: ReminderPriority
  is_completed: boolean
  is_snoozed: boolean
  snoozed_until: string | null
  repeat_type: ReminderRepeatType
  created_at: string
}
