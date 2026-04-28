import { http } from './http'
import type { ApiEnvelope } from '../types/auth'

export type DashboardStatsParams = {
  date?: string
  q?: string
}

export type DashboardTrendPoint = {
  date: string | null
  seconds: number
}

export type DashboardStats = {
  system: {
    server_time: string
    started_at: string
    uptime_seconds: number
    version: string | null
  }
  selected_date: string
  trend_days: number
  agent: {
    hours: {
      today_seconds: number
      week_seconds: number
    }
    trend: DashboardTrendPoint[]
  }
  manager: null | {
    leaderboard: { user_id: string; name: string; seconds: number }[]
    trend: DashboardTrendPoint[]
    docs: {
      created_this_week: number
      updated_recently: { id: string; title: string; updated_at: string | null; last_edited_by: string | null }[]
      created_today: { id: string; title: string; created_at: string | null; author: string | null }[]
      clients_missing_runbook: { id: string; name: string }[]
      runbook_category_exists: boolean
    }
    search: {
      query: string
      results: { id: string; title: string; updated_at: string | null }[]
    }
  }
}

export async function getDashboardStats(params: DashboardStatsParams = {}) {
  const res = await http.get<ApiEnvelope<DashboardStats>>('/dashboard/', {
    params: {
      ...(params.date ? { date: params.date } : {}),
      ...(params.q ? { q: params.q } : {}),
    },
  })
  return res.data
}
