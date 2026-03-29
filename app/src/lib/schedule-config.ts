// ══════════════════════════════════════════════════════════════
// ACİLX — Nöbet Yapılandırma (nobet-config.js → TypeScript)
// Saf fonksiyonlar — framework bağımsız
// ══════════════════════════════════════════════════════════════

import type {
  Resident,
  ScheduleState,
  AlgoConfig,
  Seniority,
  SeniorityGroupRule,
} from '@/types/schedule'

import {
  monthKey,
  createDefaultDayRule,
  createDefaultAlgoConfig,
} from './schedule-helpers'

// ── Varsayılan State ─────────────────────────────────────────

export function createDefaultState(): ScheduleState {
  return {
    schedule: {},
    defaultDayMin: {
      s1: { min: 1, max: 3, kidemMin: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemMax: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemKurallari: {}, siftler: ['24h'] },
      s2: { min: 1, max: 3, kidemMin: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemMax: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemKurallari: {}, siftler: ['24h'] },
      r1: { min: 2, max: 4, kidemMin: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemMax: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemKurallari: {}, siftler: ['24h'] },
      r2: { min: 1, max: 3, kidemMin: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemMax: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemKurallari: {}, siftler: ['24h'] },
      mt: { min: 1, max: 3, kidemMin: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemMax: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemKurallari: {}, siftler: ['24h'] },
      yp: { min: 1, max: 2, kidemMin: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemMax: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, kidemKurallari: {}, siftler: ['24h'] },
    },
    minNobet: {
      s1: { 1: 1, 2: 1, 3: 1, 4: 0, 5: 0 }, s2: { 1: 1, 2: 1, 3: 1, 4: 0, 5: 0 },
      r1: { 1: 2, 2: 1, 3: 1, 4: 0, 5: 0 }, r2: { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0 },
      mt: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 }, yp: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 },
    },
    quota: {
      s1: { 1: 5, 2: 5, 3: 4, 4: 3, 5: 2 }, s2: { 1: 5, 2: 5, 3: 4, 4: 3, 5: 2 },
      r1: { 1: 6, 2: 5, 3: 3, 4: 1, 5: 0 }, r2: { 1: 6, 2: 5, 3: 3, 4: 2, 5: 0 },
      mt: { 1: 3, 2: 3, 3: 4, 4: 5, 5: 5 }, yp: { 1: 2, 2: 2, 3: 3, 4: 5, 5: 6 },
    },
    maxHours: { 1: 216, 2: 192, 3: 168, 4: 144, 5: 120 },
    dayOverride: {},
    monthOverride: {},
    kapaliGunler: {},
    prevMonthLastDay: {},
    nextMonthFirstDay: {},
    currentDate: { y: new Date().getFullYear(), m: new Date().getMonth() },
    listName: 'Acil Servis Nöbet Listesi',
    astProfiles: {},
    algoConfig: createDefaultAlgoConfig(),
  }
}

// ── Alan Yönetimi ────────────────────────────────────────────

/** Yeni alan eklerken varsayılan kuralları oluştur */
export function createZoneDefaults(
  zoneId: string,
  state: ScheduleState,
): ScheduleState {
  const updated = { ...state }
  if (!updated.defaultDayMin[zoneId]) {
    updated.defaultDayMin = {
      ...updated.defaultDayMin,
      [zoneId]: createDefaultDayRule(),
    }
  }
  if (!updated.quota[zoneId]) {
    updated.quota = {
      ...updated.quota,
      [zoneId]: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }
  }
  if (!updated.minNobet[zoneId]) {
    updated.minNobet = {
      ...updated.minNobet,
      [zoneId]: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }
  }
  return updated
}

/** Alan silindiğinde ilişkili verileri temizle */
export function removeZoneData(
  zoneId: string,
  state: ScheduleState,
): ScheduleState {
  const updated = { ...state }

  // Schedule'dan bu alanı temizle
  const newSchedule = { ...updated.schedule }
  for (const key of Object.keys(newSchedule)) {
    if (newSchedule[key] === zoneId) delete newSchedule[key]
  }
  updated.schedule = newSchedule

  // Konfigürasyonlardan temizle
  const { [zoneId]: _d, ...restDayMin } = updated.defaultDayMin
  updated.defaultDayMin = restDayMin
  const { [zoneId]: _q, ...restQuota } = updated.quota
  updated.quota = restQuota
  const { [zoneId]: _m, ...restMinNobet } = updated.minNobet
  updated.minNobet = restMinNobet

  return updated
}

// ── Kıdem Kuralı Güncelleme ──────────────────────────────────

/** Yalnız tutamaz kuralını aç/kapat */
export function toggleSoloRule(
  state: ScheduleState,
  zoneId: string,
  seniority: Seniority,
  enabled: boolean,
): ScheduleState {
  const updated = { ...state }
  const rule = { ...updated.defaultDayMin[zoneId] }
  const kurallari = { ...(rule.kidemKurallari ?? {}) }

  if (!kurallari[seniority]) {
    kurallari[seniority] = { yalnizTutamaz: false }
  }
  kurallari[seniority] = {
    ...kurallari[seniority],
    yalnizTutamaz: enabled,
  }

  if (enabled) {
    kurallari[seniority].yanindaKidemler ??= []
    kurallari[seniority].enAzKac ??= 1
  }

  rule.kidemKurallari = kurallari
  updated.defaultDayMin = { ...updated.defaultDayMin, [zoneId]: rule }
  return updated
}

/** Yanında olması gereken kıdemi toggle et */
export function toggleCompanionSeniority(
  state: ScheduleState,
  zoneId: string,
  seniority: Seniority,
  companion: Seniority,
  add: boolean,
): ScheduleState {
  const updated = { ...state }
  const rule = { ...updated.defaultDayMin[zoneId] }
  const kurallari = { ...(rule.kidemKurallari ?? {}) }
  const kural = { ...(kurallari[seniority] ?? { yalnizTutamaz: false }) }

  const list = [...(kural.yanindaKidemler ?? [])]
  if (add && !list.includes(companion)) {
    list.push(companion)
  } else if (!add) {
    const idx = list.indexOf(companion)
    if (idx >= 0) list.splice(idx, 1)
  }
  kural.yanindaKidemler = list

  if ((kural.enAzKac ?? 1) > list.length) {
    kural.enAzKac = Math.max(1, list.length)
  }

  kurallari[seniority] = kural
  rule.kidemKurallari = kurallari
  updated.defaultDayMin = { ...updated.defaultDayMin, [zoneId]: rule }
  return updated
}

// ── Kıdem Grup Kuralı Yönetimi ───────────────────────────────

/** Yeni kıdem grubu ekle */
export function addSeniorityGroup(
  state: ScheduleState,
  zoneId: string,
): ScheduleState {
  const updated = { ...state }
  const rule = { ...updated.defaultDayMin[zoneId] }
  const groups = [...(rule.kidemGrupKurallari ?? [])]
  groups.push({ kidemler: [], enAzKac: 0, enFazlaKac: 0 })
  rule.kidemGrupKurallari = groups
  updated.defaultDayMin = { ...updated.defaultDayMin, [zoneId]: rule }
  return updated
}

/** Kıdem grubunu sil */
export function removeSeniorityGroup(
  state: ScheduleState,
  zoneId: string,
  groupIdx: number,
): ScheduleState {
  const updated = { ...state }
  const rule = { ...updated.defaultDayMin[zoneId] }
  const groups = [...(rule.kidemGrupKurallari ?? [])]
  groups.splice(groupIdx, 1)
  rule.kidemGrupKurallari = groups
  updated.defaultDayMin = { ...updated.defaultDayMin, [zoneId]: rule }
  return updated
}

/** Kıdem grubundaki kıdemi toggle et */
export function toggleGroupSeniority(
  state: ScheduleState,
  zoneId: string,
  groupIdx: number,
  seniority: Seniority,
  add: boolean,
  residents: Resident[],
): ScheduleState {
  const updated = { ...state }
  const rule = { ...updated.defaultDayMin[zoneId] }
  const groups = [...(rule.kidemGrupKurallari ?? [])]
  const g = { ...groups[groupIdx] }
  const kidemler = [...(g.kidemler ?? [])]

  if (add && !kidemler.includes(seniority)) {
    kidemler.push(seniority)
  } else if (!add) {
    const idx = kidemler.indexOf(seniority)
    if (idx >= 0) kidemler.splice(idx, 1)
  }
  g.kidemler = kidemler as Seniority[]

  // Toplam asistan sayısına clamp
  const topAst = countGroupResidents(g, residents)
  if (g.enFazlaKac > topAst) g.enFazlaKac = topAst
  if (g.enAzKac > topAst) g.enAzKac = topAst
  if (g.enFazlaKac > 0 && g.enAzKac > g.enFazlaKac) {
    g.enFazlaKac = g.enAzKac
  }

  groups[groupIdx] = g
  rule.kidemGrupKurallari = groups
  updated.defaultDayMin = { ...updated.defaultDayMin, [zoneId]: rule }
  return updated
}

function countGroupResidents(
  group: SeniorityGroupRule,
  residents: Resident[],
): number {
  let total = 0
  for (const k of (group.kidemler ?? [])) {
    total += residents.filter(r => r.kidem === k).length
  }
  return total
}

// ── Algoritma Konfigürasyonu ─────────────────────────────────

/** Algo config güncelle */
export function updateAlgoConfig(
  state: ScheduleState,
  patch: Partial<AlgoConfig>,
): ScheduleState {
  return {
    ...state,
    algoConfig: { ...state.algoConfig, ...patch },
  }
}

// ── Ay Geçişi ────────────────────────────────────────────────

/**
 * Ay değiştirildiğinde state'i hazırla.
 * Aylık veriler sıfırlanır, global ayarlar korunur.
 */
export function prepareMonthChange(
  state: ScheduleState,
  newYear: number,
  newMonth: number,
): ScheduleState {
  return {
    ...state,
    schedule: {},
    dayOverride: {},
    monthOverride: {},
    kapaliGunler: {},
    prevMonthLastDay: {},
    nextMonthFirstDay: {},
    currentDate: { y: newYear, m: newMonth },
  }
}

// ── Sıfırlama ────────────────────────────────────────────────

/**
 * Schedule + aylık verileri sıfırla, asistan/alan/kota korunur
 */
export function resetScheduleData(state: ScheduleState): ScheduleState {
  return {
    ...state,
    schedule: {},
    dayOverride: {},
    monthOverride: {},
    kapaliGunler: {},
    prevMonthLastDay: {},
    nextMonthFirstDay: {},
    astProfiles: {},
  }
}

// ── Alan Kapalı Gün Yönetimi ─────────────────────────────────

/** Alana kapalı gün ekle/çıkar */
export function toggleClosedDay(
  state: ScheduleState,
  zoneId: string,
  day: number,
): ScheduleState {
  const { y, m } = state.currentDate
  const moKey = monthKey(y, m)
  const kapaliKey = `${moKey}_${zoneId}`
  const kapali = { ...state.kapaliGunler }
  const days = [...(kapali[kapaliKey] ?? [])]

  const idx = days.indexOf(day)
  if (idx >= 0) {
    days.splice(idx, 1)
  } else {
    days.push(day)
  }

  kapali[kapaliKey] = days
  return { ...state, kapaliGunler: kapali }
}

// ── Asistan Profil Güncelleme ────────────────────────────────

/** Asistan profilini güncelle */
export function updateResidentProfile(
  state: ScheduleState,
  astIdx: number,
  patch: Record<string, unknown>,
): ScheduleState {
  const profiles = { ...state.astProfiles }
  profiles[astIdx] = { ...(profiles[astIdx] ?? { durum: 'aktif' }), ...patch }
  return { ...state, astProfiles: profiles }
}

/** Asistanın aylık izin gününü toggle et */
export function toggleLeaveDay(
  state: ScheduleState,
  astIdx: number,
  day: number,
): ScheduleState {
  const { y, m } = state.currentDate
  const moKey = monthKey(y, m)
  const profiles = { ...state.astProfiles }
  const prof = { ...(profiles[astIdx] ?? { durum: 'aktif' }) }
  const izinli = { ...(prof.izinliAylik ?? {}) }
  const days = [...(izinli[moKey] ?? [])]

  const idx = days.indexOf(day)
  if (idx >= 0) {
    days.splice(idx, 1)
  } else {
    days.push(day)
  }

  izinli[moKey] = days
  prof.izinliAylik = izinli
  profiles[astIdx] = prof
  return { ...state, astProfiles: profiles }
}
