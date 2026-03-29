import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import MonthNav from './MonthNav'
import {
  DAY_LABELS,
  MONTH_NAMES,
  shortName,
  type DayShift,
} from './schedule-ui-types'

interface ShiftListProps {
  days: DayShift[]
  year: number
  month: number
  onDaySelect?: (day: number, data: DayShift) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}

export default function ShiftList({
  days,
  year,
  month,
  onDaySelect,
  onPrevMonth,
  onNextMonth,
}: ShiftListProps) {
  const daysWithShifts = days.filter((d) => d.totalCount > 0)

  // Map JS dow (0=Sun) to Turkish day label index (0=Mon)
  function dowLabel(dow: number) {
    const idx = dow === 0 ? 6 : dow - 1
    return DAY_LABELS[idx]
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Nöbet Listesi</CardTitle>
        <MonthNav
          year={year}
          month={month}
          onPrev={onPrevMonth}
          onNext={onNextMonth}
        />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {daysWithShifts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Bu ayda nöbet ataması yok.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {daysWithShifts.map((day) => (
              <li
                key={day.day}
                className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors"
                onClick={() => onDaySelect?.(day.day, day)}
              >
                {/* Date column */}
                <div className="flex flex-col items-center min-w-[36px]">
                  <span className="text-xs font-bold">{day.day}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {dowLabel(day.dayOfWeek)}
                  </span>
                </div>

                {/* Zone badges */}
                <div className="flex flex-wrap gap-1 flex-1">
                  {day.assignments.map((a) => (
                    <Badge
                      key={a.zone.id}
                      variant="secondary"
                      className="text-[10px] gap-1"
                      style={{
                        borderLeft: `3px solid ${a.zone.color}`,
                      }}
                    >
                      {a.zone.name.split(' ')[0]}:{' '}
                      {a.residents.map((r) => shortName(r.name)).join(', ')}
                    </Badge>
                  ))}
                </div>

                {/* Weekend/weekday tag */}
                <Badge
                  variant={day.isWeekend ? 'destructive' : 'outline'}
                  className="text-[9px] shrink-0"
                >
                  {day.isWeekend ? 'HfS' : 'Hİ'}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-3">
          {MONTH_NAMES[month]} {year} · {daysWithShifts.length} gün nöbet
        </p>
      </CardContent>
    </Card>
  )
}
