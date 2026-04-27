import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { me } from '../../api/auth'
import { useAuthStore } from '../../store/auth'

export function RequireAuth() {
  const location = useLocation()
  const setMe = useAuthStore((s) => s.setMe)

  const query = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await me()
      return res.data
    },
    retry: false,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (query.data) setMe(query.data)
    if (query.isError) setMe(null)
  }, [query.data, query.isError, setMe])

  if (query.isPending) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <div className="mx-auto flex min-h-screen max-w-[1400px] items-center justify-center px-6">
          <div className="w-full max-w-[420px] rounded-xl border border-border-subtle bg-bg-card p-6">
            <div className="h-4 w-40 animate-pulse rounded bg-bg-hover" />
            <div className="mt-3 h-3 w-64 animate-pulse rounded bg-bg-hover" />
            <div className="mt-6 h-10 w-full animate-pulse rounded-xl bg-bg-hover" />
          </div>
        </div>
      </div>
    )
  }

  if (query.isError || !query.data) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
