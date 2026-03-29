// ══════════════════════════════════════════════════════════════
// ACİLX — SwapMatchSheet
// Kendi nöbetimden takas: uygun eşleşmeleri listele
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
import { shortName, MONTH_NAMES } from '@/components/schedule/schedule-ui-types'
import type { SwapRequest } from '@/types/schedule'

interface SwapMatchSheetProps {
  open: boolean
  onClose: () => void
  requesterIdx: number
  requesterDay: number
  requesterZoneId: string
  year: number
  month: number
}

interface MatchItem {
  targetIdx: number
  targetDay: number
  targetZoneId: string
  targetName: string
  targetSeniority: number
  zoneName: string
  zoneColor: string
}

export default function SwapMatchSheet({
  open,
  onClose,
  requesterIdx,
  requesterDay,
  requesterZoneId,
  year,
  month,
}: SwapMatchSheetProps) {
  const { state, residents, zones } = useScheduleStore()
  const { createSwap, loading: swapLoading } = useSwapStore()
  const [sentId, setSentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const matches = useMemo(() => {
    if (!open || requesterIdx < 0) return []

    const result: MatchItem[] = []

    for (let iB = 0; iB < residents.length; iB++) {
      if (iB === requesterIdx) continue

      for (let dB = 1; dB <= daysInMonth; dB++) {
        const zoneB = state.schedule[gk(iB, dB)]
        if (!zoneB) continue

        const elig = checkSwapEligibility(
          state,
          residents,
          requesterIdx,
          requesterDay,
          requesterZoneId,
          iB,
          dB,
          zoneB,
        )

        if (elig.ok) {
          const zone = zones.find((z) => z.id === zoneB)
          result.push({
            targetIdx: iB,
            targetDay: dB,
            targetZoneId: zoneB,
            targetName: residents[iB].name,
            targetSeniority: residents[iB].kidem,
            zoneName: zone?.name ?? zoneB,
            zoneColor: zone?.color ?? '#888',
          })
        }
      }
    }

    return result
  }, [open, requesterIdx, requesterDay, requesterZoneId, state, residents, zones, daysInMonth])

  async function handleSendSwap(match: MatchItem) {
    setError(null)
    setSentId(null)

    try {
      const swap: Omit<SwapRequest, 'id' | 'createdAt' | 'updatedAt'> = {
        requesterId: requesterIdx,
        requesterDay,
        requesterZone: requesterZoneId,
        targetId: match.targetIdx,
        targetDay: match.targetDay,
        targetZone: match.targetZoneId,
        status: 'pending_target',
        type: requesterDay === match.targetDay ? 'same_day' : 'different_day',
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

  const reqZone = zones.find((z) => z.id === requesterZoneId)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm">
            Takas Eşleşmeleri — {requesterDay} {MONTH_NAMES[month]}
          </SheetTitle>
        </SheetHeader>

        {/* Mevcut nöbet bilgisi */}
        <div className="mt-2 px-1">
          <p className="text-xs text-muted-foreground">
            Senin nöbetin:{' '}
            <span className="font-semibold" style={{ color: reqZone?.color }}>
              {reqZone?.name ?? requesterZoneId}
            </span>
          </p>
        </div>

        {/* Başarı mesajı */}
        {sentId && (
          <div className="mt-3 mx-1 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            <p className="text-xs text-green-400">
              Takas talebi gönderildi! Karşı tarafın onayı bekleniyor.
            </p>
          </div>
        )}

        {/* Hata mesajı */}
        {error && (
          <div className="mt-3 mx-1 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Eşleşme listesi */}
        <div className="flex flex-col gap-2 mt-4 px-1 pb-4">
          {matches.length === 0 ? (
            <div className="text-center py-6">
              <ArrowLeftRight className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Kurallara uygun takas bulunamadı.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Art arda nöbet, izin ve kıdem kuralları kontrol edildi.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-1">
                {matches.length} uygun eşleşme bulundu
              </p>
              {matches.map((m) => (
                <MatchCard
                  key={`${m.targetIdx}_${m.targetDay}`}
                  match={m}
                  loading={swapLoading}
                  disabled={!!sentId}
                  onSend={() => handleSendSwap(m)}
                />
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MatchCard({
  match,
  loading,
  disabled,
  onSend,
}: {
  match: MatchItem
  loading: boolean
  disabled: boolean
  onSend: () => void
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Badge variant="outline" className="text-[9px] px-1 py-0">
            K{match.targetSeniority}
          </Badge>
          <span className="text-sm font-semibold truncate">
            {shortName(match.targetName)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{match.targetDay}. gün</span>
          <span>·</span>
          <span
            className="font-medium"
            style={{ color: match.zoneColor }}
          >
            {match.zoneName}
          </span>
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        disabled={loading || disabled}
        onClick={onSend}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
            Takas İste
          </>
        )}
      </Button>
    </div>
  )
}
