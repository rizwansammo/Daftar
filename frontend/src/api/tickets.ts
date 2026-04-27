import { http } from './http'
import type { ApiEnvelope } from '../types/auth'
import type { CursorPage } from '../types/pagination'
import type { Ticket, TicketNote, TimeEntry } from '../types/tickets'

export type ListTicketsParams = {
  cursor?: string
  search?: string
  status?: string
  priority?: string
  client?: string
  assigned_agent?: string
  created_after?: string
  created_before?: string
  ordering?: string
}

export async function listTickets(params: ListTicketsParams) {
  const res = await http.get<ApiEnvelope<CursorPage<Ticket>>>('/tickets/', {
    params,
  })
  return res.data
}

export async function getTicket(ticketNumber: string) {
  const res = await http.get<ApiEnvelope<Ticket>>(`/tickets/${encodeURIComponent(ticketNumber)}/`)
  return res.data
}

export async function deleteTicket(ticketNumber: string) {
  const res = await http.delete<ApiEnvelope<{}>>(`/tickets/${encodeURIComponent(ticketNumber)}/`)
  return res.data
}

export async function deleteTicketById(ticketId: string) {
  const res = await http.delete<ApiEnvelope<{}>>(`/tickets/by-id/${encodeURIComponent(ticketId)}/`)
  return res.data
}

export type UpdateTicketInput = Partial<{
  title: string
  status: string
  priority: string
  due_date: string | null
  assigned_agent_id: string | null
  client_id: string
}>

export async function updateTicket(ticketNumber: string, input: UpdateTicketInput) {
  const res = await http.patch<ApiEnvelope<Ticket>>(`/tickets/${encodeURIComponent(ticketNumber)}/`, input)
  return res.data
}

export async function listTicketNotes(ticketId: string) {
  const res = await http.get<any>('/ticket-notes/', {
    params: { ticket: ticketId },
  })

  const raw = res.data
  if (raw && typeof raw === 'object' && typeof raw.success === 'boolean' && 'data' in raw) {
    const env = raw as ApiEnvelope<unknown>
    const d: any = (env as any).data
    const notes: TicketNote[] = Array.isArray(d)
      ? d
      : Array.isArray(d?.results)
        ? d.results
        : []
    return { ...(env as any), data: notes } as ApiEnvelope<TicketNote[]>
  }

  const notes: TicketNote[] = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : []
  return { success: true, data: notes, message: 'OK', errors: {} } as ApiEnvelope<TicketNote[]>
}

export async function addTicketNote(ticketNumber: string, content: string) {
  const res = await http.post<ApiEnvelope<TicketNote>>(
    `/tickets/${encodeURIComponent(ticketNumber)}/notes/`,
    { content },
  )
  return res.data
}

export async function addTicketNoteById(ticketId: string, content: string) {
  const res = await http.post<ApiEnvelope<TicketNote>>(
    `/tickets/by-id/${encodeURIComponent(ticketId)}/notes/`,
    { content },
  )
  return res.data
}

export async function updateTicketNote(noteId: string, content: string) {
  const res = await http.patch<ApiEnvelope<TicketNote>>(`/ticket-notes/${encodeURIComponent(noteId)}/`, { content })
  return res.data
}

export async function startTicketTimer(ticketNumber: string) {
  const res = await http.post<ApiEnvelope<TimeEntry>>(
    `/tickets/${encodeURIComponent(ticketNumber)}/time/start/`,
    {},
  )
  return res.data
}

export async function stopTicketTimer(ticketNumber: string) {
  const res = await http.post<ApiEnvelope<TimeEntry>>(
    `/tickets/${encodeURIComponent(ticketNumber)}/time/stop/`,
    {},
  )
  return res.data
}

export async function listMyTimeEntries() {
  const res = await http.get<ApiEnvelope<CursorPage<TimeEntry>>>('/time-entries/')
  return res.data
}

export type CreateTimeEntryInput = {
  ticket_id: string
  started_at: string
  ended_at: string
  note?: string
}

export async function createTimeEntry(input: CreateTimeEntryInput) {
  const res = await http.post<ApiEnvelope<TimeEntry>>('/time-entries/', {
    ...input,
    is_manual: true,
  })
  return res.data
}

export type CreateTicketInput = {
  ticket_number: string
  title: string
  client_id: string
  status?: string
  priority?: string
  assigned_agent_id?: string | null
  due_date?: string | null
}

export async function createTicket(input: CreateTicketInput) {
  const res = await http.post<ApiEnvelope<Ticket>>('/tickets/', input)
  return res.data
}
