// ══════════════════════════════════════════════════════════════
// ACİLX — Nöbet Yardımcı Fonksiyonlar (nobet-core.js → TypeScript)
// Saf fonksiyonlar — framework bağımsız
// ══════════════════════════════════════════════════════════════

import type {
  Resident,
  ResidentStatus,
  Zone,
  DayRule,
  ResidentProfile,
  ScheduleState,
  Seniority,
  AlgoConfig,
} from '@/types/schedule'

// ── Sabitler ─────────────────────────────────────────────────

export const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const

export const MONTHS_SHORT = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
] as const

export const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const

export const DAY_NAMES_FULL: Record<number, string> = {
  0: 'Pazar', 1: 'Pazartesi', 2: 'Salı', 3: 'Çarşamba',
  4: 'Perşembe', 5: 'Cuma', 6: 'Cumartesi',
}

export const KIDEM_CLS: Record<number, string> = {
  1: 'k1', 2: 'k2', 3: 'k3', 4: 'k4', 5: 'k5', 6: 'k5',
}

/** Ay-bazlı anahtarlar (her ay farklı) */
export const MONTHLY_KEYS = [
  'schedule', 'dayOverride', 'monthOverride',
  'kapaliGunler', 'prevMonthLastDay', 'nextMonthFirstDay',
] as const

/** Global anahtarlar (tüm aylarda aynı) */
export const GLOBAL_KEYS = [
  'defaultDayMin', 'minNobet', 'quota',
  'maxHours', 'listName', 'algoConfig', 'astProfiles',
] as const

// ── Temel Yardımcılar ────────────────────────────────────────

/** Schedule anahtarı: "astIdx_day" */
export function gk(astIdx: number, day: number): string {
  return `${astIdx}_${day}`
}

/** Aydaki gün sayısı */
export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate()
}

/** Hafta sonu mu? (Cmt=6, Paz=0) */
export function isWeekend(y: number, m: number, d: number): boolean {
  const dw = new Date(y, m, d).getDay()
  return dw === 0 || dw === 6
}

/** Haftanın günü (0=Pzt..6=Paz) */
export function getDOW(y: number, m: number, d: number): number {
  const dw = new Date(y, m, d).getDay()
  return dw === 0 ? 6 : dw - 1
}

/** Ay anahtarı */
export function monthKey(y: number, m: number): string {
  return `${y}_${m}`
}

// ── XSS Koruması ─────────────────────────────────────────────

export function escapeHtml(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Alan Yardımcıları ────────────────────────────────────────

/** Alan kısaltması üret: "Kırmızı 2" → "K2", "Min. Travma" → "MT" */
export function shortenZoneName(name: string): string {
  if (!name) return '??'
  const words = name.trim().split(/\s+/)
  const lastWord = words[words.length - 1]
  const isNum = /^\d+$/.test(lastWord)
  if (isNum && words.length >= 2) {
    return words.slice(0, -1).map(w => w[0].toUpperCase()).join('') + lastWord
  }
  return words.map(w => w[0].toUpperCase()).join('').slice(0, 3)
}

/** Alan etiketi al (cache varsa kullan, yoksa üret) */
export function getZoneLabel(
  zoneId: string,
  zones: Zone[],
  labelCache?: Record<string, string>,
): string {
  if (labelCache?.[zoneId]) return labelCache[zoneId]
  const zone = zones.find(z => z.id === zoneId)
  if (!zone) return zoneId.toUpperCase().slice(0, 2)
  return shortenZoneName(zone.name)
}

/** Kıdem etiketi */
export function getSeniorityLabel(
  k: Seniority,
  customNames?: string[],
): string {
  if (customNames?.[k - 1]) return customNames[k - 1]
  return `K${k}`
}

// ── Gün Kuralı ───────────────────────────────────────────────

/** Belirli gün+alan için geçerli kuralı getir */
export function getDayRule(
  state: ScheduleState,
  day: number,
  zoneId: string,
  y?: number,
  m?: number,
): DayRule & { aktif: boolean } {
  const yr = y ?? state.currentDate.y
  const mo = m ?? state.currentDate.m
  const base = state.dayOverride[day]?.[zoneId]
    ?? state.defaultDayMin[zoneId]
    ?? { min: 1, max: 3 }

  const moKey = `${yr}_${mo}`
  const kapaliKey = `${moKey}_${zoneId}`
  const kapali = state.kapaliGunler?.[kapaliKey]

  if (kapali?.includes(day)) {
    return { ...base, min: 0, max: 0, aktif: false }
  }
  return { ...base, aktif: true }
}

/** Alan o gün aktif mi? */
export function isZoneActive(
  state: ScheduleState,
  day: number,
  zoneId: string,
  y?: number,
  m?: number,
): boolean {
  return getDayRule(state, day, zoneId, y, m).aktif !== false
}

// ── Sayım Fonksiyonları ──────────────────────────────────────

/** Asistanın belirli alandaki nöbet sayısı */
export function countByZone(
  schedule: Record<string, string>,
  astIdx: number,
  zoneId: string,
  totalDays: number,
): number {
  let c = 0
  for (let d = 1; d <= totalDays; d++) {
    if (schedule[gk(astIdx, d)] === zoneId) c++
  }
  return c
}

/** Asistanın toplam nöbet sayısı */
export function countTotal(
  schedule: Record<string, string>,
  astIdx: number,
  totalDays: number,
): number {
  let c = 0
  for (let d = 1; d <= totalDays; d++) {
    if (schedule[gk(astIdx, d)]) c++
  }
  return c
}

/** Belirli günde belirli alandaki kişi sayısı */
export function getZoneCount(
  schedule: Record<string, string>,
  residents: Resident[],
  day: number,
  zoneId: string,
): number {
  return residents.filter((_, i) => schedule[gk(i, day)] === zoneId).length
}

/** Günlük min doluluk kontrolü */
export function checkDayMinimums(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  day: number,
): string[] {
  const viols: string[] = []
  for (const zone of zones) {
    const rule = getDayRule(state, day, zone.id)
    if (rule.min === 0) continue
    const cnt = getZoneCount(state.schedule, residents, day, zone.id)
    if (cnt < rule.min) {
      viols.push(`${zone.name}: ${cnt}/${rule.min}`)
    }
  }
  return viols
}

// ── Profil Yardımcıları ──────────────────────────────────────

/** Asistan durumunu al */
export function getResidentStatus(
  profiles: Record<number, ResidentProfile>,
  astIdx: number,
): ResidentStatus {
  return profiles[astIdx]?.durum ?? 'aktif'
}

/** Asistanın şiftlerini al */
export function getResidentShifts(
  profiles: Record<number, ResidentProfile>,
  astIdx: number,
): string[] {
  const p = profiles[astIdx]
  if (p?.siftler?.length) return p.siftler
  return [p?.sift ?? '24h']
}

/** Asistanın aylık izin günlerini al */
export function getMonthlyLeaves(
  profiles: Record<number, ResidentProfile>,
  astIdx: number,
  moKey: string,
): number[] {
  return profiles[astIdx]?.izinliAylik?.[moKey] ?? []
}

/** Asistanın aylık tercih günlerini al */
export function getMonthlyPreferences(
  profiles: Record<number, ResidentProfile>,
  astIdx: number,
  moKey: string,
): number[] {
  return profiles[astIdx]?.tercihAylik?.[moKey] ?? []
}

/** Asistanın aylık kaçınma günlerini al */
export function getMonthlyAvoidances(
  profiles: Record<number, ResidentProfile>,
  astIdx: number,
  moKey: string,
): number[] {
  return profiles[astIdx]?.kacAylik?.[moKey] ?? []
}

/** Asistanın haftalık tercih günlerini al */
export function getWeeklyPreferences(
  profiles: Record<number, ResidentProfile>,
  astIdx: number,
): number[] {
  return profiles[astIdx]?.tercihGunler ?? []
}

/** Asistanın haftalık kaçınma günlerini al */
export function getWeeklyAvoidances(
  profiles: Record<number, ResidentProfile>,
  astIdx: number,
): number[] {
  return profiles[astIdx]?.kacGunler ?? []
}

// ── Hedef Hesaplama ──────────────────────────────────────────

/** Asistanın aylık nöbet hedefini hesapla */
export function calculateTarget(
  state: ScheduleState,
  residents: Resident[],
  astIdx: number,
): number {
  const { y, m } = state.currentDate
  const days = daysInMonth(y, m)
  const moKey = monthKey(y, m)

  // Manuel override
  const ov = state.monthOverride?.[moKey]?.[astIdx]
  if (ov !== undefined && ov !== null) return ov

  const resident = residents[astIdx]
  if (!resident) return 0

  const baseH = Math.round(state.maxHours[resident.kidem] / 24)
  const izinHedef = state.algoConfig?.izinHedef ?? 'otoDusManuel'

  if (izinHedef === 'sabit') return baseH

  const prof = state.astProfiles[astIdx]
  const dur = prof?.durum ?? 'aktif'
  if (dur === 'izinli' || dur === 'rot_hayir') return 0

  const izinG = getMonthlyLeaves(state.astProfiles, astIdx, moKey).length
  if (izinG > 0) {
    return Math.max(0, Math.round(baseH * ((days - izinG) / days)))
  }
  return baseH
}

/** Max nöbet aşıldı mı? */
export function isTargetReached(
  state: ScheduleState,
  residents: Resident[],
  astIdx: number,
): boolean {
  const hedef = calculateTarget(state, residents, astIdx)
  if (hedef <= 0) {
    const dur = getResidentStatus(state.astProfiles, astIdx)
    if (dur === 'izinli' || dur === 'rot_hayir') return true
  }
  const days = daysInMonth(state.currentDate.y, state.currentDate.m)
  const mevcut = countTotal(state.schedule, astIdx, days)
  return mevcut >= hedef
}

// ── Nöbet Yazılabilirlik Kontrolü ────────────────────────────

/**
 * Nöbet yazma engeli kontrolü.
 * null dönerse yazılabilir, string dönerse engel mesajı.
 */
export function checkWriteBlock(
  state: ScheduleState,
  astIdx: number,
  day: number,
): string | null {
  const { y, m } = state.currentDate
  const days = daysInMonth(y, m)
  const moKey = monthKey(y, m)
  const prof = state.astProfiles[astIdx]
  const dur = prof?.durum ?? 'aktif'

  if (dur === 'izinli' || dur === 'rot_hayir') {
    return 'Bu asistan izinli — nöbet yazılamaz'
  }
  const izinArr = getMonthlyLeaves(state.astProfiles, astIdx, moKey)
  if (izinArr.includes(day)) {
    return `${day}. gün izinli — nöbet yazılamaz`
  }
  if (day > 1 && state.schedule[gk(astIdx, day - 1)]) {
    return 'Art arda 24s nöbet yazılamaz (önceki gün nöbetli)'
  }
  if (day < days && state.schedule[gk(astIdx, day + 1)]) {
    return 'Art arda 24s nöbet yazılamaz (sonraki gün nöbetli)'
  }
  if (day === 1 && state.prevMonthLastDay?.[astIdx]) {
    return 'Art arda 24s nöbet yazılamaz (önceki ayın son günü nöbetli)'
  }
  if (day === days && state.nextMonthFirstDay?.[astIdx]) {
    return 'Art arda 24s nöbet yazılamaz (sonraki ayın ilk günü nöbetli)'
  }
  return null
}

// ── Genel canAssign — Manuel atama için ──────────────────────

/** Asistan belirli güne belirli alana atanabilir mi? */
export function canAssign(
  state: ScheduleState,
  residents: Resident[],
  astIdx: number,
  day: number,
  zoneId: string,
  ignoreTarget = false,
): boolean {
  const { y, m } = state.currentDate
  const days = daysInMonth(y, m)
  const moKey = monthKey(y, m)
  const resident = residents[astIdx]
  if (!resident) return false

  // Hedef kontrolü
  if (!ignoreTarget) {
    const hedef = calculateTarget(state, residents, astIdx)
    const mevcut = countTotal(state.schedule, astIdx, days)
    if (mevcut >= hedef) return false
  }

  // Durum kontrolü
  const dur = getResidentStatus(state.astProfiles, astIdx)
  if (dur === 'izinli' || dur === 'rot_hayir') return false

  // İzin günü
  if (getMonthlyLeaves(state.astProfiles, astIdx, moKey).includes(day)) {
    return false
  }

  // Alan aktif mi?
  if (!isZoneActive(state, day, zoneId)) return false

  // Zaten atanmış?
  if (state.schedule[gk(astIdx, day)]) return false

  // Art arda kontrolü
  if (day > 1 && state.schedule[gk(astIdx, day - 1)]) return false
  if (day < days && state.schedule[gk(astIdx, day + 1)]) return false
  if (day === 1 && state.prevMonthLastDay?.[astIdx]) return false
  if (day === days && state.nextMonthFirstDay?.[astIdx]) return false

  // Alan kota kontrolü
  const kotaMax = state.quota[zoneId]?.[resident.kidem] ?? 0
  const used = countByZone(state.schedule, astIdx, zoneId, days)
  if (used >= kotaMax) return false

  // Kaçınma kontrolü
  const kacAylik = getMonthlyAvoidances(state.astProfiles, astIdx, moKey)
  if (kacAylik.includes(day)) return false

  // Şift uyumluluk
  const siftler = getResidentShifts(state.astProfiles, astIdx)
  const alanSiftler = state.defaultDayMin[zoneId]?.siftler ?? ['24h']
  if (!siftler.some(s => alanSiftler.includes(s as typeof alanSiftler[number]))) return false

  return true
}

// ── Mesafe Kontrolü (Yapılandırılabilir) ─────────────────────

/** Mesafe uygun mu? (art arda engeli) */
export function isDistanceOk(
  schedule: Record<string, string>,
  astIdx: number,
  day: number,
  totalDays: number,
  distance: number,
  prevMonthLastDay?: Record<number, string>,
  nextMonthFirstDay?: Record<number, string>,
): boolean {
  for (let delta = 1; delta <= distance; delta++) {
    if (day - delta >= 1 && schedule[gk(astIdx, day - delta)]) return false
    if (day + delta <= totalDays && schedule[gk(astIdx, day + delta)]) return false
  }
  if (day === 1 && prevMonthLastDay?.[astIdx]) return false
  if (day === totalDays && nextMonthFirstDay?.[astIdx]) return false
  return true
}

// ── Default State ────────────────────────────────────────────

export function createDefaultAlgoConfig(): AlgoConfig {
  return {
    artArdaMesafe: 1,
    kacinmaGucu: 'guclu',
    tercihCakisma: 'azTercih',
    weDengesi: 'toplamEsit',
    izinHedef: 'otoDusManuel',
    alanOncelikleri: null,
  }
}

export function createDefaultDayRule(): DayRule {
  return {
    min: 1,
    max: 3,
    kidemMin: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    kidemMax: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    kidemKurallari: {},
    siftler: ['24h'],
  }
}
