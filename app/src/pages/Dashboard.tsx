import { useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, ArrowRight, Bell, Clock, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import StatsCards from '@/components/schedule/StatsCards'
import type { ShiftStats } from '@/components/schedule/schedule-ui-types'
import { useAuthStore } from '@/stores/auth-store'
import { useScheduleStore } from '@/stores/schedule-store'
import { useSchedule } from '@/hooks/useSchedule'
import { gk, isWeekend, MONTHS } from '@/lib/schedule-helpers'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { loading, loadFromFirestore, setGroupId, zones } = useScheduleStore()
  const { state, residents, days } = useSchedule()

  useEffect(() => {
    if (!user?.uid || !profile?.clinicId) return
    setGroupId(profile.clinicId)
    loadFromFirestore(user.uid)
  }, [user?.uid, profile?.clinicId, loadFromFirestore, setGroupId])

  // Kullanıcının asistan index'ini bul (isim eşleştirmesi)
  const myIdx = useMemo(() => {
    if (!profile?.displayName) return -1
    return residents.findIndex(
      (r) => r.name.toLowerCase() === profile.displayName.toLowerCase(),
    )
  }, [residents, profile?.displayName])

  // İstatistikleri hesapla
  const stats = useMemo((): ShiftStats => {
    if (myIdx < 0) return { totalShifts: 0, weekendShifts: 0, holidayShifts: 0, weekdayShifts: 0 }
    const { y, m } = state.currentDate
    let total = 0
    let we = 0
    for (let d = 1; d <= days; d++) {
      if (state.schedule[gk(myIdx, d)]) {
        total++
        if (isWeekend(y, m, d)) we++
      }
    }
    return {
      totalShifts: total,
      weekendShifts: we,
      holidayShifts: 0,
      weekdayShifts: total - we,
    }
  }, [myIdx, state, days])

  // Sonraki nöbet
  const nextShift = useMemo(() => {
    if (myIdx < 0) return null
    const today = new Date()
    const { y, m } = state.currentDate
    const currentDay = today.getFullYear() === y && today.getMonth() === m ? today.getDate() : 0
    for (let d = currentDay + 1; d <= days; d++) {
      const zoneId = state.schedule[gk(myIdx, d)]
      if (zoneId) {
        const zone = zones.find((z) => z.id === zoneId)
        const date = new Date(y, m, d)
        const diffMs = date.getTime() - today.getTime()
        const diffDays = Math.max(0, Math.ceil(diffMs / 86400000))
        return { day: d, zone, diffDays, date }
      }
    }
    return null
  }, [myIdx, state, days, zones])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const displayName = profile?.displayName?.split(' ')[0] ?? 'Asistan'
  const { y, m } = state.currentDate

  return (
    <div className="p-4 pb-20 max-w-md mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-bold">Merhaba, {displayName}</h1>
        <p className="text-sm text-muted-foreground">
          {MONTHS[m]} {y} nöbet özeti
        </p>
      </div>

      {/* Sonraki nöbet kartı */}
      <NextShiftCard
        nextShift={nextShift}
        onNavigate={() => navigate('/schedule')}
      />

      {/* İstatistikler */}
      <StatsCards stats={stats} />

      {/* Bildirimler */}
      <NotificationsCard />

      {/* Hızlı erişim */}
      <div className="grid grid-cols-2 gap-2">
        <QuickLink label="Tercihler" onClick={() => navigate('/preferences')} />
        <QuickLink label="Profilim" onClick={() => navigate('/profile')} />
      </div>
    </div>
  )
}

function NextShiftCard({
  nextShift,
  onNavigate,
}: {
  nextShift: { day: number; zone: { id: string; name: string; color: string } | undefined; diffDays: number } | null
  onNavigate: () => void
}) {
  const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
  const { state } = useScheduleStore()
  const { y, m } = state.currentDate

  if (!nextShift) {
    return (
      <Card className="border-muted">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground text-center">
            Bu ay için planlanmış nöbetiniz yok.
          </p>
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={onNavigate}>
            Takvime Git
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  const date = new Date(y, m, nextShift.day)
  const dayName = DAY_NAMES[date.getDay()]

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Sıradaki Nöbetim
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold font-mono">
              {nextShift.day} {MONTHS[m]}
            </p>
            <p className="text-xs text-muted-foreground">{dayName}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {nextShift.zone && (
              <Badge
                className="text-xs px-2 py-1"
                style={{
                  background: nextShift.zone.color + '22',
                  color: nextShift.zone.color,
                  border: `1px solid ${nextShift.zone.color}55`,
                }}
              >
                {nextShift.zone.name}
              </Badge>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {nextShift.diffDays === 0
                ? 'Bugün'
                : nextShift.diffDays === 1
                  ? 'Yarın'
                  : `${nextShift.diffDays} gün sonra`}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full mt-3" onClick={onNavigate}>
          Takvime Git
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </CardContent>
    </Card>
  )
}

function NotificationsCard() {
  // Bildirim store'u henüz yok — statik mesajlar
  const items = [
    { id: '1', text: 'Nöbet çizelgesi yayınlandı', time: 'Bugün' },
    { id: '2', text: 'Tercih dönemi yakında kapanıyor', time: 'Dün' },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          Bildirimler
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Yeni bildirim yok.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.id} className="flex items-center justify-between">
                <span className="text-xs">{n.text}</span>
                <span className="text-[10px] text-muted-foreground">{n.time}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      className="h-auto py-3 flex flex-col items-center gap-1"
      onClick={onClick}
    >
      <span className="text-sm font-medium">{label}</span>
    </Button>
  )
}
