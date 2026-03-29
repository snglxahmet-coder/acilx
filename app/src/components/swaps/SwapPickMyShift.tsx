// ══════════════════════════════════════════════════════════════
// ACİLX — SwapPickMyShift
// Başkasının nöbetiyle takas: "Hangi nöbetinle takas etmek istersin?"
// ══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeftRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useScheduleStore } from '@/stores/schedule-store'
import { useSwapStore } from '@/stores/swap-store'
import { checkSwapEligibility } from '@/lib/schedule-analysis'
import { gk } from '@/lib/schedule-helpers'
import { MONTH_NAMES } from '@/components/schedule/schedule-ui-types'
import type { SwapRequest } from '@/types/schedule'

interface SwapPickMyShiftProps {
  open: boolean
  onClose: () => void
  myIdx: number
  targetIdx: number
  targetDay: number
  targetZoneId: string
  year: number
  month: number
}

interface MyShiftOption {
  day: number
  zoneId: string
  zoneName: string
  zoneColor: string
}

export default function SwapPickMyShift({
  open,
  onClose,
  myIdx,
  targetIdx,
  targetDay,
  targetZoneId,
  year,
  month,
}: SwapPickMyShiftProps) {
  const { state, residents, zones } = useScheduleStore()
  const { createSwap, loading: swapLoading } = useSwapStore()
  const [sentId, setSentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const myShifts = useMemo(() => {
    if (!open || myIdx < 0) return []

    const result: MyShiftOption[] = []

    for (let d = 1; d <= daysInMonth; d++) {
      const zoneA = state.schedule[gk(myIdx, d)]
      if (!zoneA) continue

      const elig = checkSwapEligibility(
        state,
        residents,
        myIdx,
        d,
        zoneA,
        targetIdx,
        targetDay,
        targetZoneId,
      )

      if (elig.ok) {
        const zone = zones.find((z) => z.id === zoneA)
        result.push({
          day: d,
          zoneId: zoneA,
          zoneName: zone?.name ?? zoneA,
          zoneColor: zone?.color ?? '#888',
        })
      }
    }

    return result
  }, [open, myIdx, targetIdx, targetDay, targetZoneId, state, residents, zones, daysInMonth])

  async function handleSend(shift: MyShiftOption) {
    setError(null)
    setSentId(null)

    try {
      const swap: Omit<SwapRequest, 'id' | 'createdAt' | 'updatedAt'> = {
        requesterId: myIdx,
        requesterDay: shift.day,
        requesterZone: shift.zoneId,
        targetId: targetIdx,
        targetDay,
        targetZone: targetZoneId,
        status: 'pending_target',
        type: shift.day === targetDay ? 'same_day' : 'different_day',
      }

      const id = await createSwap(swap)
      if (id) {
        setSentId(id)
      } else {
        setError('Takas talebi gönderilemedi.')
      }
    } catch {
      setError('Takas talebi gönderilemedi.')
    }
  }

  function handleClose() {
    setSentId(null)
    setError(null)
    onClose()
  }

  const targetName = residents[targetIdx]?.name ?? '?'
  const targetZone = zones.find((z) => z.id === targetZoneId)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm">Hangi nöbetinle takas?</SheetTitle>
        </SheetHeader>

        <div className="mt-2 px-1">
          <p className="text-xs text-muted-foreground">
            Hedef: <span className="font-semibold">{targetName}</span> —{' '}
            {targetDay} {MONTH_NAMES[month]},{' '}
            <span style={{ color: targetZone?.color }}>
              {targetZone?.name ?? targetZoneId}
            </span>
          </p>
        </div>

        {sentId && (
          <div className="mt-3 mx-1 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            <p className="text-xs text-green-400">
              Takas talebi gönderildi!
            </p>
          </div>
        )}

        {error && (
          <div className="mt-3 mx-1 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-4 px-1 pb-4">
          {myShifts.length === 0 ? (
            <div className="text-center py-6">
              <ArrowLeftRight className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Bu nöbetle takas yapabileceğin uygun nöbetin yok.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-1">
                Takas edilebilir {myShifts.length} nöbetin var
              </p>
              {myShifts.map((s) => (
                <div
                  key={s.day}
                  className="rounded-lg bg-muted/50 p-3 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{s.day}. gün</span>
                    <Badge
                      className="text-[9px] px-1.5 py-0 text-white"
                      style={{ background: s.zoneColor }}
                    >
                      {s.zoneName}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={swapLoading || !!sentId}
                    onClick={() => handleSend(s)}
                  >
                    {swapLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Seç'
                    )}
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
