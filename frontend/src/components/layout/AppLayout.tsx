import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const raw = localStorage.getItem('daftar-sidebar-collapsed')
    return raw === '1'
  })

  useEffect(() => {
    localStorage.setItem('daftar-sidebar-collapsed', isSidebarCollapsed ? '1' : '0')
  }, [isSidebarCollapsed])

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <Header />
      <div className="relative flex">
        <Sidebar collapsed={isSidebarCollapsed} />
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((v) => !v)}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ left: (isSidebarCollapsed ? 72 : 200) - 10 }}
          className={[
            'absolute top-3 z-10',
            'h-5 w-5 rounded-full',
            'border border-border-subtle bg-bg-card',
            'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            'transition focus:outline-none focus:ring-2 focus:ring-accent-primary/40 transition-[left] duration-200',
            'flex items-center justify-center',
          ].join(' ')}
        >
          {isSidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
        <div className="min-w-0 flex-1">
          <main className="mx-auto w-full max-w-[1700px] px-6 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
