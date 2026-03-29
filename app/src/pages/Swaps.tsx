import { useEffect, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSwaps } from '@/hooks/useSwaps'
import { useSwapStore } from '@/stores/swap-store'
import { useScheduleStore } from '@/stores/schedule-store'
import { useAuthStore } from '@/stores/auth-store'
import SwapApprovalCard from '@/components/swaps/SwapApprovalCard'

export default function Swaps() {
  const {
    pendingSwaps,
    swaps,
    loading,
    approve,
    reject,
    loadPending,
    expireOld,
  } = useSwaps()

  const { residents, zones } = useScheduleStore()
  const { user, profile } = useAuthStore()
  const { setGroupId } = useSwapStore()

  useEffect(() => {
    if (!profile?.clinicId) return
    setGroupId(profile.clinicId)
    loadPending()
    expireOld()
  }, [profile?.clinicId, setGroupId, loadPending, expireOld])

  const pendingChief = useMemo(
    () => pendingSwaps.filter((s) => s.status === 'pending_chief'),
    [pendingSwaps],
  )

  const pastSwaps = useMemo(
    () =>
      swaps.filter(
        (s) =>
          s.status === 'approved' ||
          s.status === 'rejected_by_chief' ||
          s.status === 'rejected_by_target' ||
          s.status === 'cancelled' ||
          s.status === 'expired',
      ),
    [swaps],
  )

  function handleApprove(swapId: string) {
    if (user?.uid) approve(swapId, user.uid)
  }

  function handleReject(swapId: string) {
    if (user?.uid) reject(swapId, 'rejected_by_chief', user.uid)
  }

  return (
    <div className="p-4 pb-20 max-w-md mx-auto space-y-4">
      <h1 className="text-lg font-bold">Takas Yönetimi</h1>

      <Tabs defaultValue="pending">
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="flex-1">
            Bekleyen ({pendingChief.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="flex-1">
            Geçmiş ({pastSwaps.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-3 space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Yükleniyor...
            </p>
          ) : pendingChief.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Onay bekleyen takas talebi yok.
            </p>
          ) : (
            pendingChief.map((swap) => (
              <SwapApprovalCard
                key={swap.id}
                swap={swap}
                residents={residents}
                zones={zones}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-3 space-y-2">
          {pastSwaps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Geçmiş takas kaydı yok.
            </p>
          ) : (
            pastSwaps.map((swap) => (
              <SwapApprovalCard
                key={swap.id}
                swap={swap}
                residents={residents}
                zones={zones}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
