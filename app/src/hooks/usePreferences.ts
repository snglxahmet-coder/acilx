// ══════════════════════════════════════════════════════════════
// ACİLX — usePreferences Hook
// Tercih CRUD işlemleri
// ══════════════════════════════════════════════════════════════

import { useCallback } from 'react'
import { usePreferenceStore } from '@/stores/preference-store'
import { useScheduleStore } from '@/stores/schedule-store'
import { useAuthStore } from '@/stores/auth-store'
import type { ResidentStatus } from '@/types/schedule'

export function usePreferences() {
  const prefStore = usePreferenceStore()
  const { state, groupId } = useScheduleStore()
  const { user } = useAuthStore()

  const { y, m } = state.currentDate

  const savePreference = useCallback(
    async (tercihler: number[], kacinmalar: number[], durum: ResidentStatus) => {
      if (!user?.uid) return
      await prefStore.saveMyPreference(
        groupId,
        user.uid,
        y,
        m,
        tercihler,
        kacinmalar,
        durum,
      )
    },
    [prefStore, groupId, user?.uid, y, m],
  )

  const loadPreference = useCallback(async () => {
    if (!user?.uid) return null
    return prefStore.loadMyPreference(groupId, user.uid, y, m)
  }, [prefStore, groupId, user?.uid, y, m])

  const openPeriod = useCallback(
    () => prefStore.openPeriod(y, m),
    [prefStore, y, m],
  )

  const closePeriod = useCallback(
    () => prefStore.closePeriod(),
    [prefStore],
  )

  return {
    period: prefStore.period,
    entries: prefStore.entries,
    loading: prefStore.loading,
    savePreference,
    loadPreference,
    openPeriod,
    closePeriod,
    setPeriod: prefStore.setPeriod,
  }
}
