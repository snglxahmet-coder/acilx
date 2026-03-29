// ══════════════════════════════════════════════════════════════
// ACİLX — Tercih Dönemi Store (Zustand)
// ══════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type {
  PreferencePeriod,
  PreferenceEntry,
  ResidentStatus,
} from '@/types/schedule'
import {
  savePreference,
  loadPreference,
} from '@/services/schedule-service'

// ── Store Interface ──────────────────────────────────────────

interface PreferenceStore {
  period: PreferencePeriod | null
  entries: PreferenceEntry[]
  loading: boolean

  // Period management
  openPeriod: (year: number, month: number) => void
  closePeriod: () => void
  setPeriod: (p: PreferencePeriod | null) => void

  // Entry management
  setEntries: (e: PreferenceEntry[]) => void
  addEntry: (e: PreferenceEntry) => void

  // Preference CRUD
  saveMyPreference: (
    groupId: string,
    uid: string,
    year: number,
    month: number,
    tercihler: number[],
    kacinmalar: number[],
    durum: ResidentStatus,
  ) => Promise<void>

  loadMyPreference: (
    groupId: string,
    uid: string,
    year: number,
    month: number,
  ) => Promise<PreferenceEntry | null>
}

// ── Store ────────────────────────────────────────────────────

export const usePreferenceStore = create<PreferenceStore>((set) => ({
  period: null,
  entries: [],
  loading: false,

  openPeriod: (year, month) =>
    set({
      period: {
        active: true,
        year,
        month,
        openedAt: new Date().toISOString(),
      },
    }),

  closePeriod: () =>
    set((s) => ({
      period: s.period
        ? { ...s.period, active: false, closedAt: new Date().toISOString() }
        : null,
    })),

  setPeriod: (p) => set({ period: p }),
  setEntries: (e) => set({ entries: e }),

  addEntry: (e) =>
    set((s) => {
      const existing = s.entries.findIndex((x) => x.uid === e.uid)
      if (existing >= 0) {
        const updated = [...s.entries]
        updated[existing] = e
        return { entries: updated }
      }
      return { entries: [...s.entries, e] }
    }),

  saveMyPreference: async (
    groupId,
    uid,
    year,
    month,
    tercihler,
    kacinmalar,
    durum,
  ) => {
    set({ loading: true })
    try {
      await savePreference(
        groupId,
        uid,
        year,
        month,
        tercihler,
        kacinmalar,
        durum,
      )
    } catch (err) {
      console.error('Tercih kayıt hatası:', err)
    } finally {
      set({ loading: false })
    }
  },

  loadMyPreference: async (groupId, uid, year, month) => {
    set({ loading: true })
    try {
      const result = await loadPreference(groupId, uid, year, month)
      if (result) {
        const entry: PreferenceEntry = {
          uid,
          tercihGunlerAylik: result.tercihGunlerAylik,
          kacGunlerAylik: result.kacGunlerAylik,
          durum: result.durum as ResidentStatus,
        }
        set({ loading: false })
        return entry
      }
      set({ loading: false })
      return null
    } catch (err) {
      console.error('Tercih okuma hatası:', err)
      set({ loading: false })
      return null
    }
  },
}))
