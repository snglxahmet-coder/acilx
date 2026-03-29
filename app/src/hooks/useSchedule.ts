// ══════════════════════════════════════════════════════════════
// ACİLX — useSchedule Hook
// Çizelge çekme, dinleme, filtreleme
// ══════════════════════════════════════════════════════════════

import { useCallback, useMemo } from 'react'
import { useScheduleStore } from '@/stores/schedule-store'
import {
  gk,
  daysInMonth,
  monthKey,
  getDayRule,
  getZoneCount,
  calculateTarget,
  countTotal,
  countByZone,
  isWeekend,
  MONTHS,
} from '@/lib/schedule-helpers'
import {
  getDayViolations,
  calculateWarnings,
} from '@/lib/schedule-rules'
import type { Violation } from '@/types/schedule'

export function useSchedule() {
  const store = useScheduleStore()
  const { state, residents, zones } = store

  const { y, m } = state.currentDate
  const days = daysInMonth(y, m)
  const moKey = monthKey(y, m)

  // ── Günlük çizelge verisi ──
  const dailySchedule = useMemo(() => {
    const result: Record<number, { astIdx: number; zoneId: string }[]> = {}
    for (let d = 1; d <= days; d++) {
      result[d] = []
      for (let i = 0; i < residents.length; i++) {
        const zoneId = state.schedule[gk(i, d)]
        if (zoneId) result[d].push({ astIdx: i, zoneId })
      }
    }
    return result
  }, [state.schedule, residents.length, days])

  // ── Asistan bazlı nöbet sayıları ──
  const residentStats = useMemo(() => {
    return residents.map((r, i) => ({
      index: i,
      name: r.name,
      seniority: r.kidem,
      total: countTotal(state.schedule, i, days),
      target: calculateTarget(state, residents, i),
      byZone: Object.fromEntries(
        zones.map(z => [z.id, countByZone(state.schedule, i, z.id, days)]),
      ),
    }))
  }, [state, residents, zones, days])

  // ── Uyarı istatistikleri ──
  const warnings = useMemo(
    () => calculateWarnings(state, residents, zones),
    [state, residents, zones],
  )

  // ── Belirli gün ihlalleri ──
  const getViolationsForDay = useCallback(
    (day: number): Violation[] =>
      getDayViolations(state, residents, zones, day),
    [state, residents, zones],
  )

  // ── Belirli gündeki alan doluluk ──
  const getZoneFill = useCallback(
    (day: number, zoneId: string) => {
      const rule = getDayRule(state, day, zoneId)
      const count = getZoneCount(state.schedule, residents, day, zoneId)
      return { count, min: rule.min, max: rule.max, aktif: rule.aktif }
    },
    [state, residents],
  )

  // ── Hafta sonu kontrolü ──
  const isWE = useCallback(
    (day: number) => isWeekend(y, m, day),
    [y, m],
  )

  // ── Ay başlığı ──
  const monthTitle = `${MONTHS[m]} ${y}`

  return {
    ...store,
    days,
    moKey,
    monthTitle,
    dailySchedule,
    residentStats,
    warnings,
    getViolationsForDay,
    getZoneFill,
    isWE,
  }
}
