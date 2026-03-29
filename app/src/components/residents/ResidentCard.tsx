import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, CalendarOff } from 'lucide-react'
import type { Resident } from '@/types/schedule'

const STATUS_LABEL: Record<string, { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  aktif: { text: 'Aktif', variant: 'default' },
  izinli: { text: 'İzinli', variant: 'secondary' },
  rot_evet: { text: 'Rotasyon (Aktif)', variant: 'outline' },
  rot_hayir: { text: 'Rotasyon (Pasif)', variant: 'destructive' },
}

interface ResidentCardProps {
  resident: Resident
  index: number
  status: string
  shiftCount: number
  target: number
  onEditSeniority: (id: number) => void
  onRemove: (id: number) => void
  onLeave: (index: number) => void
}

export default function ResidentCard({
  resident,
  index,
  status,
  shiftCount,
  target,
  onEditSeniority,
  onRemove,
  onLeave,
}: ResidentCardProps) {
  const st = STATUS_LABEL[status] ?? { text: status, variant: 'secondary' as const }

  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{resident.name}</span>
            <Badge variant={st.variant} className="text-[10px] shrink-0">
              {st.text}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>PGY-{resident.kidem}</span>
            <span>{shiftCount}/{target} nöbet</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onLeave(index)}
            title="İzin yönetimi"
          >
            <CalendarOff className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onEditSeniority(resident.id)}
            title="Kıdem düzenle"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onRemove(resident.id)}
            title="Çıkar"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
