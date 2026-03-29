import { NavLink } from 'react-router-dom'
import {
  Home,
  Calendar,
  CalendarCheck,
  User,
  Users,
  Layers,
  ArrowLeftRight,
  Building,
} from 'lucide-react'
import type { Role } from '@/types'
import type { LucideIcon } from 'lucide-react'

interface Tab {
  label: string
  icon: LucideIcon
  to: string
}

const RESIDENT_TABS: Tab[] = [
  { label: 'Ana Sayfa', icon: Home, to: '/dashboard' },
  { label: 'Nöbet', icon: Calendar, to: '/schedule' },
  { label: 'Tercih', icon: CalendarCheck, to: '/preferences' },
  { label: 'Profilim', icon: User, to: '/profile' },
]

const CHIEF_TABS: Tab[] = [
  { label: 'Asistan', icon: Users, to: '/residents' },
  { label: 'Alan', icon: Layers, to: '/zones' },
  { label: 'Nöbet', icon: Calendar, to: '/schedule' },
  { label: 'Takas', icon: ArrowLeftRight, to: '/swaps' },
]

const ADMIN_TABS: Tab[] = [
  { label: 'Kliniklerim', icon: Building, to: '/clinics' },
  { label: 'Asistan', icon: Users, to: '/residents' },
  { label: 'Alan', icon: Layers, to: '/zones' },
  { label: 'Nöbet', icon: Calendar, to: '/schedule' },
  { label: 'Takas', icon: ArrowLeftRight, to: '/swaps' },
]

function getTabsForRole(role: Role): Tab[] {
  switch (role) {
    case 'super_admin':
      return ADMIN_TABS
    case 'chief_resident':
      return CHIEF_TABS
    default:
      return RESIDENT_TABS
  }
}

export default function BottomNav({ role }: { role: Role }) {
  const tabs = getTabsForRole(role)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`
            }
          >
            <tab.icon size={20} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
