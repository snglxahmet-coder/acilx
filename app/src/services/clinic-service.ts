// ══════════════════════════════════════════════════════════════
// ACİLX — Klinik Servisi
// Klinik CRUD, üyelik ve onay işlemleri
// ══════════════════════════════════════════════════════════════

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type ShiftType = '24h' | '12-12' | '8-8-8'

export interface Clinic {
  id: string
  name: string
  hospitalName: string
  /** @deprecated Tek seçim yerine shiftTypes kullan */
  shiftModel?: ShiftType
  /** Birden fazla vardiya tipi desteklenir */
  shiftTypes: ShiftType[]
  status: 'active' | 'pending'
  hospitalCode: string
  createdBy: string
  createdAt: string
}

// ── Klinik oluştur ────────────────────────────────────────────

export async function createClinic(data: {
  name: string
  shiftTypes: ShiftType[]
  createdBy: string
}): Promise<Clinic> {
  const id = `clinic_${Date.now()}`
  const hospitalCode = generateCode(6)

  const clinic: Clinic = {
    id,
    name: data.name,
    hospitalName: '',
    shiftTypes: data.shiftTypes.length > 0 ? data.shiftTypes : ['24h'],
    status: 'active',
    hospitalCode,
    createdBy: data.createdBy,
    createdAt: new Date().toISOString(),
  }

  await setDoc(doc(db, 'clinics', id), {
    ...clinic,
    _createdAt: serverTimestamp(),
  })

  return clinic
}

// ── Klinik listesi ────────────────────────────────────────────

export async function listClinics(): Promise<Clinic[]> {
  const snap = await getDocs(collection(db, 'clinics'))
  return snap.docs.map((d) => d.data() as Clinic)
}

export async function listMyClinics(userId: string): Promise<Clinic[]> {
  const q = query(
    collection(db, 'clinics'),
    where('createdBy', '==', userId),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as Clinic)
}

// ── Bekleyen klinikler ────────────────────────────────────────

export async function listPendingClinics(): Promise<Clinic[]> {
  const q = query(
    collection(db, 'clinics'),
    where('status', '==', 'pending'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as Clinic)
}

export async function approveClinic(clinicId: string): Promise<void> {
  await updateDoc(doc(db, 'clinics', clinicId), {
    status: 'active',
    _approvedAt: serverTimestamp(),
  })
}

// ── Klinik detayı ─────────────────────────────────────────────

export async function getClinic(clinicId: string): Promise<Clinic | null> {
  const snap = await getDoc(doc(db, 'clinics', clinicId))
  return snap.exists() ? (snap.data() as Clinic) : null
}

// ── Yardımcı ──────────────────────────────────────────────────

function generateCode(len: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < len; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
