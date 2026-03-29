// ══════════════════════════════════════════════════════════════
// ACİLX — Nöbet Modülü Tip Tanımları
// Firestore veri yapısıyla birebir uyumlu
// ══════════════════════════════════════════════════════════════

/** Kıdem seviyesi (PGY 1-5) */
export type Seniority = 1 | 2 | 3 | 4 | 5

/** Vardiya tipi */
export type ShiftType = '24h' | '08-20' | '20-08' | '08-16' | '16-24' | '00-08'

/** Asistan durumu */
export type ResidentStatus = 'aktif' | 'izinli' | 'rot_evet' | 'rot_hayir'

/** Kaçınma gücü */
export type AvoidanceStrength = 'sert' | 'guclu' | 'yumusak'

/** Tercih çakışma stratejisi */
export type PreferenceConflict = 'azTercih' | 'kidemOnce' | 'adaletli' | 'karma'

/** Hafta sonu denge stratejisi */
export type WeekendBalance = 'oranEsit' | 'toplamEsit' | 'yok'

/** İzin hedef modu */
export type LeaveTargetMode = 'otoDus' | 'sabit' | 'otoDusManuel'

// ── Asistan ──────────────────────────────────────────────────

export interface Resident {
  id: number
  name: string
  kidem: Seniority
}

// ── Alan (Zone) ──────────────────────────────────────────────

export interface Zone {
  id: string
  name: string
  color: string
}

// ── Kıdem Kuralı ─────────────────────────────────────────────

export interface SeniorityRule {
  yalnizTutamaz: boolean
  yanindaKidemler?: Seniority[]
  enAzKac?: number
}

export interface SeniorityGroupRule {
  kidemler: Seniority[]
  enAzKac: number
  enFazlaKac: number
}

// ── Alan Gün Kuralı ──────────────────────────────────────────

export interface DayRule {
  min: number
  max: number
  aktif?: boolean
  kidemMin?: Record<number, number>
  kidemMax?: Record<number, number>
  kidemKurallari?: Record<number, SeniorityRule>
  kidemGrupKurallari?: SeniorityGroupRule[]
  siftler?: ShiftType[]
}

// ── Asistan Profili ──────────────────────────────────────────

export interface ResidentProfile {
  durum: ResidentStatus
  sift?: ShiftType
  siftler?: ShiftType[]
  tercihGunler?: number[]       // 0=Pzt..6=Paz (haftalık)
  kacGunler?: number[]          // haftalık kaçınma
  tercihGunlerAylik?: number[]  // bu ayın tercihleri (gün numaraları)
  kacGunlerAylik?: number[]     // bu ayın kaçınmaları
  tercihAylik?: Record<string, number[]>  // moKey → günler
  kacAylik?: Record<string, number[]>     // moKey → günler
  izinliAylik?: Record<string, number[]>  // moKey → izinli günler
}

// ── Algoritma Konfigürasyonu ─────────────────────────────────

export interface AlgoConfig {
  artArdaMesafe: number
  kacinmaGucu: AvoidanceStrength
  tercihCakisma: PreferenceConflict
  weDengesi: WeekendBalance
  izinHedef: LeaveTargetMode
  alanOncelikleri: string[] | null
}

// ── Çizelge State — localStorage + Firestore ─────────────────

export interface ScheduleState {
  schedule: Record<string, string>         // "astIdx_day" → alanId
  defaultDayMin: Record<string, DayRule>   // alanId → kural
  minNobet: Record<string, Record<number, number>>  // alanId → {kidem: min}
  quota: Record<string, Record<number, number>>      // alanId → {kidem: kota}
  maxHours: Record<number, number>         // kidem → max saat
  dayOverride: Record<number, Record<string, DayRule>>  // gün → {alanId → kural}
  monthOverride: Record<string, Record<number, number>> // moKey → {astIdx: hedef}
  kapaliGunler: Record<string, number[]>   // "moKey_alanId" → günler
  prevMonthLastDay: Record<number, string> // astIdx → alanId
  nextMonthFirstDay: Record<number, string>
  currentDate: { y: number; m: number }
  listName: string
  astProfiles: Record<number, ResidentProfile>
  algoConfig: AlgoConfig
}

// ── Takas (Swap) ─────────────────────────────────────────────

export type SwapStatus =
  | 'pending_target'
  | 'rejected_by_target'
  | 'pending_chief'
  | 'rejected_by_chief'
  | 'approved'
  | 'cancelled'
  | 'expired'

export interface SwapRequest {
  id: string
  requesterId: number        // isteyen asistan idx
  requesterDay: number
  requesterZone: string      // alan id
  targetId: number           // hedef asistan idx
  targetDay: number
  targetZone: string
  status: SwapStatus
  createdAt: string
  updatedAt: string
  resolvedBy?: string
  type: 'same_day' | 'different_day' | 'move'
}

// ── İhlal (Violation) ────────────────────────────────────────

export type ViolationType = 'min' | 'max' | 'kidem' | 'kidemMin' | 'kidemMax' | 'grup' | 'grupMax'

export interface Violation {
  tip: ViolationType
  alan: Zone
  msg: string
  kidem?: Seniority
  yanindaKidemler?: Seniority[]
  enAzKac?: number
  kidemler?: Seniority[]
}

// ── Öneri (Suggestion) ───────────────────────────────────────

export type SuggestionType = 'ekle' | 'cikar' | 'transfer' | 'takas'

export interface Suggestion {
  tip: SuggestionType
  iA: number
  d: number
  aId: string
  dB?: number
  alanB?: string
  iB?: number
  onayMesaji?: string
}

// ── Asistan Yük İzleme ───────────────────────────────────────

export interface ResidentLoad {
  total: number
  byArea: Record<string, number>
  weCount: number
}

// ── Analiz Sonuçları ─────────────────────────────────────────

export interface GenLog {
  uyarilar: QuotaWarning[]
  hedefEksikler: { ast: string; eksik: number }[]
  hedefFazlalar: { ast: string; fazla: number }[]
}

export interface QuotaWarning {
  tip: string
  alan?: string
  toplamKota?: number
  gereken?: number
  eksik?: number
  aktifGun?: number
  minVal?: number
  gun?: number
  mesaj?: string
}

// ── Tercih Dönemi ────────────────────────────────────────────

export interface PreferencePeriod {
  active: boolean
  year: number
  month: number
  maxPositive?: number
  maxNegative?: number
  openedAt?: string
  closedAt?: string
}

export interface PreferenceEntry {
  uid: string
  tercihGunlerAylik: number[]
  kacGunlerAylik: number[]
  durum: ResidentStatus
  updatedAt?: string
}

// ── Takas Uygunluk ───────────────────────────────────────────

export interface SwapEligibility {
  ok: boolean
  reason?: string
}

export interface SwapOption {
  iB: number
  dB: number
  alanB: string
  astB: Resident
  alanBObj?: Zone
  tip: 'ayniGun' | 'farkliGun'
  tercihA: boolean
  kacA: boolean
  kacBKurt: boolean
}

export interface MoveOption {
  dT: number
  alan: Zone
  doluluk: number
  max: number
  tercihA: boolean
  kacA: boolean
  kacKurt: boolean
}
