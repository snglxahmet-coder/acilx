// ══════════════════════════════════════════════════════════════
// ACİLX — Takas Store (Zustand)
// ══════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type { SwapRequest, SwapStatus } from '@/types/schedule'
import {
  createSwapRequest,
  updateSwapStatus,
  listSwaps,
  listPendingSwaps,
  getSwap,
  expireOldSwaps,
} from '@/services/swap-service'

// ── Store Interface ──────────────────────────────────────────

interface SwapStore {
  swaps: SwapRequest[]
  pendingSwaps: SwapRequest[]
  loading: boolean
  groupId: string

  setGroupId: (id: string) => void

  // Takas oluştur
  createSwap: (
    swap: Omit<SwapRequest, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<string | null>

  // Durum güncelle
  approveSwap: (swapId: string, resolvedBy: string) => Promise<void>
  rejectSwap: (
    swapId: string,
    status: 'rejected_by_target' | 'rejected_by_chief',
    resolvedBy: string,
  ) => Promise<void>
  cancelSwap: (swapId: string) => Promise<void>
  acceptByTarget: (swapId: string) => Promise<void>

  // Listeleme
  loadSwaps: (filters?: { status?: SwapStatus; requesterId?: number }) => Promise<void>
  loadPending: () => Promise<void>
  refreshSwap: (swapId: string) => Promise<void>

  // Bakım
  expireOld: () => Promise<number>
}

// ── Store ────────────────────────────────────────────────────

export const useSwapStore = create<SwapStore>((set, get) => ({
  swaps: [],
  pendingSwaps: [],
  loading: false,
  groupId: 'default',

  setGroupId: (id) => set({ groupId: id }),

  createSwap: async (swap) => {
    const { groupId } = get()
    set({ loading: true })
    try {
      const id = await createSwapRequest(groupId, swap)
      await get().loadPending()
      return id
    } catch (err) {
      console.error('Takas oluşturma hatası:', err)
      return null
    } finally {
      set({ loading: false })
    }
  },

  approveSwap: async (swapId, resolvedBy) => {
    const { groupId } = get()
    try {
      await updateSwapStatus(groupId, swapId, 'approved', resolvedBy)
      await get().loadPending()
    } catch (err) {
      console.error('Takas onay hatası:', err)
    }
  },

  rejectSwap: async (swapId, status, resolvedBy) => {
    const { groupId } = get()
    try {
      await updateSwapStatus(groupId, swapId, status, resolvedBy)
      await get().loadPending()
    } catch (err) {
      console.error('Takas red hatası:', err)
    }
  },

  cancelSwap: async (swapId) => {
    const { groupId } = get()
    try {
      await updateSwapStatus(groupId, swapId, 'cancelled')
      await get().loadPending()
    } catch (err) {
      console.error('Takas iptal hatası:', err)
    }
  },

  acceptByTarget: async (swapId) => {
    const { groupId } = get()
    try {
      await updateSwapStatus(groupId, swapId, 'pending_chief')
      await get().loadPending()
    } catch (err) {
      console.error('Takas kabul hatası:', err)
    }
  },

  loadSwaps: async (filters) => {
    const { groupId } = get()
    set({ loading: true })
    try {
      const swaps = await listSwaps(groupId, filters)
      set({ swaps, loading: false })
    } catch (err) {
      console.error('Takas listeleme hatası:', err)
      set({ loading: false })
    }
  },

  loadPending: async () => {
    const { groupId } = get()
    try {
      const pendingSwaps = await listPendingSwaps(groupId)
      set({ pendingSwaps })
    } catch (err) {
      console.error('Bekleyen takas hatası:', err)
    }
  },

  refreshSwap: async (swapId) => {
    const { groupId } = get()
    try {
      const swap = await getSwap(groupId, swapId)
      if (!swap) return
      set((s) => ({
        swaps: s.swaps.map((sw) => (sw.id === swapId ? swap : sw)),
        pendingSwaps: s.pendingSwaps.map((sw) => (sw.id === swapId ? swap : sw)),
      }))
    } catch (err) {
      console.error('Takas yenileme hatası:', err)
    }
  },

  expireOld: async () => {
    const { groupId } = get()
    try {
      const count = await expireOldSwaps(groupId)
      if (count > 0) await get().loadPending()
      return count
    } catch (err) {
      console.error('Takas temizleme hatası:', err)
      return 0
    }
  },
}))
