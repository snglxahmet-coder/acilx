import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import PreferenceGrid from '@/components/preferences/PreferenceGrid'
import type { PreferenceEntry } from '@/components/preferences/PreferenceGrid'
import { usePreferences } from '@/hooks/usePreferences'
import { useAuthStore } from '@/stores/auth-store'
import { useScheduleStore } from '@/stores/schedule-store'
import { daysInMonth } from '@/lib/schedule-helpers'

export default function Preferences() {
  const { user } = useAuthStore()
  const { state } = useScheduleStore()
  const { period, loading, savePreference, loadPreference } = usePreferences()

  const { y, m } = state.currentDate
  const totalDays = daysInMonth(y, m)

  // Tercih/kaçınma state
  const [prefDays, setPrefDays] = useState<Map<number, PreferenceEntry['type']>>(new Map())
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Firestore'dan mevcut tercihleri yükle
  useEffect(() => {
    if (!user?.uid || loaded) return
    loadPreference().then((entry) => {
      if (entry) {
        const map = new Map<number, PreferenceEntry['type']>()
        for (const d of entry.tercihGunlerAylik ?? []) map.set(d, 'prefer')
        for (const d of entry.kacGunlerAylik ?? []) map.set(d, 'avoid')
        setPrefDays(map)
      }
      setLoaded(true)
    })
  }, [user?.uid, loadPreference, loaded])

  // PreferenceGrid'e verilebilecek format
  const preferences: PreferenceEntry[] = Array.from({ length: totalDays }, (_, i) => ({
    day: i + 1,
    type: prefDays.get(i + 1) ?? null,
  }))

  const handleToggle = useCallback((day: number, newType: PreferenceEntry['type']) => {
    setPrefDays((prev) => {
      const m = new Map(prev)
      m.set(day, newType)
      return m
    })
    setSaved(false)
    setSaveError(null)
  }, [])

  async function handleSave() {
    if (!isPeriodOpen) { setSaveError('Tercih dönemi kapalı.'); return }
    setSaveError(null)
    const tercihler: number[] = []
    const kacinmalar: number[] = []
    prefDays.forEach((type, day) => {
      if (type === 'prefer') tercihler.push(day)
      else if (type === 'avoid') kacinmalar.push(day)
    })
    try {
      await savePreference(tercihler, kacinmalar, 'aktif')
      setSaved(true)
    } catch {
      setSaveError('Tercihler kaydedilemedi.')
    }
  }

  const isPeriodOpen = period?.active === true

  if (loading && !loaded) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 max-w-md mx-auto space-y-4">
      <h1 className="text-lg font-bold">Tercihlerim</h1>
      <p className="text-sm text-muted-foreground">
        Nöbet tercihlerinizi günlere tıklayarak belirleyin.
      </p>

      {/* Dönem durumu */}
      <Card>
        <CardContent className="py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Tercih dönemi</span>
          <Badge variant={isPeriodOpen ? 'default' : 'secondary'}>
            {isPeriodOpen ? 'Açık' : 'Kapalı'}
          </Badge>
        </CardContent>
      </Card>

      {/* Dönem kapalı uyarısı */}
      {!isPeriodOpen && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
          <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
          <p className="text-xs text-yellow-700">Tercih dönemi şu an kapalıdır. Tercih girişi yapılamaz.</p>
        </div>
      )}

      {/* Tercih grid */}
      <PreferenceGrid preferences={preferences} onToggle={isPeriodOpen ? handleToggle : () => {}} />

      {/* Kaydet butonu */}
      <Button
        className="w-full"
        onClick={handleSave}
        disabled={loading || saved || !isPeriodOpen}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : saved ? (
          <CheckCircle2 className="h-4 w-4 mr-2" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        {saved ? 'Kaydedildi' : 'Tercihleri Kaydet'}
      </Button>

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{saveError}</p>
        </div>
      )}
    </div>
  )
}
