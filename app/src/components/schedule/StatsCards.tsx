import { Card, CardContent } from '@/components/ui/card'
import { Calendar, Sun, Star, Briefcase } from 'lucide-react'
import type { ShiftStats } from './schedule-ui-types'

interface StatsCardsProps {
  stats: ShiftStats
}

const STAT_CONFIG = [
  {
    key: 'totalShifts' as const,
    label: 'Toplam',
    icon: Calendar,
    color: 'text-foreground',
  },
  {
    key: 'weekdayShifts' as const,
    label: 'Hafta İçi',
    icon: Briefcase,
    color: 'text-blue-400',
  },
  {
    key: 'weekendShifts' as const,
    label: 'Hafta Sonu',
    icon: Sun,
    color: 'text-orange-400',
  },
  {
    key: 'holidayShifts' as const,
    label: 'Bayram',
    icon: Star,
    color: 'text-red-400',
  },
]

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STAT_CONFIG.map(({ key, label, icon: Icon, color }) => (
        <Card key={key} className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary to-orange-400 opacity-50" />
          <CardContent className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`h-3 w-3 ${color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                {label}
              </span>
            </div>
            <span className="text-xl font-bold font-mono">{stats[key]}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
