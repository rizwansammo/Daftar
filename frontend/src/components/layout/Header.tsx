import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Moon, Sun } from 'lucide-react'
import toast from 'react-hot-toast'

import { logout, me } from '../../api/auth'
import { useAuthStore } from '../../store/auth'

function IconButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        'inline-flex h-9 w-9 items-center justify-center rounded-xl',
        'border border-border-subtle bg-bg-card',
        'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
        'transition focus:outline-none focus:ring-2 focus:ring-accent-primary/40',
        props.className ?? '',
      ].join(' ')}
    />
  )
}

export function Header() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setMe = useAuthStore((s) => s.setMe)
  const meState = useAuthStore((s) => s.me)
  const [isLight, setIsLight] = useState(() =>
    document.documentElement.classList.contains('light'),
  )

  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await me()
      return res.data
    },
    retry: false,
  })

  useEffect(() => {
    if (data) setMe(data)
  }, [data, setMe])

  async function onLogout() {
    await logout()
    setMe(null)
    queryClient.removeQueries({ queryKey: ['me'] })
    toast.success('Logged out')
    navigate('/login', { replace: true })
  }

  function toggleTheme() {
    const nextIsLight = !isLight
    document.documentElement.classList.toggle('light', nextIsLight)
    localStorage.setItem('daftar-theme', nextIsLight ? 'light' : 'dark')
    setIsLight(nextIsLight)
  }

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border-subtle bg-bg-secondary/80 backdrop-blur">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-accent-primary/20 ring-1 ring-border-subtle" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">Daftar</div>
              <div className="text-xs text-text-muted">Portal</div>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <div className="text-xs text-text-muted">Signed in as</div>
            <div className="text-xs font-medium text-text-secondary">
              {meState?.full_name || meState?.email || '—'}
            </div>
          </div>
          <IconButton onClick={toggleTheme} aria-label="Toggle theme">
            {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </IconButton>
          <IconButton onClick={onLogout} aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </header>
  )
}
