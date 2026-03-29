// ══════════════════════════════════════════════════════════════
// ACİLX — Takas Firestore Servisi
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
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SwapRequest, SwapStatus } from '@/types/schedule'

// ── Referanslar ──────────────────────────────────────────────

function swapsCollection(groupId: string) {
  return collection(db, 'groups', groupId, 'swaps')
}

function swapRef(groupId: string, swapId: string) {
  return doc(db, 'groups', groupId, 'swaps', swapId)
}

// ── Takas Oluştur ────────────────────────────────────────────

export async function createSwapRequest(
  groupId: string,
  swap: Omit<SwapRequest, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const id = `swap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    await setDoc(swapRef(groupId, id), {
      ...swap,
      id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return id
  } catch (err) {
    console.error('Takas oluşturma hatası:', err)
    throw err
  }
}

// ── Takas Durumu Güncelle ────────────────────────────────────

export async function updateSwapStatus(
  groupId: string,
  swapId: string,
  status: SwapStatus,
  resolvedBy?: string,
): Promise<void> {
  try {
    await updateDoc(swapRef(groupId, swapId), {
      status,
      resolvedBy: resolvedBy ?? null,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('Takas güncelleme hatası:', err)
    throw err
  }
}

// ── Takasları Listele ────────────────────────────────────────

export async function listSwaps(
  groupId: string,
  filters?: { status?: SwapStatus; requesterId?: number },
): Promise<SwapRequest[]> {
  try {
    const constraints = []
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status))
    }
    if (filters?.requesterId !== undefined) {
      constraints.push(where('requesterId', '==', filters.requesterId))
    }

    const q = query(swapsCollection(groupId), ...constraints)
    const snap = await getDocs(q)

    return snap.docs.map(d => {
      const data = d.data()
      return {
        ...data,
        id: d.id,
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      } as SwapRequest
    })
  } catch (err) {
    console.error('Takas listeleme hatası:', err)
    return []
  }
}

// ── Tekil Takas Yükle ────────────────────────────────────────

export async function getSwap(
  groupId: string,
  swapId: string,
): Promise<SwapRequest | null> {
  try {
    const snap = await getDoc(swapRef(groupId, swapId))
    if (!snap.exists()) return null

    const data = snap.data()
    return {
      ...data,
      id: snap.id,
      createdAt: formatTimestamp(data.createdAt),
      updatedAt: formatTimestamp(data.updatedAt),
    } as SwapRequest
  } catch (err) {
    console.error('Takas okuma hatası:', err)
    return null
  }
}

// ── Bekleyen Takasları Listele ───────────────────────────────

export async function listPendingSwaps(
  groupId: string,
): Promise<SwapRequest[]> {
  try {
    const q1 = query(
      swapsCollection(groupId),
      where('status', '==', 'pending_target'),
    )
    const q2 = query(
      swapsCollection(groupId),
      where('status', '==', 'pending_chief'),
    )

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])
    const results: SwapRequest[] = []

    for (const snap of [snap1, snap2]) {
      for (const d of snap.docs) {
        const data = d.data()
        results.push({
          ...data,
          id: d.id,
          createdAt: formatTimestamp(data.createdAt),
          updatedAt: formatTimestamp(data.updatedAt),
        } as SwapRequest)
      }
    }
    return results
  } catch (err) {
    console.error('Bekleyen takas listeleme hatası:', err)
    return []
  }
}

// ── Süresi Dolan Takasları Temizle ───────────────────────────

export async function expireOldSwaps(
  groupId: string,
  timeoutMs = 48 * 60 * 60 * 1000,
): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - timeoutMs)
    const q = query(
      swapsCollection(groupId),
      where('status', 'in', ['pending_target', 'pending_chief']),
    )
    const snap = await getDocs(q)
    let expired = 0

    for (const d of snap.docs) {
      const data = d.data()
      const created = data.createdAt as Timestamp
      if (created && created.toDate() < cutoff) {
        await updateDoc(d.ref, {
          status: 'expired',
          updatedAt: serverTimestamp(),
        })
        expired++
      }
    }
    return expired
  } catch (err) {
    console.error('Takas temizleme hatası:', err)
    return 0
  }
}

// ── Yardımcılar ──────────────────────────────────────────────

function formatTimestamp(ts: unknown): string {
  if (!ts) return new Date().toISOString()
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  if (typeof ts === 'string') return ts
  return new Date().toISOString()
}
