import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import MonthNav from './MonthNav'
import DayCell from './DayCell'
import { DAY_LABELS, type DayShift } from './schedule-ui-types'

interface CalendarGridProps {
  days: DayShift[]
  year: number
  month: number
  onDaySelect?: (day: number, data: DayShift) => void
  selectedDay?: number | null
  onPrevMonth: () => void
  onNextMonth: () => void
  swapAvailability?: Map<number, boolean>
}

export default function CalendarGrid({
  days,
  year,
  month,
  onDaySelect,
  selectedDay = null,
  onPrevMonth,
  onNextMonth,
  swapAvailability,
}: CalendarGridProps) {
  // First day offset (Monday = 0)
  const firstDow = new Date(year, month, 1).getDay()
  const offset = firstDow === 0 ? 6 : firstDow - 1

  function handleDayClick(d: number) {
    const dayData = days.find((x) => x.day === d)
    if (dayData && onDaySelect) onDaySelect(d, dayData)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Nöbet Takvimi</CardTitle>
        <MonthNav
          year={year}
          month={month}
          onPrev={onPrevMonth}
          onNext={onNextMonth}
        />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="text-center text-[10px] font-semibold text-muted-foreground uppercase py-1"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty offset cells */}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`e${i}`} />
          ))}

          {days.map((day) => (
            <DayCell
              key={day.day}
              day={day}
              isSelected={selectedDay === day.day}
              onClick={handleDayClick}
              swapAvailable={swapAvailability?.get(day.day) ?? false}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
