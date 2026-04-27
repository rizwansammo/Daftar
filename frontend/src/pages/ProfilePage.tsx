import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'

import { updateProfile } from '../api/auth'
import { resetUserPassword } from '../api/users'
import { useAuthStore } from '../store/auth'
import type { ThemePreference } from '../types/auth'

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

export function ProfilePage() {
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.me)
  const setMe = useAuthStore((s) => s.setMe)

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [themePreference, setThemePreference] = useState<ThemePreference>('system')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (!me) return
    setEmail(me.email || '')
    setFullName(me.full_name || '')
    setDisplayName(me.display_name || '')
    setTimezone(me.timezone || 'UTC')
    setThemePreference(me.theme_preference || 'system')
  }, [me])

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!email.trim()) throw new Error('Email is required')
      if (!displayName.trim()) throw new Error('Display name is required')
      const res = await updateProfile({
        email: email.trim(),
        full_name: fullName.trim(),
        display_name: displayName.trim(),
        timezone: timezone.trim() || 'UTC',
        theme_preference: themePreference,
      })
      return res.data
    },
    onSuccess: (updated) => {
      setMe(updated)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      toast.success('Profile updated')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not update profile'))
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!me?.id) throw new Error('Missing current user')
      if (!currentPassword) throw new Error('Current password is required')
      if (!newPassword) throw new Error('New password is required')

      await resetUserPassword(me.id, {
        current_password: currentPassword,
        new_password: newPassword,
      })
    },
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      toast.success('Password updated')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not update password'))
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Profile</div>
        <div className="mt-1 text-sm text-text-secondary">
          Update your account details and password.
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              type="text"
              className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              type="text"
              className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">Theme preference</label>
            <select
              value={themePreference}
              onChange={(e) => setThemePreference(e.target.value as ThemePreference)}
              className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
            >
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium text-text-secondary">Timezone</label>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              type="text"
              className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
              placeholder="UTC"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => saveProfileMutation.mutate()}
            disabled={saveProfileMutation.isPending}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {saveProfileMutation.isPending ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
        <div className="text-sm font-semibold">Reset Password</div>
        <div className="mt-1 text-sm text-text-secondary">
          Use your current password to set a new one.
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">Current password</label>
            <input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">New password</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => resetPasswordMutation.mutate()}
            disabled={resetPasswordMutation.isPending}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {resetPasswordMutation.isPending ? 'Updating...' : 'Update password'}
          </button>
        </div>
      </div>
    </div>
  )
}
