// ══════════════════════════════════════════════════════════════
// ACİLX — Nöbet Çizelge Store (Zustand)
// ══════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type {
  ScheduleState,
  Resident,
  Zone,
  DayRule,
  AlgoConfig,
  GenLog,
  Seniority,
} from '@/types/schedule'
import { createDefaultState } from '@/lib/schedule-config'
import {
  gk,
  checkWriteBlock,
  canAssign as canAssignHelper,
} from '@/lib/schedule-helpers'
import { generateSchedule } from '@/lib/schedule-algorithm'
import {
  saveScheduleState,
  loadScheduleState,
  loadZones,
  loadResidents,
  saveZones as saveZonesService,
  saveResidents as saveResidentsService,
} from '@/services/schedule-service'

// ── Store Interface ──────────────────────────────────────────

interface ScheduleStore {
  // Data
  state: ScheduleState
  residents: Resident[]
  zones: Zone[]
  loading: boolean
  lastGenLog: GenLog | null
  groupId: string

  // Setters
  setGroupId: (id: string) => void
  setState: (patch: Partial<ScheduleState>) => void
  setResidents: (r: Resident[]) => void
  setZones: (z: Zone[]) => void

  // Schedule operations
  assignShift: (astIdx: number, day: number, zoneId: string) => string | null
  removeShift: (astIdx: number, day: number) => void
  generateSchedule: () => GenLog
  clearSchedule: () => void
  changeMonth: (y: number, m: number) => void

  // Config operations
  updateDayRule: (zoneId: string, patch: Partial<DayRule>) => void
  updateQuota: (zoneId: string, seniority: Seniority, value: number) => void
  updateMaxHours: (seniority: Seniority, hours: number) => void
  updateAlgoConfig: (patch: Partial<AlgoConfig>) => void

  // Persistence
  loadFromFirestore: (userId: string) => Promise<void>
  saveToFirestore: (userId: string) => Promise<void>
  saveZones: (userId: string) => Promise<void>
  saveResidents: (userId: string) => Promise<void>
}

// ── Store ────────────────────────────────────────────────────

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  state: createDefaultState(),
  residents: [],
  zones: [],
  loading: false,
  lastGenLog: null,
  groupId: 'default',

  setGroupId: (id) => set({ groupId: id }),

  setState: (patch) =>
    set((s) => ({ state: { ...s.state, ...patch } })),

  setResidents: (r) => set({ residents: r }),
  setZones: (z) => set({ zones: z }),

  assignShift: (astIdx, day, zoneId) => {
    const { state, residents } = get()
    const block = checkWriteBlock(state, astIdx, day)
    if (block) return block

    if (!canAssignHelper(state, residents, astIdx, day, zoneId, true)) {
      return 'Bu atama yapılamaz — kural engeli'
    }

    const newSchedule = { ...state.schedule }
    newSchedule[gk(astIdx, day)] = zoneId
    set({ state: { ...state, schedule: newSchedule } })
    return null
  },

  removeShift: (astIdx, day) => {
    const { state } = get()
    const newSchedule = { ...state.schedule }
    delete newSchedule[gk(astIdx, day)]
    set({ state: { ...state, schedule: newSchedule } })
  },

  generateSchedule: () => {
    const { state, residents, zones } = get()
    const result = generateSchedule(state, residents, zones)
    set({
      state: { ...state, schedule: result.schedule },
      lastGenLog: result.log,
    })
    return result.log
  },

  clearSchedule: () => {
    const { state } = get()
    set({
      state: {
        ...state,
        schedule: {},
        dayOverride: {},
        prevMonthLastDay: {},
        nextMonthFirstDay: {},
      },
    })
  },

  changeMonth: (y, m) => {
    const { state } = get()
    set({
      state: {
        ...state,
        schedule: {},
        dayOverride: {},
        monthOverride: {},
        kapaliGunler: {},
        prevMonthLastDay: {},
        nextMonthFirstDay: {},
        currentDate: { y, m },
      },
    })
  },

  updateDayRule: (zoneId, patch) => {
    const { state } = get()
    const current = state.defaultDayMin[zoneId] ?? {}
    set({
      state: {
        ...state,
        defaultDayMin: {
          ...state.defaultDayMin,
          [zoneId]: { ...current, ...patch },
        },
      },
    })
  },

  updateQuota: (zoneId, seniority, value) => {
    const { state } = get()
    const current = state.quota[zoneId] ?? {}
    set({
      state: {
        ...state,
        quota: {
          ...state.quota,
          [zoneId]: { ...current, [seniority]: value },
        },
      },
    })
  },

  updateMaxHours: (seniority, hours) => {
    const { state } = get()
    set({
      state: {
        ...state,
        maxHours: { ...state.maxHours, [seniority]: hours },
      },
    })
  },

  updateAlgoConfig: (patch) => {
    const { state } = get()
    set({
      state: {
        ...state,
        algoConfig: { ...state.algoConfig, ...patch },
      },
    })
  },

  loadFromFirestore: async (_userId) => {
    const { groupId, state } = get()
    set({ loading: true })
    try {
      const [schedResult, zonesResult, residentsResult] = await Promise.all([
        loadScheduleState(groupId, state.currentDate.y, state.currentDate.m, true),
        loadZones(groupId),
        loadResidents(groupId),
      ])

      const updates: Partial<ScheduleStore> = { loading: false }

      if (schedResult.found) {
        updates.state = {
          ...state,
          ...schedResult.monthlyData,
          ...schedResult.globalData,
        }
      }
      if (zonesResult.found) {
        updates.zones = zonesResult.zones
      }
      if (residentsResult.found) {
        updates.residents = residentsResult.residents
      }

      set(updates as Partial<ScheduleStore>)
    } catch (err) {
      console.error('Firestore yükleme hatası:', err)
      set({ loading: false })
    }
  },

  saveToFirestore: async (userId) => {
    const { groupId, state } = get()
    try {
      await saveScheduleState(groupId, state, userId)
    } catch (err) {
      console.error('Firestore kayıt hatası:', err)
    }
  },

  saveZones: async (userId) => {
    const { groupId, zones } = get()
    try {
      await saveZonesService(groupId, zones, {}, {}, userId)
    } catch (err) {
      console.error('Alan kayıt hatası:', err)
    }
  },

  saveResidents: async (userId) => {
    const { groupId, residents } = get()
    try {
      await saveResidentsService(groupId, residents, userId)
    } catch (err) {
      console.error('Asistan kayıt hatası:', err)
    }
  },
}))
