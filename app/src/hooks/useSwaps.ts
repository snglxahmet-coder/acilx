// ══════════════════════════════════════════════════════════════
// ACİLX — useSwaps Hook
// Takas oluşturma, onay/red işlemleri
// ══════════════════════════════════════════════════════════════

import { useCallback, useMemo } from 'react'
import { useSwapStore } from '@/stores/swap-store'
import { useScheduleStore } from '@/stores/schedule-store'
import { checkSwapEligibility } from '@/lib/schedule-analysis'
import type { SwapRequest } from '@/types/schedule'

// ── Takas payload oluşturma (hook dışı) ──

interface SwapParams {
  requesterId: number
  requesterDay: number
  requesterZone: string
  targetId: number
  targetDay: number
  targetZone: string
  type: SwapRequest['type']
}

function buildSwapPayload(p: SwapParams) {
  return {
    requesterId: p.requesterId,
    requesterDay: p.requesterDay,
    requesterZone: p.requesterZone,
    targetId: p.targetId,
    targetDay: p.targetDay,
    targetZone: p.targetZone,
    status: 'pending_target' as const,
    type: p.type,
    resolvedBy: undefined,
  }
}

// ── Hook ──

export function useSwaps() {
  const swapStore = useSwapStore()
  const { state, residents } = useScheduleStore()

  const requestSwap = useCallback(
    async (p: SwapParams) => {
      const elig = checkSwapEligibility(
        state, residents,
        p.requesterId, p.requesterDay, p.requesterZone,
        p.targetId, p.targetDay, p.targetZone,
      )
      if (!elig.ok) return { ok: false, reason: elig.reason }
      const id = await swapStore.createSwap(buildSwapPayload(p))
      return { ok: !!id, swapId: id }
    },
    [swapStore, state, residents],
  )

  const approve = useCallback(
    (swapId: string, userId: string) =>
      swapStore.approveSwap(swapId, userId),
    [swapStore],
  )

  const reject = useCallback(
    (swapId: string, status: 'rejected_by_target' | 'rejected_by_chief', userId: string) =>
      swapStore.rejectSwap(swapId, status, userId),
    [swapStore],
  )

  const cancel = useCallback(
    (swapId: string) => swapStore.cancelSwap(swapId),
    [swapStore],
  )

  const acceptByTarget = useCallback(
    (swapId: string) => swapStore.acceptByTarget(swapId),
    [swapStore],
  )

  const pendingForMe = useCallback(
    (myIdx: number) =>
      swapStore.pendingSwaps.filter(
        (s) => s.targetId === myIdx && s.status === 'pending_target',
      ),
    [swapStore.pendingSwaps],
  )

  const pendingForChief = useMemo(
    () => swapStore.pendingSwaps.filter((s) => s.status === 'pending_chief'),
    [swapStore.pendingSwaps],
  )

  return {
    swaps: swapStore.swaps,
    pendingSwaps: swapStore.pendingSwaps,
    loading: swapStore.loading,
    requestSwap,
    approve,
    reject,
    cancel,
    acceptByTarget,
    pendingForMe,
    pendingForChief,
    loadSwaps: swapStore.loadSwaps,
    loadPending: swapStore.loadPending,
    expireOld: swapStore.expireOld,
  }
}
