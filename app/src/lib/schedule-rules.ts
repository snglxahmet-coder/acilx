// ══════════════════════════════════════════════════════════════
// ACİLX — Nöbet Kural Kontrolleri (nobet-rules.js → TypeScript)
// Saf fonksiyonlar — framework bağımsız
// ══════════════════════════════════════════════════════════════

import type {
  Resident,
  Zone,
  ScheduleState,
  Violation,
  ViolationType,
  Seniority,
  SeniorityRule,
  SeniorityGroupRule,
} from '@/types/schedule'

import {
  gk,
  daysInMonth,
  getDayRule,
  isZoneActive,
  getZoneCount,
} from './schedule-helpers'

// ── Kıdem Kuralı İhlal Kontrolü ─────────────────────────────

interface SeniorityViolation {
  tip: 'yalniz' | 'grup' | 'grupMax'
  kidem?: number
  yanindaKidemler?: number[]
  enAzKac?: number
  kidemler?: number[]
  msg: string
}

/**
 * Belirli gün ve alanda kıdem kuralı ihlallerini tespit et
 * nobet-rules.js → kidemKuralIhlali()
 */
export function checkSeniorityViolations(
  state: ScheduleState,
  residents: Resident[],
  day: number,
  zoneId: string,
): SeniorityViolation[] {
  const rule = state.defaultDayMin[zoneId]
  if (!rule) return []

  const assigned = residents.filter(
    (_, i) => state.schedule[gk(i, day)] === zoneId,
  )
  if (!assigned.length) return []

  const assignedSeniorities = assigned.map(a => a.kidem)
  const violations: SeniorityViolation[] = []

  const countSeniority = (k: number) =>
    assignedSeniorities.filter(ak => ak === k).length

  // Bölüm 1: Yalnız tutamaz kuralı
  checkSoloRules(rule.kidemKurallari, assignedSeniorities, countSeniority, violations)

  // Bölüm 2: Kıdem grupları
  checkGroupRules(rule.kidemGrupKurallari, countSeniority, violations)

  return violations
}

function checkSoloRules(
  rules: Record<number, SeniorityRule> | undefined,
  assignedSeniorities: Seniority[],
  countSeniority: (k: number) => number,
  violations: SeniorityViolation[],
): void {
  if (!rules) return

  for (const kStr of Object.keys(rules)) {
    const k = parseInt(kStr)
    const kural = rules[k]
    if (!kural?.yalnizTutamaz) continue
    if (!assignedSeniorities.includes(k as Seniority)) continue

    const yaninda = kural.yanindaKidemler ?? []
    const enAzKac = kural.enAzKac ?? 1

    if (!yaninda.length) {
      if (countSeniority(k) === 1) {
        violations.push({
          tip: 'yalniz',
          kidem: k,
          msg: `K${k} yalnız — aynı kıdemden en az 2 kişi olmalı`,
        })
      }
      continue
    }

    let found = 0
    for (const yk of yaninda) {
      if (yk === k) {
        if (countSeniority(k) >= 2) found++
      } else {
        if (assignedSeniorities.includes(yk as Seniority)) found++
      }
    }

    if (found < enAzKac) {
      const eksik = enAzKac - found
      violations.push({
        tip: 'yalniz',
        kidem: k,
        yanindaKidemler: yaninda as number[],
        enAzKac,
        msg: `K${k} yalnız — yanında K${yaninda.join('/K')}'ten en az ${enAzKac} kişi olmalı (${eksik} eksik)`,
      })
    }
  }
}

function checkGroupRules(
  groupRules: SeniorityGroupRule[] | undefined,
  countSeniority: (k: number) => number,
  violations: SeniorityViolation[],
): void {
  if (!groupRules?.length) return

  for (const g of groupRules) {
    const kidemler = g.kidemler ?? []
    if (!kidemler.length) continue

    let found = 0
    for (const yk of kidemler) found += countSeniority(yk)

    // Min ihlali
    if (g.enAzKac > 0 && found < g.enAzKac) {
      const eksik = g.enAzKac - found
      violations.push({
        tip: 'grup',
        kidemler: kidemler as number[],
        enAzKac: g.enAzKac,
        msg: `K${kidemler.join('+K')} grubundan en az ${g.enAzKac} kişi olmalı (${eksik} eksik)`,
      })
    }

    // Max ihlali
    if (g.enFazlaKac > 0 && found > g.enFazlaKac) {
      const fazla = found - g.enFazlaKac
      violations.push({
        tip: 'grupMax',
        kidemler: kidemler as number[],
        msg: `K${kidemler.join('+K')} grubundan en fazla ${g.enFazlaKac} kişi olmalı (${fazla} fazla)`,
      })
    }
  }
}

// ── Günlük İhlal Tespiti ─────────────────────────────────────

/**
 * Belirli bir günün tüm ihlallerini tespit et
 * nobet-rules.js → gunIhlalleri()
 */
export function getDayViolations(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  day: number,
): Violation[] {
  const violations: Violation[] = []

  for (const zone of zones) {
    const rule = getDayRule(state, day, zone.id)
    if (!rule.aktif) continue

    const assigned = residents.filter(
      (_, i) => state.schedule[gk(i, day)] === zone.id,
    )
    const cnt = assigned.length

    // Min eksik
    if (cnt < rule.min) {
      violations.push({
        tip: 'min',
        alan: zone,
        msg: `${zone.name}: ${cnt}/${rule.min} — ${rule.min - cnt} kişi eksik`,
      })
    }

    // Max aşım
    if (rule.max > 0 && cnt > rule.max) {
      violations.push({
        tip: 'max',
        alan: zone,
        msg: `${zone.name}: ${cnt}/${rule.max} — ${cnt - rule.max} fazla`,
      })
    }

    // Kıdem kuralı ihlali
    if (cnt > 0) {
      const kIhlaller = checkSeniorityViolations(state, residents, day, zone.id)
      for (const ih of kIhlaller) {
        violations.push({
          tip: 'kidem' as ViolationType,
          alan: zone,
          msg: `${zone.name}: ${ih.msg}`,
          kidem: ih.kidem as Seniority | undefined,
          yanindaKidemler: ih.yanindaKidemler as Seniority[] | undefined,
        })
      }
    }

    // kidemMin ihlali
    checkKidemMinMax(rule.kidemMin, assigned, zone, 'kidemMin', true, violations)

    // kidemMax ihlali
    checkKidemMinMax(rule.kidemMax, assigned, zone, 'kidemMax', false, violations)
  }

  return violations
}

function checkKidemMinMax(
  limits: Record<number, number> | undefined,
  assigned: Resident[],
  zone: Zone,
  tip: ViolationType,
  isMin: boolean,
  violations: Violation[],
): void {
  if (!limits) return
  for (const kk of Object.keys(limits)) {
    const limit = limits[Number(kk)] ?? 0
    if (limit <= 0) continue
    const kCnt = assigned.filter(x => x.kidem === Number(kk)).length

    if (isMin && kCnt < limit) {
      violations.push({
        tip,
        alan: zone,
        msg: `${zone.name}: K${kk} min ${limit} gerekli, mevcut ${kCnt} — ${limit - kCnt} eksik`,
      })
    }
    if (!isMin && kCnt > limit) {
      violations.push({
        tip,
        alan: zone,
        msg: `${zone.name}: K${kk} max ${limit} olmalı, mevcut ${kCnt} — ${kCnt - limit} fazla`,
      })
    }
  }
}

// ── Uyarı Hesaplama ──────────────────────────────────────────

export interface WarningStats {
  sorunluGun: number
  toplamIhlal: number
}

/**
 * Tüm ayın uyarı istatistiklerini hesapla
 * nobet-rules.js → hesaplaUyarilar()
 */
export function calculateWarnings(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): WarningStats {
  const { y, m } = state.currentDate
  const days = daysInMonth(y, m)
  let toplamIhlal = 0
  let sorunluGun = 0

  for (let d = 1; d <= days; d++) {
    const hasAssignment = residents.some(
      (_, i) => state.schedule[gk(i, d)],
    )
    if (!hasAssignment) continue

    const ih = getDayViolations(state, residents, zones, d)
    toplamIhlal += ih.length
    if (ih.length > 0) sorunluGun++
  }

  return { sorunluGun, toplamIhlal }
}

// ── Kıdem Grup Kontrolü ──────────────────────────────────────

/**
 * Gün bazında kıdem grubu ihlali kontrolü
 * nobet-rules.js → checkKidemGrup()
 */
export function checkSeniorityGroupForDay(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  day: number,
): string[] {
  const viols: string[] = []
  for (const zone of zones) {
    if (!isZoneActive(state, day, zone.id)) continue
    const cnt = getZoneCount(state.schedule, residents, day, zone.id)
    if (cnt === 0) continue
    const ih = checkSeniorityViolations(state, residents, day, zone.id)
    for (const i of ih) viols.push(`${zone.name}: ${i.msg}`)
  }
  return viols
}

// ── Toplam İhlal Sayacı (Algoritma için) ─────────────────────

/**
 * Tüm hard constraint ihlallerini say
 * Algoritma repair döngüsünde kullanılır
 */
export function countAllViolations(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  targets: number[],
  loads: { total: number; byArea: Record<string, number> }[],
): number {
  const { y, m } = state.currentDate
  const days = daysInMonth(y, m)

  let v = countZoneViolations(state, residents, zones, days)
  v += countTargetViolations(loads, targets)
  v += countQuotaViolations(state, residents, zones, targets, loads)

  return v
}

function countZoneViolations(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  days: number,
): number {
  let v = 0
  for (let d = 1; d <= days; d++) {
    for (const zone of zones) {
      v += countZoneDayViolations(state, residents, d, zone.id)
    }
  }
  return v
}

function countZoneDayViolations(
  state: ScheduleState,
  residents: Resident[],
  d: number,
  zoneId: string,
): number {
  if (!isZoneActive(state, d, zoneId)) return 0
  const rule = getDayRule(state, d, zoneId)
  if (!rule.aktif) return 0

  const cnt = getZoneCount(state.schedule, residents, d, zoneId)
  let v = 0

  if (cnt < (rule.min ?? 0)) v += (rule.min ?? 0) - cnt
  if ((rule.max ?? 99) < 99 && cnt > rule.max) v += cnt - rule.max
  if (cnt > 0) v += checkSeniorityViolations(state, residents, d, zoneId).length
  v += countKidemLimitViolations(state, residents, d, zoneId, rule.kidemMin, true)
  v += countKidemLimitViolations(state, residents, d, zoneId, rule.kidemMax, false)

  return v
}

function countKidemLimitViolations(
  state: ScheduleState,
  residents: Resident[],
  d: number,
  zoneId: string,
  limits: Record<number, number> | undefined,
  isMin: boolean,
): number {
  if (!limits) return 0
  let v = 0
  for (const kk of Object.keys(limits)) {
    const req = limits[Number(kk)] ?? 0
    if (req <= 0) continue
    const kCnt = residents.filter(
      (_, j) => state.schedule[gk(j, d)] === zoneId && residents[j].kidem === Number(kk),
    ).length
    if (isMin && kCnt < req) v += req - kCnt
    if (!isMin && kCnt > req) v += kCnt - req
  }
  return v
}

function countTargetViolations(
  loads: { total: number; byArea: Record<string, number> }[],
  targets: number[],
): number {
  let v = 0
  for (let i = 0; i < loads.length; i++) {
    const diff = Math.abs(loads[i].total - targets[i])
    if (diff > 0) v += diff
  }
  return v
}

function countQuotaViolations(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  targets: number[],
  loads: { total: number; byArea: Record<string, number> }[],
): number {
  let v = 0
  for (let i = 0; i < residents.length; i++) {
    if (targets[i] <= 0) continue
    for (const zone of zones) {
      const limit = state.quota[zone.id]?.[residents[i].kidem] ?? 0
      const mevcut = loads[i].byArea[zone.id] ?? 0
      if (limit > 0 && mevcut > limit) v += (mevcut - limit) * 2
      if (limit > 0 && mevcut < limit) v += limit - mevcut
    }
  }
  return v
}
