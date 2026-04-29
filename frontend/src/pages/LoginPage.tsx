import { useState } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { login, me } from '../api/auth'
import { useAuthStore } from '../store/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const setMe = useAuthStore((s) => s.setMe)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email.trim(), password)
      const meRes = await me()
      setMe(meRes.data)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      toast.success('Welcome back')
      const from = (location.state as { from?: Location } | null)?.from
      navigate(from ? from.pathname : '/dashboard', { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const data = err.response?.data as
          | { message?: string; errors?: unknown; detail?: unknown }
          | undefined

        const errorsDetail =
          typeof (data?.errors as { detail?: unknown } | undefined)?.detail === 'string'
            ? ((data?.errors as { detail?: unknown }).detail as string)
            : undefined

        const message =
          errorsDetail ??
          (typeof data?.detail === 'string' ? data.detail : undefined) ??
          data?.message ??
          (status ? `Login failed (${status})` : err.message)

        toast.error(message)
      } else {
        toast.error('Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent-primary/20 blur-[90px]" />
          <div className="absolute -bottom-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent-secondary/15 blur-[90px]" />
        </div>

        <div className="mx-auto flex min-h-screen max-w-[1400px] items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-[420px] rounded-xl border border-border-subtle bg-bg-card p-6 shadow-sm"
          >
            <div className="mb-6">
              <div className="text-sm font-semibold tracking-tight">Daftar Portal</div>
              <div className="mt-1 text-sm text-text-secondary">Sign in to continue</div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  name="email"
                  autoComplete="email"
                  spellCheck={false}
                  autoCapitalize="none"
                  required
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
                  placeholder="********"
                />
              </div>
              <button
                disabled={loading}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-accent-primary text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-70"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
              <div className="text-center text-xs text-text-muted">
                Invite-only system. Contact an admin if you need access.
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
