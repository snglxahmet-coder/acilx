import { useEffect, useState, useMemo, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, AlertCircle } from 'lucide-react'
import CalendarGrid from '@/components/schedule/CalendarGrid'
import ShiftList from '@/components/schedule/ShiftList'
import ShiftDetail from '@/components/schedule/ShiftDetail'
import StatsCards from '@/components/schedule/StatsCards'
import ScheduleAdmin from '@/components/schedule/ScheduleAdmin'
import type { DayShift, ShiftStats } from '@/components/schedule/schedule-ui-types'
import { useAuthStore } from '@/stores/auth-store'
import { useScheduleStore } from '@/stores/schedule-store'
import { useSchedule } from '@/hooks/useSchedule'
import { gk, isWeekend } from '@/lib/schedule-helpers'
import { checkSwapEligibility } from '@/lib/schedule-analysis'

export default function Schedule() {
  const { user, profile } = useAuthStore()
  const { loading, loadFromFirestore, setGroupId, changeMonth } = useScheduleStore()
  const { state, residents, zones, days, dailySchedule } = useSchedule()
  const isAdmin = profile?.role === 'chief_resident' || profile?.role === 'super_admin'

  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedDayData, setSelectedDayData] = useState<DayShift | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid || !profile?.clinicId) return
    setGroupId(profile.clinicId)
    loadFromFirestore(user.uid).catch(() => setError('Çizelge yüklenemedi.'))
  }, [user?.uid, profile?.clinicId, loadFromFirestore, setGroupId])

  const { y, m } = state.currentDate

  // Kullanıcının asistan index'i
  const myIdx = useMemo(() => {
    if (!profile?.displayName) return -1
    return residents.findIndex(
      (r) => r.name.toLowerCase() === profile.displayName.toLowerCase(),
    )
  }, [residents, profile?.displayName])

  // Gerçek veriden DayShift[] oluştur
  const dayShifts = useMemo((): DayShift[] => {
    const today = new Date()
    const result: DayShift[] = []

    for (let d = 1; d <= days; d++) {
      const dayAssignments = dailySchedule[d] || []
      result.push(buildDayShift(d, y, m, today, dayAssignments, residents, zones, myIdx))
    }

    return result
  }, [dailySchedule, residents, zones, days, y, m, myIdx])

  // İstatistikler
  const stats = useMemo((): ShiftStats => {
    if (myIdx < 0) return { totalShifts: 0, weekendShifts: 0, holidayShifts: 0, weekdayShifts: 0 }
    let total = 0
    let we = 0
    for (let d = 1; d <= days; d++) {
      if (state.schedule[gk(myIdx, d)]) {
        total++
        if (isWeekend(y, m, d)) we++
      }
    }
    return { totalShifts: total, weekendShifts: we, holidayShifts: 0, weekdayShifts: total - we }
  }, [myIdx, state.schedule, days, y, m])

  // Takas rozeti: benim nöbetim olmayan günlerde uygun takas var mı?
  const swapAvailability = useMemo((): Map<number, boolean> => {
    const map = new Map<number, boolean>()
    if (myIdx < 0) return map

    // Benim nöbet günlerimi bul
    const myShifts: { day: number; zoneId: string }[] = []
    for (let d = 1; d <= days; d++) {
      const z = state.schedule[gk(myIdx, d)]
      if (z) myShifts.push({ day: d, zoneId: z })
    }
    if (myShifts.length === 0) return map

    for (let d = 1; d <= days; d++) {
      // Kendi nöbetimse rozet gösterme
      if (state.schedule[gk(myIdx, d)]) continue

      // Bu günde nöbeti olan asistanları bul
      let hasMatch = false
      for (let iB = 0; iB < residents.length && !hasMatch; iB++) {
        if (iB === myIdx) continue
        const zoneB = state.schedule[gk(iB, d)]
        if (!zoneB) continue

        // Benim herhangi bir nöbetimle takas edilebilir mi?
        for (const ms of myShifts) {
          const elig = checkSwapEligibility(
            state, residents,
            myIdx, ms.day, ms.zoneId,
            iB, d, zoneB,
          )
          if (elig.ok) { hasMatch = true; break }
        }
      }
      if (hasMatch) map.set(d, true)
    }

    return map
  }, [myIdx, state, residents, days])

  const handleNavMonth = useCallback((delta: number) => {
    let newM = m + delta
    let newY = y
    if (newM > 11) { newM = 0; newY++ }
    if (newM < 0) { newM = 11; newY-- }
    changeMonth(newY, newM)
    if (user?.uid) {
      loadFromFirestore(user.uid).catch(() => setError('Çizelge yüklenemedi.'))
    }
  }, [y, m, changeMonth, loadFromFirestore, user?.uid])

  function handleDaySelect(day: number, data: DayShift) {
    setSelectedDay(day)
    setSelectedDayData(data)
    setSheetOpen(true)
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 pb-20 max-w-md mx-auto">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 max-w-md mx-auto space-y-4">
      <h1 className="text-lg font-bold">Nöbet Çizelgem</h1>

      <StatsCards stats={stats} />

      {isAdmin && <ScheduleAdmin />}

      <Tabs defaultValue="calendar">
        <TabsList className="w-full">
          <TabsTrigger value="calendar" className="flex-1">
            Takvim
          </TabsTrigger>
          <TabsTrigger value="list" className="flex-1">
            Liste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-3">
          <CalendarGrid
            days={dayShifts}
            year={y}
            month={m}
            onDaySelect={handleDaySelect}
            selectedDay={selectedDay}
            onPrevMonth={() => handleNavMonth(-1)}
            onNextMonth={() => handleNavMonth(1)}
            swapAvailability={swapAvailability}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-3">
          <ShiftList
            days={dayShifts}
            year={y}
            month={m}
            onDaySelect={handleDaySelect}
            onPrevMonth={() => handleNavMonth(-1)}
            onNextMonth={() => handleNavMonth(1)}
          />
        </TabsContent>
      </Tabs>

      <ShiftDetail
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        day={selectedDayData}
        year={y}
        month={m}
        myIdx={myIdx}
      />

    </div>
  )
}

type DayAssignment = { astIdx: number; zoneId: string }

function buildDayShift(
  d: number, y: number, m: number, today: Date,
  dayAssignments: DayAssignment[],
  residents: { name: string; kidem: number }[],
  zones: { id: string; name: string; color: string }[],
  myIdx: number,
): DayShift {
  const dow = new Date(y, m, d).getDay()

  const assignments = groupByZone(dayAssignments, residents, zones)
  const myZone = findMyZone(dayAssignments, residents, zones, myIdx)

  return {
    day: d,
    dayOfWeek: dow,
    isWeekend: dow === 0 || dow === 6,
    isToday: today.getFullYear() === y && today.getMonth() === m && today.getDate() === d,
    assignments,
    totalCount: dayAssignments.length,
    myZone,
  }
}

function groupByZone(
  dayAssignments: DayAssignment[],
  residents: { name: string; kidem: number }[],
  zones: { id: string; name: string; color: string }[],
) {
  const zoneMap = new Map<string, { uid: string; name: string; seniority: number }[]>()
  for (const { astIdx, zoneId } of dayAssignments) {
    const r = residents[astIdx]
    if (!r) continue
    if (!zoneMap.has(zoneId)) zoneMap.set(zoneId, [])
    zoneMap.get(zoneId)!.push({ uid: String(astIdx), name: r.name, seniority: r.kidem })
  }
  return Array.from(zoneMap.entries()).map(([zoneId, res]) => {
    const zone = zones.find((z) => z.id === zoneId)
    return {
      zone: { id: zoneId, name: zone?.name ?? zoneId, color: zone?.color ?? '#888' },
      residents: res,
    }
  })
}

function findMyZone(
  dayAssignments: DayAssignment[],
  _residents: { name: string; kidem: number }[],
  zones: { id: string; name: string; color: string }[],
  myIdx: number,
): DayShift['myZone'] {
  if (myIdx < 0) return undefined
  const myAssignment = dayAssignments.find((a) => a.astIdx === myIdx)
  if (!myAssignment) return undefined
  const z = zones.find((zn) => zn.id === myAssignment.zoneId)
  if (!z) return undefined
  return { id: z.id, name: z.name, color: z.color }
}
