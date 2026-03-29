import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useNotifications } from '@/hooks/useNotifications'
import BottomNav from '@/components/BottomNav'
import NoAccess from '@/pages/NoAccess'
import { LogOut } from 'lucide-react'
import type { Role } from '@/types'

const ROLE_LABELS: Record<Role, string> = {
  resident: 'Asistan',
  chief_resident: 'Başasistan',
  super_admin: 'Süper Admin',
}

const ROLE_PATHS: Record<Role, string[]> = {
  resident: ['/dashboard', '/schedule', '/preferences', '/profile'],
  chief_resident: ['/residents', '/zones', '/schedule', '/swaps', '/profile'],
  super_admin: ['/clinics', '/residents', '/zones', '/schedule', '/swaps', '/profile'],
}

const ROLE_HOME: Record<Role, string> = {
  resident: '/dashboard',
  chief_resident: '/residents',
  super_admin: '/clinics',
}

export default function ProtectedLayout() {
  const { user, profile, loading, signOut } = useAuthStore()
  const location = useLocation()

  // FCM push bildirim — kullanıcı giriş yaptıysa izin iste + token kaydet
  useNotifications()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Yükleniyor…</p>
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  // Profil var ama klinik yok → JoinClinic'e yönlendir (super_admin hariç — o /clinics'e gider)
  if (!profile.clinicId && profile.role !== 'super_admin' && location.pathname !== '/join-clinic') {
    return <Navigate to="/join-clinic" replace />
  }

  // JoinClinic sayfası header/nav olmadan render edilsin
  if (location.pathname === '/join-clinic') {
    return <Outlet />
  }

  const role = profile.role

  if (location.pathname === '/') {
    return <Navigate to={ROLE_HOME[role]} replace />
  }

  const basePath = '/' + location.pathname.split('/')[1]
  const isAllowed = ROLE_PATHS[role].includes(basePath)
  const needsClinic =
    role === 'super_admin' && !profile.clinicId && location.pathname !== '/clinics'

  function renderContent() {
    if (needsClinic) {
      return (
        <div className="flex items-center justify-center p-6 min-h-[60vh]">
          <p className="text-sm text-warning text-center">
            Devam etmek için önce bir klinik seçin.
          </p>
        </div>
      )
    }
    if (!isAllowed) {
      return <NoAccess />
    }
    return <Outlet />
  }

  return (
    <div className="pb-16">
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-12 pt-[env(safe-area-inset-top)] border-b border-border bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-primary text-lg shrink-0">AcilX</span>
          <span className="text-sm text-foreground truncate">
            {profile.displayName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-primary text-primary shrink-0">
            {ROLE_LABELS[role]}
          </span>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
        >
          <LogOut size={14} />
          Çıkış
        </button>
      </header>
      {renderContent()}
      <BottomNav role={role} />
    </div>
  )
}
