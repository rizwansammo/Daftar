import type { Me } from './auth'

export type TicketStatus =
  | 'OPEN'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ESCALATED'
  | 'CANCELLED'

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export type Client = {
  id: string
  name: string
  color_tag: string
  contact_email: string
  notes: string
  is_archived?: boolean
  created_at: string
  ticket_count?: number
  doc_count?: number
  boilerplate_count?: number
  completed_ticket_count?: number
  pending_ticket_count?: number
  handed_over_ticket_count?: number
  total_time_seconds?: number
}

export type Tag = {
  id: string
  name: string
  color: string
}

export type Ticket = {
  id: string
  ticket: string
  ticket_number: string
  title: string
  client: Client
  status: TicketStatus
  priority: TicketPriority
  assigned_agent: Me | null
  created_by: Me
  created_at: string
  updated_at: string
  completed_at: string | null
  due_date: string | null
  tags: Tag[]
  total_time_seconds: number
}

export type TicketNote = {
  id: string
  ticket: string
  content: string
  created_by: Me
  created_at: string
}

export type TimeEntry = {
  id: string
  ticket: string
  agent: Me
  started_at: string
  ended_at: string | null
  duration_seconds: number
  note: string
  is_manual: boolean
  is_running: boolean
  live_duration_seconds: number
}
