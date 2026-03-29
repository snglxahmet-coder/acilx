// ══════════════════════════════════════════════════════════════
// ACİLX — useResidents Hook
// Asistan listesi çekme ve yönetimi
// ══════════════════════════════════════════════════════════════

import { useCallback, useMemo } from 'react'
import { useScheduleStore } from '@/stores/schedule-store'
import {
  getResidentStatus,
  getResidentShifts,
  getMonthlyLeaves,
  monthKey,
  calculateTarget,
  countTotal,
  daysInMonth,
} from '@/lib/schedule-helpers'
import type { Resident, Seniority } from '@/types/schedule'

// ── Saf yardımcı fonksiyonlar (hook dışı) ──

function groupBySeniority(residents: Resident[]): Record<number, Resident[]> {
  const groups: Record<number, Resident[]> = {}
  for (const r of residents) {
    if (!groups[r.kidem]) groups[r.kidem] = []
    groups[r.kidem].push(r)
  }
  return groups
}

function buildResident(residents: Resident[], name: string, seniority: Seniority): Resident {
  const maxId = residents.reduce((max, r) => Math.max(max, r.id), -1)
  return { id: maxId + 1, name, kidem: seniority }
}

function applySeniorityUpdate(residents: Resident[], id: number, seniority: Seniority): Resident[] {
  return residents.map((r) => (r.id === id ? { ...r, kidem: seniority } : r))
}

// ── Hook ──

export function useResidents() {
  const { state, residents, setResidents, saveResidents } =
    useScheduleStore()

  const { y, m } = state.currentDate
  const moKey = monthKey(y, m)
  const days = daysInMonth(y, m)

  const bySeniority = useMemo(() => groupBySeniority(residents), [residents])

  const activeResidents = useMemo(
    () =>
      residents.filter((_, i) => {
        const dur = getResidentStatus(state.astProfiles, i)
        return dur === 'aktif' || dur === 'rot_evet'
      }),
    [residents, state.astProfiles],
  )

  const getStatus = useCallback(
    (astIdx: number) => getResidentStatus(state.astProfiles, astIdx),
    [state.astProfiles],
  )

  const getShifts = useCallback(
    (astIdx: number) => getResidentShifts(state.astProfiles, astIdx),
    [state.astProfiles],
  )

  const getLeaves = useCallback(
    (astIdx: number) => getMonthlyLeaves(state.astProfiles, astIdx, moKey),
    [state.astProfiles, moKey],
  )

  const getTargetInfo = useCallback(
    (astIdx: number) => ({
      target: calculateTarget(state, residents, astIdx),
      current: countTotal(state.schedule, astIdx, days),
    }),
    [state, residents, days],
  )

  const addResident = useCallback(
    (name: string, seniority: Seniority) =>
      setResidents([...residents, buildResident(residents, name, seniority)]),
    [residents, setResidents],
  )

  const addResidentsBatch = useCallback(
    (batch: { name: string; pgy: Seniority }[]) => {
      let list = [...residents]
      for (const r of batch) {
        list = [...list, buildResident(list, r.name, r.pgy)]
      }
      setResidents(list)
    },
    [residents, setResidents],
  )

  const removeResident = useCallback(
    (id: number) => setResidents(residents.filter((r) => r.id !== id)),
    [residents, setResidents],
  )

  const updateSeniority = useCallback(
    (id: number, seniority: Seniority) =>
      setResidents(applySeniorityUpdate(residents, id, seniority)),
    [residents, setResidents],
  )

  return {
    residents,
    activeResidents,
    bySeniority,
    getStatus,
    getShifts,
    getLeaves,
    getTargetInfo,
    addResident,
    addResidentsBatch,
    removeResident,
    updateSeniority,
    saveResidents,
  }
}
