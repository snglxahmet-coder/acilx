// ══════════════════════════════════════════════════════════════
// ACİLX — ScheduleAdmin
// Chief Resident / Super Admin için nöbet yönetim kontrolleri
// ══════════════════════════════════════════════════════════════

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useScheduleStore } from '@/stores/schedule-store'
import { usePreferences } from '@/hooks/usePreferences'
import { useAuthStore } from '@/stores/auth-store'
import { Wand2, Send, CalendarCheck, CalendarX, Loader2 } from 'lucide-react'

export default function ScheduleAdmin() {
  const { state, generateSchedule: runGenerate, lastGenLog } = useScheduleStore()
  const { user } = useAuthStore()
  const { period, openPeriod, closePeriod } = usePreferences()

  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setMessage(null)
    try {
      const log = runGenerate()
      const warns = log.uyarilar?.length ?? 0
      setMessage(
        warns > 0
          ? `Çizelge oluşturuldu — ${warns} uyarı var`
          : 'Çizelge başarıyla oluşturuldu',
      )
    } catch (err) {
      setMessage('Çizelge oluşturulurken hata oluştu')
    } finally {
      setGenerating(false)
    }
  }

  function handlePublish() {
    // Yayınlama: Firestore'a kaydet
    if (user?.uid) {
      useScheduleStore.getState().saveToFirestore(user.uid)
      setMessage('Çizelge yayınlandı')
    }
  }

  const hasSchedule = Object.keys(state.schedule).length > 0
  const prefActive = period?.active ?? false

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Yönetim Paneli</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tercih dönemi */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tercih Dönemi</span>
            <Badge
              variant={prefActive ? 'default' : 'secondary'}
              className="text-[10px]"
            >
              {prefActive ? 'Açık' : 'Kapalı'}
            </Badge>
          </div>
          {prefActive ? (
            <Button variant="outline" size="xs" onClick={closePeriod}>
              <CalendarX className="h-3 w-3 mr-1" />
              Kapat
            </Button>
          ) : (
            <Button variant="outline" size="xs" onClick={openPeriod}>
              <CalendarCheck className="h-3 w-3 mr-1" />
              Aç
            </Button>
          )}
        </div>

        {/* Çizelge oluştur */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 mr-1" />
            )}
            Çizelge Oluştur
          </Button>
          {hasSchedule && (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePublish}
            >
              <Send className="h-4 w-4 mr-1" />
              Yayınla
            </Button>
          )}
        </div>

        {/* Durum mesajı */}
        {message && (
          <p className="text-xs text-muted-foreground text-center">{message}</p>
        )}

        {/* Son oluşturma logu */}
        {lastGenLog && lastGenLog.uyarilar && lastGenLog.uyarilar.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Uyarılar:</p>
            {lastGenLog.uyarilar.slice(0, 5).map((w, i) => (
              <p key={i} className="text-[10px] text-destructive">
                {w.mesaj ?? w.tip}
              </p>
            ))}
            {lastGenLog.uyarilar.length > 5 && (
              <p className="text-[10px] text-muted-foreground">
                +{lastGenLog.uyarilar.length - 5} uyarı daha
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
