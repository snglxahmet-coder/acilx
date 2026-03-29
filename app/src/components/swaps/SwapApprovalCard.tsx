import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, Check, X } from 'lucide-react'
import type { SwapRequest, Resident, Zone } from '@/types/schedule'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending_target: { label: 'Hedef Onayı Bekleniyor', variant: 'secondary' },
  pending_chief: { label: 'Başasistan Onayı', variant: 'outline' },
  approved: { label: 'Onaylandı', variant: 'default' },
  rejected_by_target: { label: 'Hedef Reddetti', variant: 'destructive' },
  rejected_by_chief: { label: 'Başasistan Reddetti', variant: 'destructive' },
  cancelled: { label: 'İptal', variant: 'destructive' },
  expired: { label: 'Süresi Doldu', variant: 'destructive' },
}

interface SwapApprovalCardProps {
  swap: SwapRequest
  residents: Resident[]
  zones: Zone[]
  onApprove: (swapId: string) => void
  onReject: (swapId: string) => void
}

export default function SwapApprovalCard({
  swap,
  residents,
  zones,
  onApprove,
  onReject,
}: SwapApprovalCardProps) {
  const status = STATUS_MAP[swap.status] ?? { label: swap.status, variant: 'secondary' as const }
  const requester = residents[swap.requesterId]
  const target = residents[swap.targetId]
  const reqZone = zones.find((z) => z.id === swap.requesterZone)
  const tgtZone = zones.find((z) => z.id === swap.targetZone)

  const isPending = swap.status === 'pending_chief'

  return (
    <Card size="sm" className={isPending ? 'border-primary/20' : 'opacity-70'}>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <Badge variant={status.variant} className="text-[10px]">
            {status.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {swap.createdAt ? new Date(swap.createdAt).toLocaleDateString('tr-TR') : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <SwapSide
            name={requester?.name ?? `#${swap.requesterId}`}
            day={swap.requesterDay}
            zone={reqZone}
          />
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <SwapSide
            name={target?.name ?? `#${swap.targetId}`}
            day={swap.targetDay}
            zone={tgtZone}
          />
        </div>

        {isPending && (
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-green-400 border-green-800 hover:bg-green-900/30"
              onClick={() => onApprove(swap.id)}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Onayla
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-red-400 border-red-800 hover:bg-red-900/30"
              onClick={() => onReject(swap.id)}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Reddet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SwapSide({
  name,
  day,
  zone,
}: {
  name: string
  day: number
  zone?: Zone
}) {
  return (
    <div className="flex-1 rounded-md bg-muted/50 p-2 min-w-0">
      <p className="text-[11px] font-semibold truncate">{name}</p>
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[10px] text-muted-foreground">{day}.</span>
        {zone && (
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0"
            style={{ borderColor: zone.color, color: zone.color }}
          >
            {zone.name}
          </Badge>
        )}
      </div>
    </div>
  )
}
