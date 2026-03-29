import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2 } from 'lucide-react'
import type { Zone, DayRule } from '@/types/schedule'

interface ZoneCardProps {
  zone: Zone
  rule?: DayRule
  onEdit: (zone: Zone) => void
  onDelete: (zoneId: string) => void
}

export default function ZoneCard({ zone, rule, onEdit, onDelete }: ZoneCardProps) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: zone.color }}
          />
          <div className="min-w-0">
            <span className="text-sm font-medium truncate block">{zone.name}</span>
            {rule && (
              <span className="text-xs text-muted-foreground">
                Min {rule.min} — Max {rule.max} kişi
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {rule?.aktif === false && (
            <Badge variant="destructive" className="text-[10px] mr-1">Pasif</Badge>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onEdit(zone)}
            title="Düzenle"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onDelete(zone.id)}
            title="Sil"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
