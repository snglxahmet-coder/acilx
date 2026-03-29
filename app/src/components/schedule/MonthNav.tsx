import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MONTH_NAMES } from './schedule-ui-types'

interface MonthNavProps {
  year: number
  month: number
  onPrev: () => void
  onNext: () => void
}

export default function MonthNav({ year, month, onPrev, onNext }: MonthNavProps) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon-sm" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-bold min-w-[130px] text-center font-mono">
        {MONTH_NAMES[month]} {year}
      </span>
      <Button variant="outline" size="icon-sm" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
