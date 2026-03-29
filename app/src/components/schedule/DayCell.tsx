import { cn } from '@/lib/utils'
import { ArrowLeftRight } from 'lucide-react'
import type { DayShift } from './schedule-ui-types'

interface DayCellProps {
  day: DayShift
  isSelected: boolean
  onClick: (day: number) => void
  swapAvailable?: boolean
}

export default function DayCell({ day, isSelected, onClick, swapAvailable }: DayCellProps) {
  const hasShift = day.totalCount > 0
  const isMyDay = !!day.myZone

  return (
    <button
      onClick={() => onClick(day.day)}
      className={cn(
        'relative flex flex-col items-center rounded-md p-1 min-h-[52px]',
        'border transition-colors cursor-pointer',
        'active:scale-95 touch-manipulation',
        isSelected && 'ring-2 ring-primary',
        isMyDay
          ? 'border-primary/40 bg-primary/10'
          : day.isToday
            ? 'border-primary/60 bg-primary/5'
            : day.isWeekend
              ? 'border-border bg-muted/30'
              : 'border-border bg-card',
        !isSelected && 'hover:border-primary/30'
      )}
    >
      {/* Day number + count */}
      <div className="flex w-full items-center justify-between px-0.5">
        <span
          className={cn(
            'text-[10px] font-bold',
            isMyDay
              ? 'text-foreground'
              : day.isToday
                ? 'text-primary'
                : day.isWeekend
                  ? 'text-muted-foreground/60'
                  : 'text-muted-foreground'
          )}
        >
          {day.day}
        </span>
        {isMyDay && day.myZone ? (
          <span
            className="text-[8px] font-bold px-1 rounded"
            style={{ background: day.myZone.color, color: '#fff' }}
          >
            {day.myZone.name.split(' ')[0]}
          </span>
        ) : hasShift ? (
          <span className="text-[8px] font-bold text-muted-foreground">
            {day.totalCount}
          </span>
        ) : null}
      </div>

      {/* Zone color bars */}
      {hasShift && (
        <div className="flex flex-wrap gap-px mt-auto">
          {day.assignments.slice(0, 4).map((a) => (
            <div
              key={a.zone.id}
              className="h-1 rounded-full"
              style={{
                width: Math.min(a.residents.length * 4 + 4, 14),
                background: a.zone.color,
                opacity: isMyDay && a.zone.id === day.myZone?.id ? 1 : 0.6,
              }}
            />
          ))}
        </div>
      )}

      {/* Takas rozeti — benim nöbetim değil ama uygun takas var */}
      {swapAvailable && !isMyDay && (
        <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500">
          <ArrowLeftRight className="h-2 w-2 text-white" />
        </span>
      )}

      {/* "Ben" label */}
      {isMyDay && (
        <span className="absolute bottom-0.5 left-1 text-[8px] text-muted-foreground">
          Ben
        </span>
      )}
    </button>
  )
}
