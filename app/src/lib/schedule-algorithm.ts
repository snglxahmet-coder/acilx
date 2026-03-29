// ══════════════════════════════════════════════════════════════
// ACİLX — Nöbet Oluşturma Algoritması (nobet-algo.js → TypeScript)
// CSP Solver: 3 Fazlı (Domain + Greedy/Repair + SA)
// Saf fonksiyonlar — framework bağımsız, DOM yok
// ══════════════════════════════════════════════════════════════

import type {
  Resident,
  Zone,
  ScheduleState,
  ResidentLoad,
  AlgoConfig,
  GenLog,
  QuotaWarning,
  Seniority,
  DayRule,
} from '@/types/schedule'

import {
  gk,
  daysInMonth,
  isWeekend,
  getDOW,
  monthKey,
  getDayRule,
  isZoneActive,
  getZoneCount,
  getResidentStatus,
  getResidentShifts,
  getMonthlyLeaves,
  getMonthlyPreferences,
  getMonthlyAvoidances,
  getWeeklyPreferences,
  getWeeklyAvoidances,
  calculateTarget,
  isDistanceOk,
} from '@/lib/schedule-helpers'

import {
  checkSeniorityViolations,
  countAllViolations,
} from '@/lib/schedule-rules'

// ── Dahili Tipler ─────────────────────────────────────────────

interface Slot {
  d: number
  aId: string
  minReq: number
  maxReq: number
}

interface DomainEntry {
  d: number
  aId: string
}

interface ScoredOption {
  d: number
  aId: string
  sc: number
}

interface ShiftCost {
  d: number
  aId: string
  cost: number
}

interface SlotNeed {
  d: number
  aId: string
  eksik: number
  adayCount: number
  adaylar: number[]
}

// ── Algoritmada Kullanılan Yapılandırma ────────────────────────

interface AlgoContext {
  y: number
  m: number
  days: number
  moKey: string
  N: number
  artArdaMesafe: number
  kacinmaGucu: string
  tercihCakisma: string
  weDengesi: string
  izinHedef: string
  state: ScheduleState
  residents: Resident[]
  zones: Zone[]
  loads: ResidentLoad[]
  targets: number[]
  domains: DomainEntry[][]
  astDayAreas: Record<number, string[]>[]
  slotList: Slot[]
  areaOrder: Zone[]
  areaIds: string[]
}

// ══════════════════════════════════════════════════════════════
// ANA FONKSİYON
// ══════════════════════════════════════════════════════════════

export function generateSchedule(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): { schedule: Record<string, string>; log: GenLog } {
  clearSchedule(state, residents)
  const ctx = buildContext(state, residents, zones)

  runPhase1Greedy(ctx)
  runPhase2Repair(ctx)
  runPhase3SimulatedAnnealing(ctx)
  runFinalClamp(ctx)

  const log = buildLog(ctx)
  return { schedule: state.schedule, log }
}

// ── Schedule Temizleme ────────────────────────────────────────

function clearSchedule(
  state: ScheduleState,
  residents: Resident[],
): void {
  const { y, m } = state.currentDate
  const days = daysInMonth(y, m)
  for (let i = 0; i < residents.length; i++) {
    for (let d = 1; d <= days; d++) {
      delete state.schedule[gk(i, d)]
    }
  }
}

// ── Konteks Oluştur ──────────────────────────────────────────

function buildContext(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
): AlgoContext {
  const { y, m } = state.currentDate
  const cfg = state.algoConfig ?? ({} as AlgoConfig)
  const ctx = initContext(state, residents, zones, y, m, cfg)
  ctx.slotList = buildSlotList(ctx)
  ctx.domains = residents.map((_, i) => computeDomain(i, ctx))
  ctx.astDayAreas = buildAstDayAreas(ctx)
  return ctx
}

function initContext(
  state: ScheduleState,
  residents: Resident[],
  zones: Zone[],
  y: number,
  m: number,
  cfg: AlgoConfig,
): AlgoContext {
  return {
    y, m,
    days: daysInMonth(y, m),
    moKey: monthKey(y, m),
    N: residents.length,
    artArdaMesafe: cfg.artArdaMesafe ?? 1,
    kacinmaGucu: cfg.kacinmaGucu ?? 'guclu',
    tercihCakisma: cfg.tercihCakisma ?? 'azTercih',
    weDengesi: cfg.weDengesi ?? 'toplamEsit',
    izinHedef: cfg.izinHedef ?? 'otoDusManuel',
    state, residents, zones,
    loads: residents.map(() => ({ total: 0, byArea: {}, weCount: 0 })),
    targets: residents.map((_, i) => calculateTarget(state, residents, i)),
    domains: [],
    astDayAreas: [],
    slotList: [],
    areaOrder: buildAreaOrder(cfg, zones, state, residents),
    areaIds: zones.map(z => z.id),
  }
}

// ── Alan Sırası ──────────────────────────────────────────────

function buildAreaOrder(
  cfg: AlgoConfig,
  zones: Zone[],
  state: ScheduleState,
  residents: Resident[],
): Zone[] {
  if (cfg.alanOncelikleri?.length) {
    return buildPriorityAreaOrder(cfg.alanOncelikleri, zones)
  }
  return buildDefaultAreaOrder(zones, state, residents)
}

function buildPriorityAreaOrder(
  priorities: string[],
  zones: Zone[],
): Zone[] {
  const ordered = priorities
    .map(id => zones.find(a => a.id === id))
    .filter((a): a is Zone => !!a)
  for (const z of zones) {
    if (!ordered.find(x => x.id === z.id)) ordered.push(z)
  }
  return ordered
}

function buildDefaultAreaOrder(
  zones: Zone[],
  state: ScheduleState,
  residents: Resident[],
): Zone[] {
  return [...zones].sort((a, b) => {
    const ra = state.defaultDayMin[a.id]
    const rb = state.defaultDayMin[b.id]
    const minA = ra?.min ?? 0
    const minB = rb?.min ?? 0
    if ((minA === 0) !== (minB === 0)) return minA === 0 ? 1 : -1

    const grpA = hasYalnizRule(ra) ? 1 : 0
    const grpB = hasYalnizRule(rb) ? 1 : 0
    if (grpA !== grpB) return grpB - grpA

    const cntA = residents.filter(x => (state.quota[a.id]?.[x.kidem] ?? 0) > 0).length
    const cntB = residents.filter(x => (state.quota[b.id]?.[x.kidem] ?? 0) > 0).length
    return cntA - cntB
  })
}

function hasYalnizRule(rule: DayRule | undefined): boolean {
  if (!rule?.kidemKurallari) return false
  return Object.values(rule.kidemKurallari).some(k => k.yalnizTutamaz)
}

// ── Slot Listesi ────────────────────────────────────────────

function buildSlotList(ctx: AlgoContext): Slot[] {
  const slots: Slot[] = []
  for (let d = 1; d <= ctx.days; d++) {
    for (const area of ctx.areaOrder) {
      if (!isZoneActive(ctx.state, d, area.id)) continue
      const rule = getDayRule(ctx.state, d, area.id)
      if (!rule.aktif) continue
      slots.push({
        d,
        aId: area.id,
        minReq: rule.min ?? 0,
        maxReq: rule.max ?? 99,
      })
    }
  }
  return slots
}

// ── Domain Hesaplama ────────────────────────────────────────

function computeDomain(i: number, ctx: AlgoContext): DomainEntry[] {
  const dur = getResidentStatus(ctx.state.astProfiles, i)
  if (dur === 'izinli' || dur === 'rot_hayir') return []

  const izinler = getMonthlyLeaves(ctx.state.astProfiles, i, ctx.moKey)
  const kidem = ctx.residents[i].kidem
  const siftleri = getResidentShifts(ctx.state.astProfiles, i)
  const dom: DomainEntry[] = []

  for (const sl of ctx.slotList) {
    if (izinler.includes(sl.d)) continue
    if (!isQuotaAvailable(ctx.state, sl.aId, kidem)) continue
    if (!isShiftCompatible(ctx.state, sl.aId, siftleri)) continue
    dom.push({ d: sl.d, aId: sl.aId })
  }
  return dom
}

function isQuotaAvailable(
  state: ScheduleState,
  aId: string,
  kidem: Seniority,
): boolean {
  return (state.quota[aId]?.[kidem] ?? 0) > 0
}

function isShiftCompatible(
  state: ScheduleState,
  aId: string,
  siftleri: string[],
): boolean {
  const alanSiftler = state.defaultDayMin[aId]?.siftler ?? ['24h']
  return siftleri.some(s => alanSiftler.includes(s as typeof alanSiftler[number]))
}

// ── Lookup Tabloları ────────────────────────────────────────

function buildAstDayAreas(
  ctx: AlgoContext,
): Record<number, string[]>[] {
  return ctx.residents.map((_, i) => {
    const m: Record<number, string[]> = {}
    for (const { d, aId } of ctx.domains[i]) {
      if (!m[d]) m[d] = []
      m[d].push(aId)
    }
    return m
  })
}

// ══════════════════════════════════════════════════════════════
// ATAMA / KALDIR
// ══════════════════════════════════════════════════════════════

function assign(
  i: number,
  d: number,
  aId: string,
  ctx: AlgoContext,
): boolean {
  if (ctx.state.schedule[gk(i, d)]) return false
  if (!isDistanceOkLocal(i, d, ctx)) return false
  const dur = getResidentStatus(ctx.state.astProfiles, i)
  if (dur === 'izinli' || dur === 'rot_hayir') return false
  const izinler = getMonthlyLeaves(ctx.state.astProfiles, i, ctx.moKey)
  if (izinler.includes(d)) return false

  ctx.state.schedule[gk(i, d)] = aId
  ctx.loads[i].total++
  ctx.loads[i].byArea[aId] = (ctx.loads[i].byArea[aId] ?? 0) + 1
  if (isWeekend(ctx.y, ctx.m, d)) {
    ctx.loads[i].weCount = (ctx.loads[i].weCount ?? 0) + 1
  }
  return true
}

function unassign(
  i: number,
  d: number,
  ctx: AlgoContext,
): string | null {
  const aId = ctx.state.schedule[gk(i, d)]
  if (!aId) return null
  delete ctx.state.schedule[gk(i, d)]
  ctx.loads[i].total = Math.max(0, ctx.loads[i].total - 1)
  ctx.loads[i].byArea[aId] = Math.max(0, (ctx.loads[i].byArea[aId] ?? 1) - 1)
  if (isWeekend(ctx.y, ctx.m, d)) {
    ctx.loads[i].weCount = Math.max(0, (ctx.loads[i].weCount ?? 1) - 1)
  }
  return aId
}

// ── Mesafe Kontrolü ─────────────────────────────────────────

function isDistanceOkLocal(
  i: number,
  d: number,
  ctx: AlgoContext,
): boolean {
  return isDistanceOk(
    ctx.state.schedule, i, d, ctx.days,
    ctx.artArdaMesafe,
    ctx.state.prevMonthLastDay,
    ctx.state.nextMonthFirstDay,
  )
}

// ══════════════════════════════════════════════════════════════
// canPlace — Hard Constraint Kontrolü
// ══════════════════════════════════════════════════════════════

function canPlace(
  i: number,
  d: number,
  aId: string,
  ctx: AlgoContext,
  ignoreHedef: boolean,
  ignoreKacinma: boolean,
): boolean {
  if (!ignoreHedef && ctx.loads[i].total >= ctx.targets[i]) return false
  if (ctx.state.schedule[gk(i, d)]) return false
  if (!checkQuotaLimits(i, aId, ctx)) return false
  if (!checkDayMax(d, aId, ctx)) return false
  if (!checkKidemMax(i, d, aId, ctx)) return false
  if (!checkGroupMax(i, d, aId, ctx)) return false
  if (!isDistanceOkLocal(i, d, ctx)) return false
  if (!checkKacinma(i, d, ctx, ignoreKacinma)) return false
  return true
}

function checkQuotaLimits(
  i: number,
  aId: string,
  ctx: AlgoContext,
): boolean {
  const kidem = ctx.residents[i].kidem
  const alanKota = ctx.state.quota[aId]?.[kidem] ?? 0
  if (alanKota <= 0) return false
  if ((ctx.loads[i].byArea[aId] ?? 0) >= alanKota) return false
  return true
}

function checkDayMax(
  d: number,
  aId: string,
  ctx: AlgoContext,
): boolean {
  const rule = getDayRule(ctx.state, d, aId)
  const cnt = getZoneCount(ctx.state.schedule, ctx.residents, d, aId)
  return cnt < (rule.max ?? 99)
}

function checkKidemMax(
  i: number,
  d: number,
  aId: string,
  ctx: AlgoContext,
): boolean {
  const kidem = ctx.residents[i].kidem
  const rule = getDayRule(ctx.state, d, aId)
  const kMax = (rule.kidemMax ?? {})[kidem] ?? 0
  if (kMax <= 0) return true
  const kCnt = countKidemInSlot(d, aId, kidem, ctx)
  return kCnt < kMax
}

function checkGroupMax(
  i: number,
  d: number,
  aId: string,
  ctx: AlgoContext,
): boolean {
  const kidem = ctx.residents[i].kidem
  const gRules = ctx.state.defaultDayMin[aId]?.kidemGrupKurallari ?? []
  for (const g of gRules) {
    const gMax = g.enFazlaKac ?? 0
    if (gMax <= 0) continue
    if (!(g.kidemler ?? []).includes(kidem)) continue
    let gCnt = 0
    for (const gk2 of (g.kidemler ?? [])) {
      gCnt += countKidemInSlot(d, aId, gk2 as Seniority, ctx)
    }
    if (gCnt >= gMax) return false
  }
  return true
}

function checkKacinma(
  i: number,
  d: number,
  ctx: AlgoContext,
  ignore: boolean,
): boolean {
  if (ignore) return true
  const kac = getMonthlyAvoidances(ctx.state.astProfiles, i, ctx.moKey)
  if (ctx.kacinmaGucu === 'sert' && kac.includes(d)) return false
  if (ctx.kacinmaGucu === 'guclu' && kac.includes(d)) return false
  return true
}

function countKidemInSlot(
  d: number,
  aId: string,
  kidem: Seniority,
  ctx: AlgoContext,
): number {
  return ctx.residents.filter(
    (_, j) => ctx.state.schedule[gk(j, d)] === aId
      && ctx.residents[j].kidem === kidem,
  ).length
}

// ══════════════════════════════════════════════════════════════
// dayScore — Yerleştirme Kalitesi Skoru
// ══════════════════════════════════════════════════════════════

function dayScore(
  i: number,
  d: number,
  aId: string,
  ctx: AlgoContext,
): number {
  let sc = 0
  sc += quotaBonus(i, aId, ctx)
  sc += minDeficitBonus(d, aId, ctx)
  sc += kidemMinBonus(i, d, aId, ctx)
  sc += kidemMaxPenalty(i, d, aId, ctx)
  sc += crossAreaKidemPenalty(i, d, ctx)
  sc += kidemVarietyBonus(i, d, aId, ctx)
  sc += groupMinMaxBonus(i, d, aId, ctx)
  sc += slotFullnessPenalty(d, aId, ctx)
  sc += spreadBonus(i, d, ctx)
  sc += tercihScore(i, d, ctx) * -3
  sc += weekendBalanceScore(i, d, ctx)
  return sc
}

function quotaBonus(
  i: number,
  aId: string,
  ctx: AlgoContext,
): number {
  const kidem = ctx.residents[i].kidem
  const kotaLimit = ctx.state.quota[aId]?.[kidem] ?? 0
  const mevcut = ctx.loads[i].byArea[aId] ?? 0
  if (kotaLimit <= 0) return -5000
  const kalan = kotaLimit - mevcut
  return kalan > 0 ? 300 + kalan * 40 : -2000
}

function minDeficitBonus(
  d: number,
  aId: string,
  ctx: AlgoContext,
): number {
  const rule = getDayRule(ctx.state, d, aId)
  const cnt = getZoneCount(ctx.state.schedule, ctx.residents, d, aId)
  return cnt < (rule.min ?? 0) ? 500 : 0
}

function kidemMinBonus(
  i: number,
  d: number,
  aId: string,
  ctx: AlgoContext,
): number {
  const kidem = ctx.residents[i].kidem
  const rule = getDayRule(ctx.state, d, aId)
  const kMinReq = (rule.kidemMin ?? {})[kidem] ?? 0
  if (kMinReq <= 0) return 0
  const cnt = countKidemInSlot(d, aId, kidem, ctx)
  return cnt < kMinReq ? 600 : 0
}

function kidemMaxPenalty(
  i: number,
  d: number,
  aId: string,
  ctx: AlgoContext,
): number {
  const kidem = ctx.residents[i].kidem
  const rule = getDayRule(ctx.state, d, aId)
  const kMaxReq = (rule.kidemMax ?? {})[kidem] ?? 0
  if (kMaxReq <= 0) return 0
  const cnt = countKidemInSlot(d, aId, kidem, ctx)
  return cnt >= kMaxReq ? -3000 : 0
}

function crossAreaKidemPenalty(
  i: number,
  d: number,
  ctx: AlgoContext,
): number {
  const kidem = ctx.residents[i].kidem
  const cnt = ctx.residents.filter(
    (_, j) => ctx.state.schedule[gk(j, d)] && ctx.residents[j].kidem === kidem,
  ).length
  return cnt >= 3 ? -cnt * 40 : 0
}

function kidemVarietyBonus(
  i: number,
  d: number,
  aId: string,
  ctx: AlgoContext,
): number {
  const kidem = ctx.residents[i].kidem
  const cnt = countKidemInSlot(d, aId, kidem, ctx)
  return cnt === 0 ? 200 : -cnt * 80
}

function groupMinMaxBonus(
  i: number,
  d: number,
  aId: string,
  ctx: AlgoContext,
): number {
  const kidem = ctx.residents[i].kidem
  const gRules = ctx.state.defaultDayMin[aId]?.kidemGrupKurallari ?? []
  let sc = 0
  for (const g of gRules) {
    if (!(g.kidemler ?? []).includes(kidem)) continue
    let gCnt = 0
    for (const gk2 of (g.kidemler ?? [])) {
      gCnt += countKidemInSlot(d, aId, gk2 as Seniority, ctx)
    }
    if ((g.enAzKac ?? 0) > 0 && gCnt < g.enAzKac) sc += 400
    if ((g.enFazlaKac ?? 0) > 0 && gCnt >= g.enFazlaKac) sc -= 3000
  }
  return sc
}

function slotFullnessPenalty(
  d: number,
  aId: string,
  ctx: AlgoContext,
): number {
  return -getZoneCount(ctx.state.schedule, ctx.residents, d, aId) * 15
}

function spreadBonus(
  i: number,
  d: number,
  ctx: AlgoContext,
): number {
  const myDays = collectMyDays(i, ctx)
  if (myDays.length === 0) return 0
  const minDist = Math.min(...myDays.map(dd => Math.abs(dd - d)))
  if (minDist <= ctx.artArdaMesafe) return -2000
  if (minDist === ctx.artArdaMesafe + 1) return -50
  return minDist * 3
}

function collectMyDays(i: number, ctx: AlgoContext): number[] {
  const result: number[] = []
  for (let dd = 1; dd <= ctx.days; dd++) {
    if (ctx.state.schedule[gk(i, dd)]) result.push(dd)
  }
  return result
}

function weekendBalanceScore(
  i: number,
  d: number,
  ctx: AlgoContext,
): number {
  if (!isWeekend(ctx.y, ctx.m, d)) return 0
  const idealWe = Math.round(ctx.targets[i] * (7 / ctx.days))
  return -Math.abs((ctx.loads[i].weCount ?? 0) - idealWe) * 20
}

// ── Tercih Skoru ────────────────────────────────────────────

function tercihScore(
  i: number,
  d: number,
  ctx: AlgoContext,
): number {
  let score = 0
  const dw = getDOW(ctx.y, ctx.m, d)
  const kacH = getWeeklyAvoidances(ctx.state.astProfiles, i)
  const tercH = getWeeklyPreferences(ctx.state.astProfiles, i)
  const tercA = getMonthlyPreferences(ctx.state.astProfiles, i, ctx.moKey)
  const kacA = getMonthlyAvoidances(ctx.state.astProfiles, i, ctx.moKey)

  if (kacH.includes(dw)) score += 20
  if (tercH.includes(dw)) score -= 8
  if (tercA.includes(d)) score -= 60
  if (ctx.kacinmaGucu === 'yumusak' && kacA.includes(d)) score += 100

  score += tercihCakismaScore(i, ctx)
  return score
}

function tercihCakismaScore(i: number, ctx: AlgoContext): number {
  const tercA = getMonthlyPreferences(ctx.state.astProfiles, i, ctx.moKey)
  const tercH = getWeeklyPreferences(ctx.state.astProfiles, i)
  const tp = tercA.length + tercH.length
  const remaining = ctx.targets[i] - ctx.loads[i].total

  if (ctx.tercihCakisma === 'azTercih') {
    return -(tp > 0 ? Math.max(0, 15 - tp * 3) : 0)
  }
  if (ctx.tercihCakisma === 'kidemOnce') {
    return -ctx.residents[i].kidem * 5
  }
  if (ctx.tercihCakisma === 'adaletli') {
    return -remaining * 2
  }
  if (ctx.tercihCakisma === 'karma') {
    return -ctx.residents[i].kidem * 3 - remaining * 1.5
  }
  return 0
}

// ══════════════════════════════════════════════════════════════
// FAZ 1: GREEDY CONSTRUCTIVE HEURISTIC
// ══════════════════════════════════════════════════════════════

function runPhase1Greedy(ctx: AlgoContext): void {
  fillMinRequirements(ctx)
  fillKidemMinRequirements(ctx)
  fillRemainingTargets(ctx)
}

// ── Geçiş 1a: Min Doldurma ──────────────────────────────────

function fillMinRequirements(ctx: AlgoContext): void {
  for (let pass = 0; pass < 3; pass++) {
    const ignoreKacinma = pass >= 1
    const needs = collectSlotNeeds(ctx, ignoreKacinma)
    needs.sort((a, b) => a.adayCount - b.adayCount || b.eksik - a.eksik)
    for (const need of needs) {
      fillSingleSlot(need, ctx, ignoreKacinma)
    }
  }
}

function collectSlotNeeds(
  ctx: AlgoContext,
  ignoreKacinma: boolean,
): SlotNeed[] {
  const needs: SlotNeed[] = []
  for (const sl of ctx.slotList) {
    const cnt = getZoneCount(ctx.state.schedule, ctx.residents, sl.d, sl.aId)
    const eksik = sl.minReq - cnt
    if (eksik <= 0) continue
    const adaylar = findCandidates(sl, ctx, ignoreKacinma)
    needs.push({
      d: sl.d, aId: sl.aId, eksik,
      adayCount: adaylar.length, adaylar,
    })
  }
  return needs
}

function findCandidates(
  sl: Slot,
  ctx: AlgoContext,
  ignoreKacinma: boolean,
): number[] {
  const adaylar: number[] = []
  for (let i = 0; i < ctx.N; i++) {
    if (ctx.targets[i] <= 0) continue
    if (!ctx.astDayAreas[i][sl.d]?.includes(sl.aId)) continue
    if (canPlace(i, sl.d, sl.aId, ctx, false, ignoreKacinma)) {
      adaylar.push(i)
    }
  }
  return adaylar
}

function fillSingleSlot(
  need: SlotNeed,
  ctx: AlgoContext,
  ignoreKacinma: boolean,
): void {
  const rule = getDayRule(ctx.state, need.d, need.aId)
  let eksik = (rule.min ?? 0) - getZoneCount(
    ctx.state.schedule, ctx.residents, need.d, need.aId,
  )
  if (eksik <= 0) return

  const scored = scoreCandidates(need.adaylar, need, ctx, ignoreKacinma)
  for (const { i } of scored) {
    if (eksik <= 0) break
    const cnt = getZoneCount(ctx.state.schedule, ctx.residents, need.d, need.aId)
    if (cnt >= (rule.max ?? 99)) break
    if (canPlace(i, need.d, need.aId, ctx, false, ignoreKacinma)) {
      assign(i, need.d, need.aId, ctx)
      eksik--
    }
  }
}

function scoreCandidates(
  adaylar: number[],
  need: SlotNeed,
  ctx: AlgoContext,
  ignoreKacinma: boolean,
): { i: number; sc: number }[] {
  return adaylar
    .filter(i => canPlace(i, need.d, need.aId, ctx, false, ignoreKacinma))
    .map(i => ({ i, sc: dayScore(i, need.d, need.aId, ctx) }))
    .sort((a, b) => b.sc - a.sc)
}

// ── Geçiş 1b: KidemMin Doldurma ────────────────────────────

function fillKidemMinRequirements(ctx: AlgoContext): void {
  for (let pass = 0; pass < 3; pass++) {
    const ignoreKacinma = pass >= 1
    for (const sl of ctx.slotList) {
      fillKidemMinForSlot(sl, ctx, ignoreKacinma)
    }
  }
}

function fillKidemMinForSlot(
  sl: Slot,
  ctx: AlgoContext,
  ignoreKacinma: boolean,
): void {
  const rule = getDayRule(ctx.state, sl.d, sl.aId)
  if (!rule.aktif) return
  const kMinObj = rule.kidemMin ?? {}

  for (const kk of Object.keys(kMinObj)) {
    const kMinReq = kMinObj[Number(kk)] ?? 0
    if (kMinReq <= 0) continue
    const kidemNum = Number(kk) as Seniority
    const mevcut = countKidemInSlot(sl.d, sl.aId, kidemNum, ctx)
    if (mevcut >= kMinReq) continue
    fillKidemMinCandidates(sl, kidemNum, kMinReq - mevcut, ctx, ignoreKacinma)
  }
}

function fillKidemMinCandidates(
  sl: Slot,
  kidemNum: Seniority,
  eksik: number,
  ctx: AlgoContext,
  ignoreKacinma: boolean,
): void {
  const rule = getDayRule(ctx.state, sl.d, sl.aId)
  const adaylar: number[] = []
  for (let i = 0; i < ctx.N; i++) {
    if (ctx.targets[i] <= 0) continue
    if (ctx.residents[i].kidem !== kidemNum) continue
    if (!ctx.astDayAreas[i][sl.d]?.includes(sl.aId)) continue
    if (canPlace(i, sl.d, sl.aId, ctx, false, ignoreKacinma)) {
      adaylar.push(i)
    }
  }
  adaylar.sort((a, b) => dayScore(b, sl.d, sl.aId, ctx) - dayScore(a, sl.d, sl.aId, ctx))

  let placed = 0
  for (const i of adaylar) {
    if (placed >= eksik) break
    const cnt = getZoneCount(ctx.state.schedule, ctx.residents, sl.d, sl.aId)
    if (cnt >= (rule.max ?? 99)) break
    if (canPlace(i, sl.d, sl.aId, ctx, false, ignoreKacinma)) {
      assign(i, sl.d, sl.aId, ctx)
      placed++
    }
  }
}

// ── Geçiş 2: Kalan Hedefleri Doldur ────────────────────────

function fillRemainingTargets(ctx: AlgoContext): void {
  const astOrder = buildAstOrder(ctx)
  for (let pass = 0; pass < 3; pass++) {
    const ignoreKacinma = pass >= 1
    const ignoreHedef = pass >= 2
    for (const i of astOrder) {
      fillResidentTarget(i, ctx, ignoreHedef, ignoreKacinma)
    }
  }
}

function buildAstOrder(ctx: AlgoContext): number[] {
  return ctx.residents
    .map((_, i) => i)
    .filter(i => ctx.targets[i] > 0)
    .sort((a, b) => {
      const oranA = (ctx.targets[a] - ctx.loads[a].total) / Math.max(ctx.targets[a], 1)
      const oranB = (ctx.targets[b] - ctx.loads[b].total) / Math.max(ctx.targets[b], 1)
      return oranB - oranA
    })
}

function fillResidentTarget(
  i: number,
  ctx: AlgoContext,
  ignoreHedef: boolean,
  ignoreKacinma: boolean,
): void {
  const remaining = ctx.targets[i] - ctx.loads[i].total
  if (remaining <= 0) return

  const options: ScoredOption[] = []
  for (const { d, aId } of ctx.domains[i]) {
    if (!canPlace(i, d, aId, ctx, ignoreHedef, ignoreKacinma)) continue
    options.push({ d, aId, sc: dayScore(i, d, aId, ctx) })
  }
  options.sort((a, b) => b.sc - a.sc)

  let placed = 0
  for (const opt of options) {
    if (placed >= remaining) break
    if (!canPlace(i, opt.d, opt.aId, ctx, ignoreHedef, ignoreKacinma)) continue
    assign(i, opt.d, opt.aId, ctx)
    placed++
  }
}

// ══════════════════════════════════════════════════════════════
// FAZ 2: ITERATIVE REPAIR
// ══════════════════════════════════════════════════════════════

function runPhase2Repair(ctx: AlgoContext): void {
  const REPAIR_LIMIT = 50000
  let violations = countViolationsLocal(ctx)
  let repairIter = 0

  while (violations > 0 && repairIter < REPAIR_LIMIT) {
    const result = runRepairStrategies(ctx, repairIter, REPAIR_LIMIT)
    repairIter = result.iter
    const newV = countViolationsLocal(ctx)
    if (newV >= violations && !result.improved) break
    violations = newV
  }
}

function runRepairStrategies(
  ctx: AlgoContext,
  iter: number,
  limit: number,
): { iter: number; improved: boolean } {
  let improved = false
  const strategies = [
    repairAddToUnder, repairFillMinSlots, repairSeniority,
    repairRemoveOver, repairQuotaDeficit, repairKidemMin,
  ]
  for (const strategy of strategies) {
    const r = strategy(ctx, iter, limit)
    iter = r.iter
    improved = improved || r.improved
  }
  return { iter, improved }
}

function countViolationsLocal(ctx: AlgoContext): number {
  return countAllViolations(
    ctx.state, ctx.residents, ctx.zones,
    ctx.targets, ctx.loads,
  )
}

// ── Strateji 1: Eksik Olanlara Nöbet Ekle ───────────────────

function repairAddToUnder(
  ctx: AlgoContext,
  iter: number,
  limit: number,
): { iter: number; improved: boolean } {
  let improved = false
  for (let i = 0; i < ctx.N && iter < limit; i++) {
    iter++
    const eksik = ctx.targets[i] - ctx.loads[i].total
    if (eksik <= 0) continue
    const best = findBestSlotForResident(i, ctx)
    if (best) {
      assign(i, best.d, best.aId, ctx)
      improved = true
    }
  }
  return { iter, improved }
}

function findBestSlotForResident(
  i: number,
  ctx: AlgoContext,
): DomainEntry | null {
  let bestD: number | null = null
  let bestA: string | null = null
  let bestSc = -Infinity

  for (const { d, aId } of ctx.domains[i]) {
    if (ctx.state.schedule[gk(i, d)]) continue
    if (!checkQuotaLimits(i, aId, ctx)) continue
    if (!checkDayMax(d, aId, ctx)) continue
    if (!isDistanceOkLocal(i, d, ctx)) continue
    const sc = dayScore(i, d, aId, ctx)
    if (sc > bestSc) { bestSc = sc; bestD = d; bestA = aId }
  }
  if (bestD !== null && bestA !== null) return { d: bestD, aId: bestA }
  return null
}

// ── Strateji 2: Min Eksik Slotlara Kişi Ekle ────────────────

function repairFillMinSlots(
  ctx: AlgoContext,
  iter: number,
  limit: number,
): { iter: number; improved: boolean } {
  let improved = false
  for (let d = 1; d <= ctx.days && iter < limit; d++) {
    for (const zone of ctx.zones) {
      iter++
      if (!isZoneActive(ctx.state, d, zone.id)) continue
      const rule = getDayRule(ctx.state, d, zone.id)
      const cnt = getZoneCount(ctx.state.schedule, ctx.residents, d, zone.id)
      if (cnt >= (rule.min ?? 0)) continue
      improved = fillMinSlotCandidates(d, zone.id, ctx) || improved
    }
  }
  return { iter, improved }
}

function fillMinSlotCandidates(
  d: number,
  aId: string,
  ctx: AlgoContext,
): boolean {
  const rule = getDayRule(ctx.state, d, aId)
  let improved = false
  for (let i = 0; i < ctx.N; i++) {
    const cnt = getZoneCount(ctx.state.schedule, ctx.residents, d, aId)
    if (cnt >= (rule.min ?? 0)) break
    if (ctx.state.schedule[gk(i, d)]) continue
    if (!ctx.astDayAreas[i][d]?.includes(aId)) continue
    if (!checkQuotaLimits(i, aId, ctx)) continue
    if (!isDistanceOkLocal(i, d, ctx)) continue
    if (assign(i, d, aId, ctx)) improved = true
  }
  return improved
}

// ── Strateji 3: Kıdem Kuralı İhlallerini Düzelt ─────────────

function repairSeniority(
  ctx: AlgoContext,
  iter: number,
  limit: number,
): { iter: number; improved: boolean } {
  let improved = false
  for (let d = 1; d <= ctx.days && iter < limit; d++) {
    for (const zone of ctx.zones) {
      if (!isZoneActive(ctx.state, d, zone.id)) continue
      const cnt = getZoneCount(ctx.state.schedule, ctx.residents, d, zone.id)
      if (cnt === 0) continue
      const viols = checkSeniorityViolations(ctx.state, ctx.residents, d, zone.id)
      if (!viols.length) continue
      iter++
      improved = fixSeniorityViolations(d, zone.id, viols, ctx) || improved
    }
  }
  return { iter, improved }
}

interface SenViol {
  tip: string
  kidem?: number
  yanindaKidemler?: number[]
  kidemler?: number[]
  msg: string
}

function fixSeniorityViolations(
  d: number,
  aId: string,
  viols: SenViol[],
  ctx: AlgoContext,
): boolean {
  let improved = false
  const maxD = getDayRule(ctx.state, d, aId).max ?? 99
  if (getZoneCount(ctx.state.schedule, ctx.residents, d, aId) >= maxD) return false

  for (const viol of viols) {
    const gerekli = getRequiredKidems(viol)
    improved = addRequiredKidem(d, aId, gerekli, ctx) || improved
  }
  return improved
}

function getRequiredKidems(viol: SenViol): number[] {
  if (viol.tip === 'yalniz') {
    return viol.yanindaKidemler?.length ? viol.yanindaKidemler : [viol.kidem ?? 0]
  }
  if (viol.tip === 'grup') return viol.kidemler ?? []
  return []
}

function addRequiredKidem(
  d: number,
  aId: string,
  gerekli: number[],
  ctx: AlgoContext,
): boolean {
  for (let i = 0; i < ctx.N; i++) {
    if (ctx.state.schedule[gk(i, d)]) continue
    if (!isDistanceOkLocal(i, d, ctx)) continue
    if (!gerekli.includes(ctx.residents[i].kidem)) continue
    if (!ctx.astDayAreas[i][d]?.includes(aId)) continue
    if (!checkQuotaLimits(i, aId, ctx)) continue
    if (assign(i, d, aId, ctx)) return true
  }
  return false
}

// ── Strateji 4: Fazla Olandan Kaldır ────────────────────────

function repairRemoveOver(
  ctx: AlgoContext,
  iter: number,
  limit: number,
): { iter: number; improved: boolean } {
  let improved = false
  for (let i = 0; i < ctx.N && iter < limit; i++) {
    iter++
    const fazla = ctx.loads[i].total - ctx.targets[i]
    if (fazla <= 0) continue
    improved = removeExcessShifts(i, fazla, ctx) || improved
  }
  return { iter, improved }
}

function removeExcessShifts(
  i: number,
  fazla: number,
  ctx: AlgoContext,
): boolean {
  const shifts = collectShiftCosts(i, ctx)
  shifts.sort((a, b) => a.cost - b.cost)
  let removed = 0
  for (const sh of shifts) {
    if (removed >= fazla) break
    unassign(i, sh.d, ctx)
    removed++
  }
  return removed > 0
}

function collectShiftCosts(i: number, ctx: AlgoContext): ShiftCost[] {
  const result: ShiftCost[] = []
  for (let d = 1; d <= ctx.days; d++) {
    const aId = ctx.state.schedule[gk(i, d)]
    if (!aId) continue
    const rule = getDayRule(ctx.state, d, aId)
    const cnt = getZoneCount(ctx.state.schedule, ctx.residents, d, aId)
    const kotaLimit = ctx.state.quota[aId]?.[ctx.residents[i].kidem] ?? 0
    const mevcut = ctx.loads[i].byArea[aId] ?? 0
    const kotaCost = kotaLimit > 0 && mevcut <= kotaLimit ? 500 : 0
    const cost = (cnt <= (rule.min ?? 0) ? 1000 : 0) + kotaCost
    result.push({ d, aId, cost })
  }
  return result
}

// ── Strateji 5: Kota Hedefi Eksik ────────────────────────────

function repairQuotaDeficit(
  ctx: AlgoContext,
  iter: number,
  limit: number,
): { iter: number; improved: boolean } {
  let improved = false
  for (let i = 0; i < ctx.N && iter < limit; i++) {
    if (ctx.targets[i] <= 0) continue
    for (const aId of ctx.areaIds) {
      iter++
      const kotaLimit = ctx.state.quota[aId]?.[ctx.residents[i].kidem] ?? 0
      if (kotaLimit <= 0) continue
      const mevcut = ctx.loads[i].byArea[aId] ?? 0
      const eksik = kotaLimit - mevcut
      if (eksik <= 0) continue
      improved = fillQuotaDeficit(i, aId, eksik, ctx) || improved
    }
  }
  return { iter, improved }
}

function fillQuotaDeficit(
  i: number,
  aId: string,
  eksik: number,
  ctx: AlgoContext,
): boolean {
  let placed = 0
  let improved = false
  for (let d = 1; d <= ctx.days && placed < eksik; d++) {
    if (ctx.state.schedule[gk(i, d)]) continue
    if (!isZoneActive(ctx.state, d, aId)) continue
    if (!checkDayMax(d, aId, ctx)) continue
    if (!isDistanceOkLocal(i, d, ctx)) continue
    const izinler = getMonthlyLeaves(ctx.state.astProfiles, i, ctx.moKey)
    if (izinler.includes(d)) continue
    assign(i, d, aId, ctx)
    placed++
    improved = true
  }
  return improved
}

// ── Strateji 6: kidemMin İhlalleri ───────────────────────────

function repairKidemMin(
  ctx: AlgoContext,
  iter: number,
  limit: number,
): { iter: number; improved: boolean } {
  let improved = false
  for (let d = 1; d <= ctx.days && iter < limit; d++) {
    for (const zone of ctx.zones) {
      if (!isZoneActive(ctx.state, d, zone.id)) continue
      const rule = getDayRule(ctx.state, d, zone.id)
      if (!rule.aktif) continue
      const kMinObj = rule.kidemMin ?? {}
      for (const kk of Object.keys(kMinObj)) {
        iter++
        const kMinReq = kMinObj[Number(kk)] ?? 0
        if (kMinReq <= 0) continue
        const kidemNum = Number(kk) as Seniority
        const kCnt = countKidemInSlot(d, zone.id, kidemNum, ctx)
        if (kCnt >= kMinReq) continue
        improved = repairSingleKidemMin(d, zone.id, kidemNum, kMinReq, kMinObj, ctx) || improved
      }
    }
  }
  return { iter, improved }
}

function repairSingleKidemMin(
  d: number,
  aId: string,
  kidemNum: Seniority,
  kMinReq: number,
  kMinObj: Record<number, number>,
  ctx: AlgoContext,
): boolean {
  const rule = getDayRule(ctx.state, d, aId)
  const cnt = getZoneCount(ctx.state.schedule, ctx.residents, d, aId)

  if (cnt < (rule.max ?? 99)) {
    return directAddKidem(d, aId, kidemNum, kMinReq, ctx)
  }
  return swapForKidem(d, aId, kidemNum, kMinReq, kMinObj, ctx)
}

function directAddKidem(
  d: number,
  aId: string,
  kidemNum: Seniority,
  kMinReq: number,
  ctx: AlgoContext,
): boolean {
  let improved = false
  for (let i = 0; i < ctx.N; i++) {
    if (countKidemInSlot(d, aId, kidemNum, ctx) >= kMinReq) break
    if (ctx.targets[i] <= 0) continue
    if (ctx.residents[i].kidem !== kidemNum) continue
    if (ctx.state.schedule[gk(i, d)]) continue
    const izinler = getMonthlyLeaves(ctx.state.astProfiles, i, ctx.moKey)
    if (izinler.includes(d)) continue
    if (assign(i, d, aId, ctx)) improved = true
  }
  return improved
}

function swapForKidem(
  d: number,
  aId: string,
  kidemNum: Seniority,
  _kMinReq: number,
  kMinObj: Record<number, number>,
  ctx: AlgoContext,
): boolean {
  const atananlar = ctx.residents
    .map((_, j) => j)
    .filter(j => ctx.state.schedule[gk(j, d)] === aId)

  const swapAday = atananlar.find(j => {
    const jK = ctx.residents[j].kidem
    if (jK === kidemNum) return false
    const jKMin = kMinObj[jK] ?? 0
    const jKCnt = countKidemInSlot(d, aId, jK, ctx)
    return jKCnt > jKMin
  })

  if (swapAday === undefined) return false
  return performKidemSwap(d, aId, swapAday, kidemNum, ctx)
}

function performKidemSwap(
  d: number,
  aId: string,
  swapAday: number,
  kidemNum: Seniority,
  ctx: AlgoContext,
): boolean {
  for (let i = 0; i < ctx.N; i++) {
    if (ctx.targets[i] <= 0 || ctx.residents[i].kidem !== kidemNum) continue
    if (ctx.state.schedule[gk(i, d)]) continue
    const izinler = getMonthlyLeaves(ctx.state.astProfiles, i, ctx.moKey)
    if (izinler.includes(d)) continue
    unassign(swapAday, d, ctx)
    if (assign(i, d, aId, ctx)) return true
    // Geri al
    assign(swapAday, d, aId, ctx)
  }
  return false
}

// ══════════════════════════════════════════════════════════════
// FAZ 3: SIMULATED ANNEALING
// ══════════════════════════════════════════════════════════════

function runPhase3SimulatedAnnealing(ctx: AlgoContext): void {
  let currentScore = softScore(ctx)
  let violations = countViolationsLocal(ctx)
  const SA_ITER = 5000
  let temp = 100
  const coolingRate = 0.98

  for (let iter = 0; iter < SA_ITER; iter++) {
    const result = saIteration(ctx, currentScore, violations, temp)
    currentScore = result.score
    violations = result.violations
    temp *= coolingRate
  }
}

function saIteration(
  ctx: AlgoContext,
  currentScore: number,
  violations: number,
  temp: number,
): { score: number; violations: number } {
  const d = 1 + Math.floor(Math.random() * ctx.days)
  const assigned = collectAssignedForDay(d, ctx)
  if (assigned.length < 2) return { score: currentScore, violations }

  const iA = assigned[Math.floor(Math.random() * assigned.length)]
  const iB = assigned[Math.floor(Math.random() * assigned.length)]
  if (iA === iB) return { score: currentScore, violations }

  const aIdA = ctx.state.schedule[gk(iA, d)]
  const aIdB = ctx.state.schedule[gk(iB, d)]
  if (aIdA === aIdB) return { score: currentScore, violations }

  return trySwap(ctx, d, iA, iB, aIdA, aIdB, currentScore, violations, temp)
}

function collectAssignedForDay(d: number, ctx: AlgoContext): number[] {
  const result: number[] = []
  for (let i = 0; i < ctx.N; i++) {
    if (ctx.state.schedule[gk(i, d)]) result.push(i)
  }
  return result
}

function trySwap(
  ctx: AlgoContext,
  d: number,
  iA: number,
  iB: number,
  aIdA: string,
  aIdB: string,
  currentScore: number,
  violations: number,
  temp: number,
): { score: number; violations: number } {
  unassign(iA, d, ctx)
  unassign(iB, d, ctx)
  const okA = assign(iA, d, aIdB, ctx)
  const okB = assign(iB, d, aIdA, ctx)

  if (!okA || !okB) {
    revertSwap(ctx, d, iA, iB, aIdA, aIdB, okA, okB)
    return { score: currentScore, violations }
  }

  const newV = countViolationsLocal(ctx)
  if (newV > violations) {
    revertSwap(ctx, d, iA, iB, aIdA, aIdB, true, true)
    return { score: currentScore, violations }
  }

  return acceptOrReject(ctx, d, iA, iB, aIdA, aIdB, currentScore, newV, temp)
}

function revertSwap(
  ctx: AlgoContext,
  d: number,
  iA: number,
  iB: number,
  aIdA: string,
  aIdB: string,
  okA: boolean,
  okB: boolean,
): void {
  if (okA) unassign(iA, d, ctx)
  if (okB) unassign(iB, d, ctx)
  assign(iA, d, aIdA, ctx)
  assign(iB, d, aIdB, ctx)
}

function acceptOrReject(
  ctx: AlgoContext,
  d: number,
  iA: number,
  iB: number,
  aIdA: string,
  aIdB: string,
  currentScore: number,
  newV: number,
  temp: number,
): { score: number; violations: number } {
  const newScore = softScore(ctx)
  const delta = newScore - currentScore

  if (delta >= 0 || Math.random() < Math.exp(delta / Math.max(temp, 0.1))) {
    return { score: newScore, violations: newV }
  }
  revertSwap(ctx, d, iA, iB, aIdA, aIdB, true, true)
  return { score: currentScore, violations: newV }
}

// ── Soft Score ──────────────────────────────────────────────

function softScore(ctx: AlgoContext): number {
  let score = 0
  for (let i = 0; i < ctx.N; i++) {
    if (ctx.targets[i] <= 0) continue
    score += softScoreResident(i, ctx)
  }
  score += softScoreKidemMix(ctx)
  return score
}

function softScoreResident(i: number, ctx: AlgoContext): number {
  let score = 0
  score += weekendDeviationScore(i, ctx)
  score += preferenceScore(i, ctx)
  score += gapDeviationScore(i, ctx)
  score += quotaDeviationScore(i, ctx)
  return score
}

function weekendDeviationScore(i: number, ctx: AlgoContext): number {
  const idealWe = Math.round(ctx.targets[i] * (7 / ctx.days)) || 0
  return -Math.abs((ctx.loads[i].weCount ?? 0) - idealWe) * 50
}

function preferenceScore(i: number, ctx: AlgoContext): number {
  let score = 0
  const tercA = getMonthlyPreferences(ctx.state.astProfiles, i, ctx.moKey)
  const tercH = getWeeklyPreferences(ctx.state.astProfiles, i)
  const kacA = getMonthlyAvoidances(ctx.state.astProfiles, i, ctx.moKey)
  const kacH = getWeeklyAvoidances(ctx.state.astProfiles, i)

  for (let d = 1; d <= ctx.days; d++) {
    if (!ctx.state.schedule[gk(i, d)]) continue
    if (tercA.includes(d)) score += 30
    if (tercH.includes(getDOW(ctx.y, ctx.m, d))) score += 10
    if (kacA.includes(d)) {
      score -= ctx.kacinmaGucu === 'sert' ? 120 : ctx.kacinmaGucu === 'guclu' ? 80 : 40
    }
    if (kacH.includes(getDOW(ctx.y, ctx.m, d))) score -= 20
  }
  return score
}

function gapDeviationScore(i: number, ctx: AlgoContext): number {
  const myDays = collectMyDays(i, ctx)
  if (myDays.length < 2) return 0
  const gaps: number[] = []
  for (let j = 1; j < myDays.length; j++) {
    gaps.push(myDays[j] - myDays[j - 1])
  }
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length
  const dev = Math.sqrt(gaps.reduce((s, g) => s + (g - avg) * (g - avg), 0) / gaps.length)
  return -dev * 20
}

function quotaDeviationScore(i: number, ctx: AlgoContext): number {
  let score = 0
  for (const aId of ctx.areaIds) {
    const kotaLimit = ctx.state.quota[aId]?.[ctx.residents[i].kidem] ?? 0
    if (kotaLimit <= 0) continue
    const mevcut = ctx.loads[i].byArea[aId] ?? 0
    score -= Math.abs(mevcut - kotaLimit) * 80
  }
  return score
}

function softScoreKidemMix(ctx: AlgoContext): number {
  let score = 0
  for (let d = 1; d <= ctx.days; d++) {
    for (const zone of ctx.zones) {
      score += softScoreDayZone(d, zone.id, ctx)
    }
  }
  return score
}

function softScoreDayZone(
  d: number,
  aId: string,
  ctx: AlgoContext,
): number {
  const atananlar = ctx.residents.filter(
    (_, j) => ctx.state.schedule[gk(j, d)] === aId,
  )
  if (atananlar.length <= 1) return 0

  let score = 0
  const kidemSayi: Record<number, number> = {}
  for (const a of atananlar) {
    kidemSayi[a.kidem] = (kidemSayi[a.kidem] ?? 0) + 1
  }
  for (const c of Object.values(kidemSayi)) {
    if (c > 1) score -= (c - 1) * 50
  }

  score += softScoreKidemMinMax(d, aId, atananlar, ctx)
  return score
}

function softScoreKidemMinMax(
  d: number,
  aId: string,
  atananlar: Resident[],
  ctx: AlgoContext,
): number {
  let score = 0
  const rule = getDayRule(ctx.state, d, aId)
  const kMinObj = rule.kidemMin ?? {}
  const kMaxObj = rule.kidemMax ?? {}

  for (const kk of Object.keys(kMinObj)) {
    const req = kMinObj[Number(kk)] ?? 0
    if (req <= 0) continue
    const cnt = atananlar.filter(a => a.kidem === Number(kk)).length
    if (cnt < req) score -= (req - cnt) * 200
  }
  for (const kk of Object.keys(kMaxObj)) {
    const req = kMaxObj[Number(kk)] ?? 0
    if (req <= 0) continue
    const cnt = atananlar.filter(a => a.kidem === Number(kk)).length
    if (cnt > req) score -= (cnt - req) * 300
  }
  return score
}

// ══════════════════════════════════════════════════════════════
// FAZ SON: HEDEF SINIRI — Kesin Clamp
// ══════════════════════════════════════════════════════════════

function runFinalClamp(ctx: AlgoContext): void {
  for (let i = 0; i < ctx.N; i++) {
    const fazla = ctx.loads[i].total - ctx.targets[i]
    if (fazla <= 0) continue
    clampResident(i, fazla, ctx)
  }
}

function clampResident(
  i: number,
  fazla: number,
  ctx: AlgoContext,
): void {
  const atamalar: { d: number; cost: number }[] = []
  for (let d = 1; d <= ctx.days; d++) {
    const aId = ctx.state.schedule[gk(i, d)]
    if (!aId) continue
    atamalar.push({ d, cost: clampCost(i, d, aId, ctx) })
  }
  atamalar.sort((a, b) => a.cost - b.cost)

  let kaldirilan = 0
  for (const at of atamalar) {
    if (kaldirilan >= fazla) break
    unassign(i, at.d, ctx)
    kaldirilan++
  }
}

function clampCost(
  i: number,
  d: number,
  aId: string,
  ctx: AlgoContext,
): number {
  const rule = getDayRule(ctx.state, d, aId)
  const cnt = getZoneCount(ctx.state.schedule, ctx.residents, d, aId)
  const kotaLimit = ctx.state.quota[aId]?.[ctx.residents[i].kidem] ?? 0
  const mevcut = ctx.loads[i].byArea[aId] ?? 0
  const kotaCost = kotaLimit > 0 && mevcut <= kotaLimit ? 500 : 0
  const minCost = cnt <= (rule.min ?? 0) ? 1000 : cnt <= (rule.min ?? 0) + 1 ? 100 : 0
  return minCost + kotaCost
}

// ══════════════════════════════════════════════════════════════
// LOG OLUŞTURMA
// ══════════════════════════════════════════════════════════════

function buildLog(ctx: AlgoContext): GenLog {
  const uyarilar = buildWarnings(ctx)
  const { hedefEksikler, hedefFazlalar } = buildTargetDiffs(ctx)
  return { uyarilar, hedefEksikler, hedefFazlalar }
}

function buildWarnings(ctx: AlgoContext): QuotaWarning[] {
  const uyarilar: QuotaWarning[] = []
  buildQuotaWarnings(ctx, uyarilar)
  buildEmptySlotWarnings(ctx, uyarilar)
  return uyarilar
}

function buildQuotaWarnings(
  ctx: AlgoContext,
  uyarilar: QuotaWarning[],
): void {
  for (const a of ctx.zones) {
    const defMin = ctx.state.defaultDayMin[a.id]
    if (!defMin || (defMin.min ?? 0) === 0) continue
    const minVal = defMin.min ?? 0
    let aktifGun = 0
    for (let d = 1; d <= ctx.days; d++) {
      if (!isZoneActive(ctx.state, d, a.id)) continue
      aktifGun++
    }
    const gereken = aktifGun * minVal
    const toplamKota = ctx.residents.reduce(
      (s, ast) => s + (ctx.state.quota[a.id]?.[ast.kidem] ?? 0), 0,
    )
    if (toplamKota < gereken) {
      uyarilar.push({
        tip: 'kota_yetersiz',
        alan: a.name,
        toplamKota, gereken,
        eksik: gereken - toplamKota,
        aktifGun, minVal,
      })
    }
  }
}

function buildEmptySlotWarnings(
  ctx: AlgoContext,
  uyarilar: QuotaWarning[],
): void {
  for (let d = 1; d <= ctx.days; d++) {
    for (const zone of ctx.zones) {
      if (!isZoneActive(ctx.state, d, zone.id)) continue
      const rule = getDayRule(ctx.state, d, zone.id)
      if (!rule.aktif) continue
      const cnt = getZoneCount(ctx.state.schedule, ctx.residents, d, zone.id)
      const eksik = (rule.min ?? 0) - cnt
      if (eksik > 0) {
        uyarilar.push({
          tip: 'slot_bos',
          alan: zone.name,
          gun: d,
          eksik,
          mesaj: 'Doldurulamamadı — müsait asistan yok (art arda/izin kısıtı)',
        })
      }
    }
  }
}

function buildTargetDiffs(ctx: AlgoContext): {
  hedefEksikler: { ast: string; eksik: number }[]
  hedefFazlalar: { ast: string; fazla: number }[]
} {
  const hedefEksikler: { ast: string; eksik: number }[] = []
  const hedefFazlalar: { ast: string; fazla: number }[] = []
  for (let i = 0; i < ctx.N; i++) {
    const h = ctx.targets[i]
    const t = ctx.loads[i].total
    if (t < h) hedefEksikler.push({ ast: ctx.residents[i].name, eksik: h - t })
    if (t > h) hedefFazlalar.push({ ast: ctx.residents[i].name, fazla: t - h })
  }
  return { hedefEksikler, hedefFazlalar }
}
