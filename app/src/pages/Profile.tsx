import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  User,
  Mail,
  Building2,
  Shield,
  LogOut,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sun,
  Briefcase,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useScheduleStore } from '@/stores/schedule-store'
import { gk, isWeekend, daysInMonth } from '@/lib/schedule-helpers'
import { updatePassword } from 'firebase/auth'

const ROLE_LABELS: Record<string, string> = {
  resident: 'Asistan',
  chief_resident: 'Başasistan',
  super_admin: 'Yönetici',
}

export default function Profile() {
  const { profile, signOut } = useAuthStore()
  const { state, residents } = useScheduleStore()

  const [signingOut, setSigningOut] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)

  // Asistan index
  const myIdx = useMemo(() => {
    if (!profile?.displayName) return -1
    return residents.findIndex(
      (r) => r.name.toLowerCase() === profile.displayName.toLowerCase(),
    )
  }, [residents, profile?.displayName])

  // Nöbet istatistikleri
  const stats = useMemo(() => {
    if (myIdx < 0) return { total: 0, weekend: 0, weekday: 0 }
    const { y, m } = state.currentDate
    const days = daysInMonth(y, m)
    let total = 0
    let we = 0
    for (let d = 1; d <= days; d++) {
      if (state.schedule[gk(myIdx, d)]) {
        total++
        if (isWeekend(y, m, d)) we++
      }
    }
    return { total, weekend: we, weekday: total - we }
  }, [myIdx, state])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className="p-4 pb-20 max-w-md mx-auto space-y-4">
      <h1 className="text-lg font-bold">Profilim</h1>

      {/* Kullanıcı bilgileri */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <InfoRow icon={User} label="Ad Soyad" value={profile?.displayName ?? '—'} />
          <InfoRow icon={Mail} label="E-posta" value={profile?.email ?? '—'} />
          <InfoRow icon={Building2} label="Klinik" value={profile?.clinicId ?? 'Belirtilmemiş'} />
          <InfoRow
            icon={Shield}
            label="Rol"
            value={
              <Badge variant="secondary" className="text-[10px]">
                {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role ?? '—'}
              </Badge>
            }
          />
          {profile?.seniority && (
            <InfoRow icon={Shield} label="Kıdem" value={`PGY-${profile.seniority}`} />
          )}
        </CardContent>
      </Card>

      {/* Nöbet özeti */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Bu Ay Nöbet Özeti</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="grid grid-cols-3 gap-2">
            <StatMini icon={Calendar} label="Toplam" value={stats.total} />
            <StatMini icon={Briefcase} label="Hafta İçi" value={stats.weekday} />
            <StatMini icon={Sun} label="Hafta Sonu" value={stats.weekend} />
          </div>
        </CardContent>
      </Card>

      {/* Şifre değiştir */}
      {showPwForm ? (
        <PasswordChangeForm onClose={() => setShowPwForm(false)} />
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowPwForm(true)}
        >
          <Lock className="h-4 w-4 mr-2" />
          Şifre Değiştir
        </Button>
      )}

      {/* Çıkış */}
      <Button
        variant="destructive"
        className="w-full"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <LogOut className="h-4 w-4 mr-2" />
        )}
        Çıkış Yap
      </Button>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  )
}

function StatMini({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/50 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mb-1" />
      <span className="text-lg font-bold font-mono">{value}</span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  )
}

function PasswordChangeForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore()
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPw.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return }
    if (newPw !== confirmPw) { setError('Şifreler eşleşmiyor.'); return }
    if (!user) return

    setLoading(true)
    setError(null)
    try {
      await updatePassword(user, newPw)
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch {
      setError('Şifre değiştirilemedi. Tekrar giriş yapmanız gerekebilir.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Yeni Şifre</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              minLength={6}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Şifre Tekrar</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              minLength={6}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-xs text-green-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Şifre değiştirildi!
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" size="sm" className="flex-1" disabled={loading || success}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Kaydet'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
