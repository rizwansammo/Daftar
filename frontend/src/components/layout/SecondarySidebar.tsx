import { NavLink, useLocation } from 'react-router-dom'
import { Layers } from 'lucide-react'

type NavItem = {
  to: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

const ticketItems: NavItem[] = [
  { to: '/tickets/clients', label: 'Clients', Icon: Layers },
]

function linkClass(isActive: boolean) {
  return [
    'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
    isActive
      ? 'bg-bg-hover text-text-primary'
      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
  ].join(' ')
}

export function SecondarySidebar() {
  const location = useLocation()

  const isTickets = location.pathname.startsWith('/tickets')
  if (!isTickets) return null

  return (
    <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-[200px] border-r border-border-subtle bg-bg-secondary">
      <nav className="px-3 py-2">
        <div className="space-y-1">
          {ticketItems.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => linkClass(isActive)}>
              <Icon className="h-4 w-4 text-text-muted group-hover:text-text-secondary" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  )
}
