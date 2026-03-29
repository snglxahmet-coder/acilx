// ══════════════════════════════════════════════════════════════
// ACİLX — Nöbet Firestore Servisi (nobet-firebase.js → TypeScript)
// ══════════════════════════════════════════════════════════════

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ScheduleState, Resident, Zone } from '@/types/schedule'
import { MONTHLY_KEYS, GLOBAL_KEYS } from '@/lib/schedule-helpers'

// ── Firestore Referansları ───────────────────────────────────

function scheduleRef(groupId: string, y: number, m: number) {
  return doc(db, 'groups', groupId, 'schedule', `${y}_${m}`)
}

function areasRef(groupId: string) {
  return doc(db, 'groups', groupId, 'assistants', 'areas')
}

function assistantsRef(groupId: string) {
  return doc(db, 'groups', groupId, 'assistants', 'list')
}

function preferenceRef(
  groupId: string,
  uid: string,
  y: number,
  m: number,
) {
  return doc(db, 'groups', groupId, 'preferences', `${uid}_${y}_${m}`)
}

// ── Schedule Kaydet ──────────────────────────────────────────

export async function saveScheduleState(
  groupId: string,
  state: ScheduleState,
  userId: string,
): Promise<void> {
  const { y, m } = state.currentDate
  try {
    await setDoc(scheduleRef(groupId, y, m), {
      schedule: state.schedule,
      defaultDayMin: state.defaultDayMin,
      minNobet: state.minNobet,
      quota: state.quota,
      maxHours: state.maxHours,
      dayOverride: state.dayOverride,
      monthOverride: state.monthOverride,
      kapaliGunler: state.kapaliGunler,
      prevMonthLastDay: state.prevMonthLastDay,
      nextMonthFirstDay: state.nextMonthFirstDay,
      listName: state.listName,
      astProfiles: state.astProfiles,
      algoConfig: state.algoConfig,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }, { merge: true })
  } catch (err) {
    console.error('Firestore schedule kayıt hatası:', err)
    throw err
  }
}

// ── Schedule Yükle ───────────────────────────────────────────

export interface LoadResult {
  found: boolean
  monthlyData?: Partial<ScheduleState>
  globalData?: Partial<ScheduleState>
}

export async function loadScheduleState(
  groupId: string,
  y: number,
  m: number,
  loadGlobals: boolean,
): Promise<LoadResult> {
  try {
    const snap = await getDoc(scheduleRef(groupId, y, m))
    if (!snap.exists()) return { found: false }

    const data = snap.data() as Record<string, unknown>
    const monthlyData: Record<string, unknown> = {}
    const globalData: Record<string, unknown> = {}

    for (const k of MONTHLY_KEYS) {
      if (data[k] !== undefined) monthlyData[k] = data[k]
    }

    if (loadGlobals) {
      for (const k of GLOBAL_KEYS) {
        if (data[k] !== undefined) globalData[k] = data[k]
      }
    }

    return {
      found: true,
      monthlyData: monthlyData as Partial<ScheduleState>,
      globalData: globalData as Partial<ScheduleState>,
    }
  } catch (err) {
    console.error('Firestore schedule okuma hatası:', err)
    return { found: false }
  }
}

// ── Alan Kaydet ──────────────────────────────────────────────

export async function saveZones(
  groupId: string,
  zones: Zone[],
  labelCache: Record<string, string>,
  clsCache: Record<string, string>,
  userId: string,
): Promise<void> {
  try {
    await setDoc(areasRef(groupId), {
      list: zones.map(z => ({ id: z.id, name: z.name, color: z.color })),
      areaCls: clsCache,
      areaLbl: labelCache,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
  } catch (err) {
    console.error('Firestore alan kayıt hatası:', err)
    throw err
  }
}

// ── Alan Yükle ───────────────────────────────────────────────

export interface ZonesLoadResult {
  found: boolean
  zones: Zone[]
  areaCls: Record<string, string>
  areaLbl: Record<string, string>
}

export async function loadZones(
  groupId: string,
): Promise<ZonesLoadResult> {
  try {
    const snap = await getDoc(areasRef(groupId))
    if (!snap.exists()) return { found: false, zones: [], areaCls: {}, areaLbl: {} }

    const data = snap.data()
    if (!data.list?.length) return { found: false, zones: [], areaCls: {}, areaLbl: {} }

    return {
      found: true,
      zones: (data.list as Zone[]).map(a => ({
        id: a.id,
        name: a.name,
        color: a.color,
      })),
      areaCls: (data.areaCls as Record<string, string>) ?? {},
      areaLbl: (data.areaLbl as Record<string, string>) ?? {},
    }
  } catch (err) {
    console.error('Firestore alan okuma hatası:', err)
    return { found: false, zones: [], areaCls: {}, areaLbl: {} }
  }
}

// ── Asistan Kaydet ───────────────────────────────────────────

export async function saveResidents(
  groupId: string,
  residents: Resident[],
  userId: string,
): Promise<void> {
  try {
    await setDoc(assistantsRef(groupId), {
      list: residents,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
  } catch (err) {
    console.error('Firestore asistan kayıt hatası:', err)
    throw err
  }
}

// ── Asistan Yükle ────────────────────────────────────────────

export async function loadResidents(
  groupId: string,
): Promise<{ found: boolean; residents: Resident[] }> {
  try {
    const snap = await getDoc(assistantsRef(groupId))
    if (!snap.exists()) return { found: false, residents: [] }

    const data = snap.data()
    if (!data.list?.length) return { found: false, residents: [] }

    return {
      found: true,
      residents: data.list as Resident[],
    }
  } catch (err) {
    console.error('Firestore asistan okuma hatası:', err)
    return { found: false, residents: [] }
  }
}

// ── Tercih Kaydet ────────────────────────────────────────────

export async function savePreference(
  groupId: string,
  uid: string,
  y: number,
  m: number,
  tercihGunlerAylik: number[],
  kacGunlerAylik: number[],
  durum: string,
): Promise<void> {
  try {
    await setDoc(preferenceRef(groupId, uid, y, m), {
      uid,
      tercihGunlerAylik,
      kacGunlerAylik,
      durum,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('Tercih kayıt hatası:', err)
    throw err
  }
}

// ── Tercih Yükle ─────────────────────────────────────────────

export async function loadPreference(
  groupId: string,
  uid: string,
  y: number,
  m: number,
): Promise<{
  found: boolean
  tercihGunlerAylik: number[]
  kacGunlerAylik: number[]
  durum: string
} | null> {
  try {
    const snap = await getDoc(preferenceRef(groupId, uid, y, m))
    if (!snap.exists()) return null

    const data = snap.data()
    return {
      found: true,
      tercihGunlerAylik: data.tercihGunlerAylik ?? [],
      kacGunlerAylik: data.kacGunlerAylik ?? [],
      durum: data.durum ?? 'aktif',
    }
  } catch (err) {
    console.error('Tercih okuma hatası:', err)
    return null
  }
}

// ── Rol Doğrulama ────────────────────────────────────────────

export async function verifyRole(
  uid: string,
): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    return (snap.exists() && (snap.data().role as string)) || 'asistan'
  } catch {
    return 'asistan'
  }
}
