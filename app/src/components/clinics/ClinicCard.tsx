import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building, Check, Trash2 } from 'lucide-react'
import type { Clinic } from '@/services/clinic-service'

interface ClinicCardProps {
  clinic: Clinic
  isSelected: boolean
  onSelect: (clinicId: string) => void
  showApprove?: boolean
  onApprove?: (clinicId: string) => void
  showDelete?: boolean
  onDelete?: (clinicId: string) => void
}

export default function ClinicCard({
  clinic,
  isSelected,
  onSelect,
  showApprove,
  onApprove,
  showDelete,
  onDelete,
}: ClinicCardProps) {
  return (
    <Card
      size="sm"
      className={`cursor-pointer transition-colors ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => onSelect(clinic.id)}
    >
      <CardContent className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium truncate block">{clinic.name}</span>
            <span className="text-xs text-muted-foreground truncate block">
              {clinic.hospitalName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={clinic.status === 'active' ? 'default' : 'secondary'}
            className="text-[10px]"
          >
            {(clinic.shiftTypes || [clinic.shiftModel || '24h']).join(' / ')}
          </Badge>
          {isSelected && (
            <Check className="h-4 w-4 text-primary" />
          )}
          {showApprove && clinic.status === 'pending' && onApprove && (
            <Button
              size="xs"
              onClick={(e) => {
                e.stopPropagation()
                onApprove(clinic.id)
              }}
            >
              Onayla
            </Button>
          )}
          {showDelete && onDelete && (
            <Button
              size="xs"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(clinic.id)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
