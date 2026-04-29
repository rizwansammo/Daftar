import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'

import { createUser, deleteUser, listUsers, resetUserPassword, updateUser } from '../api/users'
import { useAuthStore } from '../store/auth'
import type { AgentUser } from '../types/users'

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

function roleLabel(role: AgentUser['role']) {
  return role === 'ADMIN' ? 'Manager' : 'Agent'
}

export function AgentsPage() {
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.me)
  const isManager = me?.role === 'ADMIN'

  const [search, setSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createFullName, setCreateFullName] = useState('')
  const [createDisplayName, setCreateDisplayName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<'ADMIN' | 'AGENT'>('AGENT')

  const [resetTarget, setResetTarget] = useState<AgentUser | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<AgentUser | null>(null)

  const [editTarget, setEditTarget] = useState<AgentUser | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<'ADMIN' | 'AGENT'>('AGENT')

  const params = useMemo(() => search.trim(), [search])

  const usersQuery = useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const res = await listUsers(params || undefined)
      return res.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!isManager) throw new Error('Only managers can update users')
      if (!editTarget) throw new Error('Missing target user')

      const full_name = editFullName.trim()
      const display_name = editDisplayName.trim()
      const email = editEmail.trim()

      if (!full_name || !display_name || !email) throw new Error('All fields are required')

      const res = await updateUser(editTarget.id, {
        full_name,
        display_name,
        email,
        role: editRole,
      })
      return res.data
    },
    onSuccess: () => {
      setEditTarget(null)
      setEditFullName('')
      setEditDisplayName('')
      setEditEmail('')
      setEditRole('AGENT')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Account updated')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not update account'))
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isManager) throw new Error('Only managers can create users')

      const full_name = createFullName.trim()
      const display_name = createDisplayName.trim()
      const email = createEmail.trim()
      if (!full_name || !display_name || !email || !createPassword) {
        throw new Error('All fields are required')
      }

      const res = await createUser({
        full_name,
        display_name,
        email,
        role: createRole,
        password: createPassword,
      })
      return res.data
    },
    onSuccess: () => {
      setIsCreateOpen(false)
      setCreateFullName('')
      setCreateDisplayName('')
      setCreateEmail('')
      setCreatePassword('')
      setCreateRole('AGENT')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Account created')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not create account'))
    },
  })

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!resetTarget) throw new Error('Missing target user')
      if (!newPassword) throw new Error('New password is required')

      const payload =
        isManager || resetTarget.id !== me?.id
          ? { new_password: newPassword }
          : { current_password: currentPassword, new_password: newPassword }

      await resetUserPassword(resetTarget.id, payload)
    },
    onSuccess: () => {
      setResetTarget(null)
      setCurrentPassword('')
      setNewPassword('')
      toast.success('Password reset successful')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not reset password'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) throw new Error('Missing target user')
      await deleteUser(deleteTarget.id)
    },
    onSuccess: () => {
      const name = deleteTarget?.display_name || deleteTarget?.full_name || 'User'
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(`${name} deleted`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Could not delete user'))
    },
  })

  const users = usersQuery.data?.results ?? []
  const errorMessage = usersQuery.isError ? getErrorMessage(usersQuery.error, 'Could not load users') : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold">Agents</div>
          <div className="mt-1 text-sm text-text-secondary">
            Team accounts and roles. Managers can create, delete, and reset passwords.
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-end">
          {isManager ? (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Create Agent
            </button>
          ) : null}

      {editTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[620px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Edit account</div>
                <div className="mt-1 text-sm text-text-secondary">{editTarget.email}</div>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-text-secondary">Full name</label>
                <input
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Display name</label>
                <input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Email</label>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  type="email"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'ADMIN' | 'AGENT')}
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                >
                  <option value="AGENT">Agent</option>
                  <option value="ADMIN">Manager</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
          <div className="w-full md:w-[420px]">
            <label className="text-xs font-medium text-text-secondary">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              className="mt-2 h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/30"
              placeholder="Search by display name, full name, or email"
            />
          </div>
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[620px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Create agent account</div>
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
                <label className="text-xs font-medium text-text-secondary">Full name</label>
                <input
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Display name</label>
                <input
                  value={createDisplayName}
                  onChange={(e) => setCreateDisplayName(e.target.value)}
                  type="text"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Email</label>
                <input
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  type="email"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Role</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as 'ADMIN' | 'AGENT')}
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                >
                  <option value="AGENT">Agent</option>
                  <option value="ADMIN">Manager</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Password</label>
                <input
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  type="password"
                  className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
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

      {resetTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[520px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Reset Password</div>
                <div className="mt-1 text-sm text-text-secondary">
                  {resetTarget.display_name || resetTarget.full_name || resetTarget.email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {!isManager && resetTarget.id === me?.id ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary">Current password</label>
                  <input
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    type="password"
                    className="h-10 w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  />
                </div>
              ) : null}
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

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {resetMutation.isPending ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[460px] rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="text-sm font-semibold">Delete Account</div>
            <div className="mt-2 text-sm text-text-secondary">
              Delete {deleteTarget.display_name || deleteTarget.full_name || deleteTarget.email}? This action cannot be undone.
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-secondary px-4 text-sm text-text-primary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {usersQuery.isPending ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-bg-hover" />
            ))}
          </div>
        </div>
      ) : usersQuery.isError ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="text-sm font-medium">Could not load users</div>
          <div className="mt-1 text-sm text-text-secondary">{errorMessage}</div>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-6 text-center">
          <div className="text-sm font-medium">No users found</div>
          <div className="mt-1 text-sm text-text-secondary">Try a different search.</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Display Name</th>
                <th className="px-4 py-3 font-medium">Full Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {users.map((user) => {
                const isSelf = user.id === me?.id
                const canReset = isManager || isSelf
                const canDelete = isManager && !isSelf
                const canEdit = isManager
                return (
                  <tr key={user.id} className="hover:bg-bg-hover/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{user.display_name || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{user.full_name || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary">{user.email}</td>
                    <td className="px-4 py-3 text-text-secondary">{roleLabel(user.role)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditTarget(user)
                              setEditFullName(user.full_name || '')
                              setEditDisplayName(user.display_name || '')
                              setEditEmail(user.email || '')
                              setEditRole(user.role)
                            }}
                            className="inline-flex h-8 items-center rounded-lg border border-border-subtle bg-bg-secondary px-3 text-xs font-medium text-text-primary hover:bg-bg-hover"
                          >
                            Edit
                          </button>
                        ) : null}
                        {canReset ? (
                          <button
                            type="button"
                            onClick={() => setResetTarget(user)}
                            className="inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500"
                          >
                            Reset
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(user)}
                            className="inline-flex h-8 items-center rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-500"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
