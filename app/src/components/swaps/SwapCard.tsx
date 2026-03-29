import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { shortName } from '@/components/schedule/schedule-ui-types'

interface SwapRequest {
  id: string
  fromResident: { uid: string; name: string; seniority: number }
  toResident: { uid: string; name: string; seniority: number }
  fromDay: number
  toDay: number
  fromZone: { id: string; name: string; color: string }
  toZone: { id: string; name: string; color: string }
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

const STATUS_MAP = {
  pending: { label: 'Bekliyor', variant: 'secondary' as const },
  accepted: { label: 'Onaylandı', variant: 'default' as const },
  rejected: { label: 'Reddedildi', variant: 'destructive' as const },
}

interface SwapCardProps {
  swap: SwapRequest
  onAccept?: (id: string) => void
  onReject?: (id: string) => void
  isMine?: boolean
}

export default function SwapCard({
  swap,
  onAccept,
  onReject,
  isMine = false,
}: SwapCardProps) {
  const status = STATUS_MAP[swap.status]

  return (
    <Card
      className={cn(
        swap.status === 'pending' && 'border-primary/20',
        swap.status === 'rejected' && 'opacity-60'
      )}
    >
      <CardContent className="px-3 py-3">
        {/* Header: status + date */}
        <div className="flex items-center justify-between mb-2">
          <Badge variant={status.variant} className="text-[10px]">
            {status.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {swap.createdAt}
          </span>
        </div>

        {/* Swap visualization */}
        <div className="flex items-center gap-2">
          <SwapSide
            name={shortName(swap.fromResident.name)}
            day={swap.fromDay}
            zone={swap.fromZone}
          />
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <SwapSide
            name={shortName(swap.toResident.name)}
            day={swap.toDay}
            zone={swap.toZone}
          />
        </div>

        {/* Action buttons for pending swaps aimed at me */}
        {swap.status === 'pending' && isMine && (
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-green-400 border-green-800 hover:bg-green-900/30"
              onClick={() => onAccept?.(swap.id)}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Kabul
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-red-400 border-red-800 hover:bg-red-900/30"
              onClick={() => onReject?.(swap.id)}
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
  zone: SwapRequest['fromZone']
}) {
  return (
    <div className="flex-1 rounded-md bg-muted/50 p-2 min-w-0">
      <p className="text-[11px] font-semibold truncate">{name}</p>
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[10px] text-muted-foreground">{day}.</span>
        <Badge
          variant="outline"
          className="text-[9px] px-1.5 py-0"
          style={{ borderColor: zone.color, color: zone.color }}
        >
          {zone.name}
        </Badge>
      </div>
    </div>
  )
}
