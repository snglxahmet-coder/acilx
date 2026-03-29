import ZoneCard from './ZoneCard'
import type { Zone, DayRule } from '@/types/schedule'

interface ZoneListProps {
  zones: Zone[]
  rules: Record<string, DayRule>
  onEdit: (zone: Zone) => void
  onDelete: (zoneId: string) => void
}

export default function ZoneList({ zones, rules, onEdit, onDelete }: ZoneListProps) {
  if (zones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Henüz alan tanımlanmamış.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {zones.map((zone) => (
        <ZoneCard
          key={zone.id}
          zone={zone}
          rule={rules[zone.id]}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
