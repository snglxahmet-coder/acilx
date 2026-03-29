// ══════════════════════════════════════════════════════════════
// ACİLX — Admin Servisi
// Cloud Function çağrıları (httpsCallable)
// ══════════════════════════════════════════════════════════════

import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

// ── Nöbet listesinden içe aktarma ─────────────────────────────

interface ImportedResident {
  name: string
  pgy: number
}

interface ImportedZone {
  name: string
}

interface ImportResult {
  ok: boolean
  residents?: ImportedResident[]
  zones?: ImportedZone[]
  message?: string
}

export async function callImportFromSchedule(
  imageBase64: string,
  mimeType: string,
): Promise<ImportResult> {
  try {
    const fn = httpsCallable<
      { imageBase64: string; mimeType: string },
      { residents: ImportedResident[]; zones: ImportedZone[] }
    >(functions, 'importFromSchedule')
    const result = await fn({ imageBase64, mimeType })
    return { ok: true, residents: result.data.residents, zones: result.data.zones }
  } catch (err) {
    console.error('importFromSchedule hatası:', err)
    return { ok: false, message: String(err) }
  }
}

// ── Çizelge oluştur ───────────────────────────────────────────

interface GenerateResult {
  ok: boolean
  message?: string
}

export async function callGenerateSchedule(
  clinicId: string,
  year: number,
  month: number,
): Promise<GenerateResult> {
  try {
    const fn = httpsCallable<
      { clinicId: string; year: number; month: number },
      GenerateResult
    >(functions, 'generateSchedule')
    const result = await fn({ clinicId, year, month })
    return result.data
  } catch (err) {
    console.error('generateSchedule hatası:', err)
    return { ok: false, message: String(err) }
  }
}

// ── Tercih dönemi aç/kapa ─────────────────────────────────────

export async function callOpenPreferencePeriod(
  clinicId: string,
  year: number,
  month: number,
): Promise<{ ok: boolean }> {
  try {
    const fn = httpsCallable(functions, 'openPreferencePeriod')
    const result = await fn({ clinicId, year, month })
    return result.data as { ok: boolean }
  } catch (err) {
    console.error('openPreferencePeriod hatası:', err)
    return { ok: false }
  }
}

export async function callClosePreferencePeriod(
  clinicId: string,
): Promise<{ ok: boolean }> {
  try {
    const fn = httpsCallable(functions, 'closePreferencePeriod')
    const result = await fn({ clinicId })
    return result.data as { ok: boolean }
  } catch (err) {
    console.error('closePreferencePeriod hatası:', err)
    return { ok: false }
  }
}

// ── Çizelge yayınla ──────────────────────────────────────────

// ── Otomatik eşleştirme ─────────────────────────────────────

interface AutoMatchResult {
  ok: boolean
  clinicName?: string
  message?: string
}

interface AutoMatchCFResponse {
  matched: boolean
  clinicId?: string
  clinicName?: string
}

export async function callAutoMatchResident(): Promise<AutoMatchResult> {
  try {
    const fn = httpsCallable<void, AutoMatchCFResponse>(functions, 'autoMatchResident')
    const result = await fn()
    const data = result.data
    return { ok: data.matched, clinicName: data.clinicName }
  } catch (err) {
    console.error('autoMatchResident hatası:', err)
    return { ok: false, message: String(err) }
  }
}

// ── Klinik kodu ile katılım ─────────────────────────────────

interface JoinClinicResult {
  ok: boolean
  clinicName?: string
  message?: string
}

interface JoinClinicCFResponse {
  clinicId: string
  clinicName: string
  residentName: string
}

export async function callJoinClinicByCode(
  hospitalCode: string,
  residentCode: string,
): Promise<JoinClinicResult> {
  try {
    const fn = httpsCallable<
      { hospitalCode: string; residentCode: string },
      JoinClinicCFResponse
    >(functions, 'joinClinic')
    const result = await fn({ hospitalCode, residentCode })
    const data = result.data
    return { ok: true, clinicName: data.clinicName }
  } catch (err) {
    console.error('joinClinic hatası:', err)
    return { ok: false, message: String(err) }
  }
}

// ── Klinik sil ──────────────────────────────────────────────

export async function callDeleteClinic(
  clinicId: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const fn = httpsCallable<{ clinicId: string }, { ok: boolean; clinicId: string }>(
      functions, 'deleteClinic',
    )
    await fn({ clinicId })
    return { ok: true }
  } catch (err) {
    console.error('deleteClinic hatası:', err)
    return { ok: false, message: String(err) }
  }
}

// ── Çizelge yayınla ──────────────────────────────────────────

export async function callPublishSchedule(
  clinicId: string,
  year: number,
  month: number,
): Promise<{ ok: boolean }> {
  try {
    const fn = httpsCallable(functions, 'publishSchedule')
    const result = await fn({ clinicId, year, month })
    return result.data as { ok: boolean }
  } catch (err) {
    console.error('publishSchedule hatası:', err)
    return { ok: false }
  }
}
