// ══════════════════════════════════════════════════════════════
// ACİLX — Nöbet Analiz / İstatistik Motoru (nobet-analiz.js → TypeScript)
// Saf fonksiyonlar — DOM yok, framework bağımsız
// ══════════════════════════════════════════════════════════════

import type {
  Resident,
  Zone,
  ScheduleState,
  Suggestion,
  SwapEligibility,
} from '@/types/schedule'

import {
  gk,
  daysInMonth,
  monthKey,
  getDayRule,
  isZoneActive,
  getZoneCount,
  countByZone,
  countTotal,
  getResidentStatus,
  getMonthlyLeaves,
  calculateTarget,
  canAssign,
  checkWriteBlock,
} from '@/lib/schedule-helpers'

import {
  checkSeniorityViolations,
  getDayViolations,
} from '@/lib/schedule-rules'

// ── Tip Tanımları ─────────────────────────────────────────────

interface ScheduleProblem {
  tip: 'min' | 'max' | 'kidem'
  day: number
  zone: Zone
  count: number
  candidates: number[]
  seniorityFilter?: number[]
}

interface SmartSolveResult {
  schedule: Record<string, string>
  solved: number
  unsolved: ScheduleProblem[]
}

interface SwapCandidate {
  tip: 'transfer' | 'takas'
  iA?: number
  iB: number
  dB: number
  alanB: string
  label: string
}

interface DeviationResult {
  total: number
  target: number
  zones: Record<string, { count: number; quota: number }>
}

// ── Yardımcılar ──────────────────────────────────────────────

function cloneSchedule(schedule: Record<string, string>): Record<string, string> {
  return { ...schedule }
}

function totalDaysFor(state: ScheduleState): number {
  return daysInMonth(state.currentDate.y, state.currentDate.m)
}

function moKeyFor(state: ScheduleState): string {
  return monthKey(state.currentDate.y, state.currentDate.m)
}

/** Belirli gün ve alandaki kişi sayısını schedule objesi üzerinden say */
function zoneCountFromSchedule(
  schedule: Record<string, string>,
  residents: Resident[],
  day: number,
  zoneId: string,
): number {
  return residents.filter((_, i) => schedule[gk(i, day)] === zoneId).length
}

/** Tüm ay boyunca toplam ihlal sayısını hesapla */
function countViolations(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): number {
  const days = totalDaysFor(state)
  let total = 0
  for (let d = 1; d <= days; d++) {
    total += getDayViolations(state, residents, zones, d).length
  }
  return total
}

/** Asistanın o gün temel uygunluk kontrolü (izin, artarda, durum) */
function isBasicEligible(
  state: ScheduleState,
  astIdx: number,
  day: number,
): boolean {
  return checkWriteBlock(state, astIdx, day) === null
}

// ── 1. collectProblems ───────────────────────────────────────

/** Tüm çizelge problemlerini topla (min/max/kidem ihlalleri) */
export function collectProblems(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): ScheduleProblem[] {
  const days = totalDaysFor(state)
  const problems: ScheduleProblem[] = []

  for (let d = 1; d <= days; d++) {
    for (const zone of zones) {
      collectDayZoneProblems(state, residents, d, zone, problems)
    }
  }

  return sortProblems(problems)
}

function collectDayZoneProblems(
  state: ScheduleState,
  residents: Resident[],
  day: number,
  zone: Zone,
  problems: ScheduleProblem[],
): void {
  const rule = getDayRule(state, day, zone.id)
  if (!rule.aktif) return

  const cnt = getZoneCount(state.schedule, residents, day, zone.id)

  if (cnt < rule.min) {
    const candidates = findDirectAddCandidates(state, residents, day, zone.id)
    problems.push({ tip: 'min', day, zone, count: rule.min - cnt, candidates })
  }

  if (rule.max > 0 && cnt > rule.max) {
    const candidates = findRemoveCandidates(state, residents, day, zone.id)
    problems.push({ tip: 'max', day, zone, count: cnt - rule.max, candidates })
  }

  if (cnt > 0) {
    collectSeniorityProblems(state, residents, day, zone, problems)
  }
}

function collectSeniorityProblems(
  state: ScheduleState,
  residents: Resident[],
  day: number,
  zone: Zone,
  problems: ScheduleProblem[],
): void {
  const viols = checkSeniorityViolations(state, residents, day, zone.id)
  for (const v of viols) {
    const filter = v.yanindaKidemler?.length
      ? (v.yanindaKidemler as number[])
      : [v.kidem ?? 1]
    const candidates = findDirectAddCandidates(
      state, residents, day, zone.id, filter,
    )
    problems.push({
      tip: 'kidem', day, zone, count: 1,
      candidates, seniorityFilter: filter,
    })
  }
}

function sortProblems(problems: ScheduleProblem[]): ScheduleProblem[] {
  return problems.sort((a, b) => {
    if (a.tip === 'max' && b.tip !== 'max') return 1
    if (b.tip === 'max' && a.tip !== 'max') return -1
    return a.candidates.length - b.candidates.length
  })
}

// ── 2. smartSolve ────────────────────────────────────────────

/** 3-geçişli akıllı çözücü */
export function smartSolve(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): SmartSolveResult {
  const workState = { ...state, schedule: cloneSchedule(state.schedule) }
  let solved = 0

  for (let pass = 1; pass <= 3; pass++) {
    const before = countViolations(workState, residents, zones)
    if (before === 0) break

    solved += passFixOverflows(workState, residents, zones)
    solved += passFixDeficits(workState, residents, zones)
    solved += passFixSeniority(workState, residents, zones)

    const after = countViolations(workState, residents, zones)
    if (after === 0 || after >= before) break
  }

  const unsolved = collectProblems(workState, residents, zones)
  return { schedule: workState.schedule, solved, unsolved }
}

/** Geçiş 1: Max aşımlarını çöz */
function passFixOverflows(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): number {
  const days = totalDaysFor(state)
  let fixed = 0

  for (let d = 1; d <= days; d++) {
    for (const zone of zones) {
      fixed += fixOverflowForDayZone(state, residents, zones, d, zone)
    }
  }
  return fixed
}

function fixOverflowForDayZone(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  day: number,
  zone: Zone,
): number {
  const rule = getDayRule(state, day, zone.id)
  if (!rule.aktif || rule.max <= 0) return 0

  const cnt = getZoneCount(state.schedule, residents, day, zone.id)
  if (cnt <= rule.max) return 0

  const removable = findRemoveCandidates(state, residents, day, zone.id)
  let removed = 0
  const excess = cnt - rule.max

  for (const idx of removable) {
    if (removed >= excess) break
    if (safeRemove(state, residents, zones, idx, day)) removed++
  }
  return removed
}

/** Geçiş 2: Min eksikleri çöz */
function passFixDeficits(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): number {
  const days = totalDaysFor(state)
  let fixed = 0

  for (let d = 1; d <= days; d++) {
    for (const zone of zones) {
      fixed += fixDeficitForDayZone(state, residents, zones, d, zone)
    }
  }
  return fixed
}

function fixDeficitForDayZone(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  day: number,
  zone: Zone,
): number {
  const rule = getDayRule(state, day, zone.id)
  if (!rule.aktif) return 0

  const cnt = getZoneCount(state.schedule, residents, day, zone.id)
  if (cnt >= rule.min) return 0

  const deficit = rule.min - cnt
  const candidates = findDeficitCandidatesSorted(state, residents, day, zone.id)
  let added = 0

  for (const idx of candidates) {
    if (added >= deficit) break
    if (safeAdd(state, residents, zones, idx, day, zone.id)) added++
  }
  return added
}

function findDeficitCandidatesSorted(
  state: ScheduleState,
  residents: Resident[],
  day: number,
  zoneId: string,
): number[] {
  const days = totalDaysFor(state)
  return residents
    .map((_, i) => i)
    .filter(i => {
      if (!residents[i]) return false
      if (!isBasicEligible(state, i, day)) return false
      if (state.schedule[gk(i, day)]) return false
      if (!isZoneActive(state, day, zoneId)) return false
      const quota = state.quota[zoneId]?.[residents[i].kidem] ?? 0
      return quota > 0
    })
    .sort((a, b) => {
      const remainA = calculateTarget(state, residents, a) - countTotal(state.schedule, a, days)
      const remainB = calculateTarget(state, residents, b) - countTotal(state.schedule, b, days)
      return remainB - remainA
    })
}

/** Geçiş 3: Kıdem ihlallerini çöz */
function passFixSeniority(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): number {
  const days = totalDaysFor(state)
  let fixed = 0

  for (let d = 1; d <= days; d++) {
    for (const zone of zones) {
      fixed += fixSeniorityForDayZone(state, residents, zones, d, zone)
    }
  }
  return fixed
}

function fixSeniorityForDayZone(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  day: number,
  zone: Zone,
): number {
  const cnt = getZoneCount(state.schedule, residents, day, zone.id)
  if (cnt <= 0) return 0

  const viols = checkSeniorityViolations(state, residents, day, zone.id)
  if (!viols.length) return 0

  const rule = getDayRule(state, day, zone.id)
  if (cnt >= (rule.max ?? 99)) return 0

  let fixed = 0
  for (const v of viols) {
    if (fixSingleSeniorityViol(state, residents, zones, day, zone.id, v)) fixed++
  }
  return fixed
}

function fixSingleSeniorityViol(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  day: number,
  zoneId: string,
  viol: { kidem?: number; yanindaKidemler?: number[] },
): boolean {
  const needed = viol.yanindaKidemler?.length
    ? viol.yanindaKidemler
    : [viol.kidem ?? 1]
  const candidates = findDirectAddCandidates(state, residents, day, zoneId, needed)
  for (const idx of candidates) {
    if (safeAdd(state, residents, zones, idx, day, zoneId)) return true
  }
  return false
}

// ── Güvenli ekleme/çıkarma ───────────────────────────────────

function safeAdd(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  astIdx: number,
  day: number,
  zoneId: string,
): boolean {
  if (state.schedule[gk(astIdx, day)]) return false
  if (!isBasicEligible(state, astIdx, day)) return false

  const days = totalDaysFor(state)
  const target = calculateTarget(state, residents, astIdx)
  if (countTotal(state.schedule, astIdx, days) >= target) return false

  const before = countViolations(state, residents, zones)
  state.schedule[gk(astIdx, day)] = zoneId
  const after = countViolations(state, residents, zones)

  if (after > before) {
    delete state.schedule[gk(astIdx, day)]
    return false
  }
  return true
}

function safeRemove(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  astIdx: number,
  day: number,
): boolean {
  const zoneId = state.schedule[gk(astIdx, day)]
  if (!zoneId) return false

  const before = countViolations(state, residents, zones)
  delete state.schedule[gk(astIdx, day)]
  const after = countViolations(state, residents, zones)

  if (after > before) {
    state.schedule[gk(astIdx, day)] = zoneId
    return false
  }
  return true
}

// ── 3. findDirectAddCandidates ───────────────────────────────

/** Doğrudan eklenebilecek asistanları bul (en az nöbetli önce) */
export function findDirectAddCandidates(
  state: ScheduleState,
  residents: Resident[],
  day: number,
  zoneId: string,
  seniorityFilter?: number[],
): number[] {
  const days = totalDaysFor(state)

  return residents
    .map((_, i) => i)
    .filter(i => isAddCandidate(state, residents, i, day, zoneId, seniorityFilter))
    .sort((a, b) => countTotal(state.schedule, a, days) - countTotal(state.schedule, b, days))
}

function isAddCandidate(
  state: ScheduleState,
  residents: Resident[],
  astIdx: number,
  day: number,
  zoneId: string,
  seniorityFilter?: number[],
): boolean {
  if (!residents[astIdx]) return false
  if (state.schedule[gk(astIdx, day)]) return false
  if (seniorityFilter?.length && !seniorityFilter.includes(residents[astIdx].kidem)) return false
  const quota = state.quota[zoneId]?.[residents[astIdx].kidem] ?? 0
  if (quota === 0) return false
  return canAssign(state, residents, astIdx, day, zoneId, true)
}

// ── 4. findSwapCandidates ────────────────────────────────────

/** Takas / transfer adaylarını bul */
export function findSwapCandidates(
  state: ScheduleState,
  residents: Resident[],
  _zones: Zone[],
  day: number,
  zoneId: string,
  seniorityFilter?: number[],
): SwapCandidate[] {
  const results: SwapCandidate[] = []
  findTransferCandidates(state, residents, day, zoneId, seniorityFilter, results)
  if (results.length < 6) {
    findSwapPairCandidates(state, residents, day, zoneId, seniorityFilter, results)
  }
  return results
}

function findTransferCandidates(
  state: ScheduleState,
  residents: Resident[],
  day: number,
  zoneId: string,
  seniorityFilter: number[] | undefined,
  results: SwapCandidate[],
): void {
  const days = totalDaysFor(state)
  const moKey = moKeyFor(state)

  for (let iB = 0; iB < residents.length; iB++) {
    if (results.length >= 6) return
    if (!isTransferEligible(state, residents, iB, day, seniorityFilter, moKey)) continue

    for (let dB = 1; dB <= days; dB++) {
      if (results.length >= 6) return
      const transfer = tryTransfer(state, residents, iB, day, zoneId, dB)
      if (transfer) results.push(transfer)
    }
  }
}

function isTransferEligible(
  state: ScheduleState,
  residents: Resident[],
  astIdx: number,
  targetDay: number,
  seniorityFilter: number[] | undefined,
  moKey: string,
): boolean {
  if (!residents[astIdx]) return false
  if (seniorityFilter?.length && !seniorityFilter.includes(residents[astIdx].kidem)) return false
  const status = getResidentStatus(state.astProfiles, astIdx)
  if (status === 'izinli' || status === 'rot_hayir') return false
  const leaves = getMonthlyLeaves(state.astProfiles, astIdx, moKey)
  return !leaves.includes(targetDay)
}

function tryTransfer(
  state: ScheduleState,
  residents: Resident[],
  iB: number,
  targetDay: number,
  targetZone: string,
  sourceDay: number,
): SwapCandidate | null {
  if (sourceDay === targetDay) return null
  const sourceZone = state.schedule[gk(iB, sourceDay)]
  if (!sourceZone) return null
  if (state.schedule[gk(iB, targetDay)]) return null

  // Simüle: kaynaktan çıkar, hedefe ata
  delete state.schedule[gk(iB, sourceDay)]
  const canMove = canAssign(state, residents, iB, targetDay, targetZone, true)
  state.schedule[gk(iB, sourceDay)] = sourceZone

  if (!canMove) return null

  // Kaynak gündeki min kontrolü
  const cnt = getZoneCount(state.schedule, residents, sourceDay, sourceZone)
  const rule = getDayRule(state, sourceDay, sourceZone)
  if (cnt - 1 < (rule.min ?? 0)) return null

  return {
    tip: 'transfer', iB, dB: sourceDay, alanB: sourceZone,
    label: `${residents[iB].name} — ${sourceDay}. gün → ${targetDay}. güne taşı`,
  }
}

function findSwapPairCandidates(
  state: ScheduleState,
  residents: Resident[],
  day: number,
  zoneId: string,
  seniorityFilter: number[] | undefined,
  results: SwapCandidate[],
): void {
  const days = totalDaysFor(state)
  const moKey = moKeyFor(state)
  const assigned = residents
    .map((_, i) => i)
    .filter(i => state.schedule[gk(i, day)] === zoneId)

  for (const iA of assigned) {
    for (let iB = 0; iB < residents.length; iB++) {
      if (results.length >= 6) return
      if (iB === iA) return
      if (!isTransferEligible(state, residents, iB, day, seniorityFilter, moKey)) continue

      for (let dB = 1; dB <= days; dB++) {
        if (results.length >= 6) return
        const swap = trySwapPair(state, residents, iA, day, zoneId, iB, dB)
        if (swap) results.push(swap)
      }
    }
  }
}

function trySwapPair(
  state: ScheduleState,
  residents: Resident[],
  iA: number,
  dA: number,
  zoneA: string,
  iB: number,
  dB: number,
): SwapCandidate | null {
  if (dB === dA) return null
  const zoneB = state.schedule[gk(iB, dB)]
  if (!zoneB) return null
  if (state.schedule[gk(iA, dB)] || state.schedule[gk(iB, dA)]) return null

  if (!simulateSwapAssign(state, residents, iA, dA, iB, dB, zoneA, zoneB)) return null

  return {
    tip: 'takas', iA, iB, dB, alanB: zoneB,
    label: `${residents[iA].name} (${dA}.gün) ↔ ${residents[iB].name} (${dB}.gün)`,
  }
}

function simulateSwapAssign(
  state: ScheduleState,
  residents: Resident[],
  iA: number, dA: number,
  iB: number, dB: number,
  zoneA: string, zoneB: string,
): boolean {
  const savedA = state.schedule[gk(iA, dA)]
  const savedB = state.schedule[gk(iB, dB)]
  delete state.schedule[gk(iA, dA)]
  delete state.schedule[gk(iB, dB)]

  const okA = canAssign(state, residents, iA, dB, zoneB, true)
  const okB = canAssign(state, residents, iB, dA, zoneA, true)

  state.schedule[gk(iA, dA)] = savedA
  state.schedule[gk(iB, dB)] = savedB
  return okA && okB
}

// ── 5. findRemoveCandidates ──────────────────────────────────

/** Çıkarılabilecek asistanları bul (en çok nöbetli önce) */
export function findRemoveCandidates(
  state: ScheduleState,
  residents: Resident[],
  day: number,
  zoneId: string,
  seniorityFilter?: number[],
): number[] {
  const days = totalDaysFor(state)

  return residents
    .map((_, i) => i)
    .filter(i => {
      if (!residents[i]) return false
      if (state.schedule[gk(i, day)] !== zoneId) return false
      if (seniorityFilter?.length && !seniorityFilter.includes(residents[i].kidem)) return false
      return true
    })
    .sort((a, b) => countTotal(state.schedule, b, days) - countTotal(state.schedule, a, days))
}

// ── 6. simulateSuggestion ────────────────────────────────────

/** Öneriyi uyguladığımızda sorun çözülür mü? */
export function simulateSuggestion(
  state: ScheduleState,
  residents: Resident[],
  problem: ScheduleProblem,
  suggestion: Suggestion,
): boolean {
  const tmp = cloneSchedule(state.schedule)
  applySuggestionToSchedule(tmp, suggestion)

  const cnt = zoneCountFromSchedule(tmp, residents, problem.day, problem.zone.id)
  const rule = getDayRule(state, problem.day, problem.zone.id)

  return evaluateSimulation(problem.tip, cnt, rule.min, rule.max ?? 99)
}

function applySuggestionToSchedule(
  schedule: Record<string, string>,
  suggestion: Suggestion,
): void {
  if (suggestion.tip === 'ekle') {
    schedule[gk(suggestion.iA, suggestion.d)] = suggestion.aId
  } else if (suggestion.tip === 'cikar') {
    delete schedule[gk(suggestion.iA, suggestion.d)]
  } else if (suggestion.tip === 'transfer') {
    delete schedule[gk(suggestion.iA, suggestion.dB!)]
    schedule[gk(suggestion.iA, suggestion.d)] = suggestion.aId
  } else if (suggestion.tip === 'takas') {
    delete schedule[gk(suggestion.iA, suggestion.d)]
    delete schedule[gk(suggestion.iB!, suggestion.dB!)]
    schedule[gk(suggestion.iA, suggestion.dB!)] = suggestion.alanB!
    schedule[gk(suggestion.iB!, suggestion.d)] = suggestion.aId
  }
}

function evaluateSimulation(
  problemType: string,
  count: number,
  min: number,
  max: number,
): boolean {
  if (problemType === 'min') return count >= min
  if (problemType === 'max') return count <= max
  return true
}

// ── 7. applySuggestion ──────────────────────────────────────

/** Öneriyi uygula, yeni schedule döndür */
export function applySuggestion(
  state: ScheduleState,
  suggestion: Suggestion,
): Record<string, string> {
  const newSchedule = cloneSchedule(state.schedule)
  applySuggestionToSchedule(newSchedule, suggestion)
  return newSchedule
}

// ── 8. checkSwapEligibility ──────────────────────────────────

/** İki asistan takas yapabilir mi? */
export function checkSwapEligibility(
  state: ScheduleState,
  residents: Resident[],
  iA: number,
  dA: number,
  zoneA: string,
  iB: number,
  dB: number,
  zoneB: string,
): SwapEligibility {
  const statusCheck = checkSwapStatuses(state, residents, iA, dA, iB, dB)
  if (!statusCheck.ok) return statusCheck

  const seniorityCheck = checkSwapSeniority(state, residents, iA, zoneB, iB, zoneA)
  if (!seniorityCheck.ok) return seniorityCheck

  return checkSwapScheduleConstraints(state, residents, iA, dA, zoneA, iB, dB, zoneB)
}

function checkSwapStatuses(
  state: ScheduleState,
  residents: Resident[],
  iA: number,
  dA: number,
  iB: number,
  dB: number,
): SwapEligibility {
  const checkA = checkResidentSwapStatus(state, residents, iA, dB)
  if (!checkA.ok) return checkA

  return checkResidentSwapStatus(state, residents, iB, dA)
}

function checkResidentSwapStatus(
  state: ScheduleState,
  residents: Resident[],
  astIdx: number,
  targetDay: number,
): SwapEligibility {
  const moKey = moKeyFor(state)
  const dur = getResidentStatus(state.astProfiles, astIdx)
  if (dur === 'izinli' || dur === 'rot_hayir') {
    return { ok: false, reason: `${residents[astIdx].name} izinli/rotasyon dışı` }
  }
  const leaves = getMonthlyLeaves(state.astProfiles, astIdx, moKey)
  if (leaves.includes(targetDay)) {
    return { ok: false, reason: `${residents[astIdx].name} ${targetDay}. gün izinli` }
  }
  return { ok: true }
}

function checkSwapSeniority(
  state: ScheduleState,
  residents: Resident[],
  iA: number,
  zoneB: string,
  iB: number,
  zoneA: string,
): SwapEligibility {
  const quotaAtoB = state.quota[zoneB]?.[residents[iA].kidem] ?? 0
  if (quotaAtoB === 0) {
    return { ok: false, reason: `Kıdem uyumsuz (${residents[iA].name} → hedef alan)` }
  }

  const quotaBtoA = state.quota[zoneA]?.[residents[iB].kidem] ?? 0
  if (quotaBtoA === 0) {
    return { ok: false, reason: `Kıdem uyumsuz (${residents[iB].name} → hedef alan)` }
  }

  return { ok: true }
}

function checkSwapScheduleConstraints(
  state: ScheduleState,
  residents: Resident[],
  iA: number,
  dA: number,
  zoneA: string,
  iB: number,
  dB: number,
  zoneB: string,
): SwapEligibility {
  const days = totalDaysFor(state)
  const tmp = cloneSchedule(state.schedule)
  delete tmp[gk(iA, dA)]
  delete tmp[gk(iB, dB)]
  tmp[gk(iA, dB)] = zoneB
  tmp[gk(iB, dA)] = zoneA

  // Farklı gün: art arda kontrol
  if (dA !== dB) {
    const artArdaResult = checkSwapConsecutive(state, tmp, residents, iA, dB, iB, dA, days)
    if (!artArdaResult.ok) return artArdaResult
  }

  // Min doluluk kontrolü
  const minResult = checkSwapMinOccupancy(state, tmp, residents, dA, dB, zoneA, zoneB)
  if (!minResult.ok) return minResult

  // Kıdem kuralı kontrolü
  return checkSwapSeniorityRules(state, tmp, residents, dA, dB, zoneA, zoneB)
}

function checkSwapConsecutive(
  state: ScheduleState,
  tmp: Record<string, string>,
  residents: Resident[],
  iA: number,
  dB: number,
  iB: number,
  dA: number,
  days: number,
): SwapEligibility {
  if (hasConsecutive(state, tmp, iA, dB, days)) {
    return { ok: false, reason: `${residents[iA].name} → ${dB}. gün art arda nöbet oluşuyor` }
  }
  if (hasConsecutive(state, tmp, iB, dA, days)) {
    return { ok: false, reason: `${residents[iB].name} → ${dA}. gün art arda nöbet oluşuyor` }
  }
  return { ok: true }
}

function hasConsecutive(
  state: ScheduleState,
  schedule: Record<string, string>,
  astIdx: number,
  day: number,
  days: number,
): boolean {
  if (!schedule[gk(astIdx, day)]) return false
  const prev = day > 1
    ? schedule[gk(astIdx, day - 1)]
    : (day === 1 ? state.prevMonthLastDay?.[astIdx] : undefined)
  const next = day < days
    ? schedule[gk(astIdx, day + 1)]
    : (day === days ? state.nextMonthFirstDay?.[astIdx] : undefined)
  return !!(prev || next)
}

function checkSwapMinOccupancy(
  state: ScheduleState,
  tmp: Record<string, string>,
  residents: Resident[],
  dA: number,
  dB: number,
  zoneA: string,
  zoneB: string,
): SwapEligibility {
  const checkDays = dA === dB ? [dA] : [dA, dB]
  const zoneIds = new Set([zoneA, zoneB])

  for (const d of checkDays) {
    for (const zId of zoneIds) {
      const rule = getDayRule(state, d, zId)
      if (!rule.aktif || rule.min === 0) continue
      const cnt = zoneCountFromSchedule(tmp, residents, d, zId)
      if (cnt < rule.min) {
        return {
          ok: false,
          reason: `${d}. gün minimumu karşılanmıyor (${cnt}/${rule.min})`,
        }
      }
    }
  }
  return { ok: true }
}

function checkSwapSeniorityRules(
  state: ScheduleState,
  tmp: Record<string, string>,
  residents: Resident[],
  dA: number,
  dB: number,
  zoneA: string,
  zoneB: string,
): SwapEligibility {
  const checkDays = dA === dB ? [dA] : [dA, dB]
  const tmpState = { ...state, schedule: tmp }
  const zoneIds = new Set([zoneA, zoneB])

  for (const d of checkDays) {
    for (const zId of zoneIds) {
      const viols = checkSeniorityViolations(tmpState, residents, d, zId)
      if (viols.length > 0) {
        return {
          ok: false,
          reason: `${d}. gün ${zId}: ${viols[0].msg}`,
        }
      }
    }
  }
  return { ok: true }
}

// ── 9. calculateDeviation ────────────────────────────────────

/** Asistanın detaylı sapma analizi */
export function calculateDeviation(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  astIdx: number,
): DeviationResult {
  const days = totalDaysFor(state)
  const total = countTotal(state.schedule, astIdx, days)
  const target = calculateTarget(state, residents, astIdx)

  const zoneDetails: Record<string, { count: number; quota: number }> = {}
  for (const zone of zones) {
    const count = countByZone(state.schedule, astIdx, zone.id, days)
    const quota = state.quota[zone.id]?.[residents[astIdx].kidem] ?? 0
    zoneDetails[zone.id] = { count, quota }
  }

  return { total, target, zones: zoneDetails }
}

// ── 10. globalRebalance ──────────────────────────────────────

/** Tüm sapmaları dengeleyerek yeni schedule üret */
export function globalRebalance(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): Record<string, string> {
  const workState = { ...state, schedule: cloneSchedule(state.schedule) }

  removeExcessShifts(workState, residents, zones)
  fillMissingShifts(workState, residents, zones)

  return workState.schedule
}

function removeExcessShifts(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): void {
  const deviations = getAllDeviations(state, residents, zones)
    .filter(d => d.diff > 0)
    .sort((a, b) => b.diff - a.diff)

  for (const dev of deviations) {
    removeExcessForResident(state, residents, zones, dev.astIdx, dev.diff)
  }
}

function removeExcessForResident(
  state: ScheduleState,
  residents: Resident[],
  _zones: Zone[],
  astIdx: number,
  excess: number,
): void {
  const days = totalDaysFor(state)
  const shiftDays = collectShiftDays(state, astIdx, days)
  const sorted = sortDaysBySafeRemoval(state, residents, shiftDays, astIdx)
  let removed = 0

  for (const d of sorted) {
    if (removed >= excess) break
    const zoneId = state.schedule[gk(astIdx, d)]
    if (!zoneId) continue
    if (isSafeToRemove(state, residents, d, zoneId)) {
      delete state.schedule[gk(astIdx, d)]
      removed++
    }
  }
}

function collectShiftDays(
  state: ScheduleState,
  astIdx: number,
  days: number,
): number[] {
  const result: number[] = []
  for (let d = 1; d <= days; d++) {
    if (state.schedule[gk(astIdx, d)]) result.push(d)
  }
  return result
}

function sortDaysBySafeRemoval(
  state: ScheduleState,
  residents: Resident[],
  shiftDays: number[],
  astIdx: number,
): number[] {
  return [...shiftDays].sort((da, db) => {
    const aIdA = state.schedule[gk(astIdx, da)]
    const aIdB = state.schedule[gk(astIdx, db)]
    if (!aIdA || !aIdB) return 0
    const rA = getDayRule(state, da, aIdA)
    const rB = getDayRule(state, db, aIdB)
    const cntA = getZoneCount(state.schedule, residents, da, aIdA)
    const cntB = getZoneCount(state.schedule, residents, db, aIdB)
    const safeA = (cntA - 1) >= (rA.min ?? 0) ? 1 : 0
    const safeB = (cntB - 1) >= (rB.min ?? 0) ? 1 : 0
    if (safeB !== safeA) return safeB - safeA
    return cntB - cntA
  })
}

function isSafeToRemove(
  state: ScheduleState,
  residents: Resident[],
  day: number,
  zoneId: string,
): boolean {
  const cnt = getZoneCount(state.schedule, residents, day, zoneId)
  const rule = getDayRule(state, day, zoneId)
  return (cnt - 1) >= (rule.min ?? 0)
}

function fillMissingShifts(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): void {
  const deviations = getAllDeviations(state, residents, zones)
    .filter(d => d.diff < 0)
    .sort((a, b) => a.diff - b.diff)

  for (const dev of deviations) {
    fillShiftsForResident(state, residents, zones, dev.astIdx, Math.abs(dev.diff))
  }
}

function fillShiftsForResident(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  astIdx: number,
  deficit: number,
): void {
  const days = totalDaysFor(state)
  const zoneOrder = getZoneDeficitOrder(state, residents, zones, astIdx, days)
  const dayOrder = getDayWeaknessOrder(state, residents, zones, astIdx, days)
  let added = 0

  for (const { d } of dayOrder) {
    if (added >= deficit) break
    if (state.schedule[gk(astIdx, d)]) continue
    if (tryAssignBestZone(state, residents, astIdx, d, zoneOrder, zones)) added++
  }
}

function getZoneDeficitOrder(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  astIdx: number,
  days: number,
): Zone[] {
  const resident = residents[astIdx]
  if (!resident) return zones

  return [...zones]
    .map(z => ({
      zone: z,
      deficit: (state.quota[z.id]?.[resident.kidem] ?? 0) - countByZone(state.schedule, astIdx, z.id, days),
    }))
    .filter(x => x.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit)
    .map(x => x.zone)
}

function getDayWeaknessOrder(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  astIdx: number,
  days: number,
): Array<{ d: number; score: number }> {
  const result: Array<{ d: number; score: number }> = []

  for (let d = 1; d <= days; d++) {
    if (state.schedule[gk(astIdx, d)]) continue
    const score = calculateDayWeakness(state, residents, zones, d)
    result.push({ d, score })
  }

  return result.sort((a, b) => b.score - a.score)
}

function calculateDayWeakness(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  day: number,
): number {
  let score = 0
  for (const z of zones) {
    const rule = getDayRule(state, day, z.id)
    if (!rule.aktif) continue
    const cnt = getZoneCount(state.schedule, residents, day, z.id)
    if (cnt < rule.min) score += (rule.min - cnt) * 10
  }
  return score
}

function tryAssignBestZone(
  state: ScheduleState,
  residents: Resident[],
  astIdx: number,
  day: number,
  priorityZones: Zone[],
  allZones: Zone[],
): boolean {
  // Önce eksik alanları dene
  for (const z of priorityZones) {
    if (canAssign(state, residents, astIdx, day, z.id, true)) {
      state.schedule[gk(astIdx, day)] = z.id
      return true
    }
  }
  // Sonra herhangi bir alanı dene
  for (const z of allZones) {
    if (canAssign(state, residents, astIdx, day, z.id, true)) {
      state.schedule[gk(astIdx, day)] = z.id
      return true
    }
  }
  return false
}

// ── Sapma Yardımcıları ───────────────────────────────────────

interface DeviationEntry {
  astIdx: number
  diff: number
}

function getAllDeviations(
  state: ScheduleState,
  residents: Resident[],
  _zones: Zone[],
): DeviationEntry[] {
  const days = totalDaysFor(state)

  return residents
    .map((_, i) => {
      const target = calculateTarget(state, residents, i)
      const total = countTotal(state.schedule, i, days)
      return { astIdx: i, diff: total - target }
    })
    .filter(d => {
      const target = calculateTarget(state, residents, d.astIdx)
      return target > 0
    })
}
