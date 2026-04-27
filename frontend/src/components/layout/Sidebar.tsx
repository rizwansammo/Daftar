import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  Settings,
  StickyNote,
  Ticket,
  Users,
} from 'lucide-react'

type NavItem = {
  to: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

const items: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', Icon: Users },
  { to: '/tickets', label: 'Tickets', Icon: Ticket },
  { to: '/schedule', label: 'Schedule', Icon: CalendarDays },
  { to: '/agents', label: 'Agents', Icon: Users },
  { to: '/reminders', label: 'Reminders', Icon: StickyNote },
  { to: '/docs', label: 'Docs', Icon: BookOpen },
  { to: '/settings/profile', label: 'Settings', Icon: Settings },
]

function linkClass(isActive: boolean) {
  return [
    'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
    isActive
      ? 'bg-bg-hover text-text-primary'
      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
  ].join(' ')
}

export function Sidebar(props: { collapsed: boolean }) {
  return (
    <aside
      className={[
        'sticky top-14 h-[calc(100vh-3.5rem)] border-r border-border-subtle bg-bg-secondary transition-[width] duration-200',
        props.collapsed ? 'w-[72px]' : 'w-[200px]',
      ].join(' ')}
    >
      <nav className={[props.collapsed ? 'px-2' : 'px-3', 'py-2'].join(' ')}>
        <div className="space-y-1">
          {items
            .map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    linkClass(isActive),
                    props.collapsed ? 'justify-center px-0' : '',
                  ].join(' ')
                }
              >
                <Icon className="h-4 w-4 text-text-muted group-hover:text-text-secondary" />
                {props.collapsed ? null : <span>{label}</span>}
              </NavLink>
            ))}
        </div>
      </nav>
    </aside>
  )
}
