import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import MonthNav from '@/components/schedule/MonthNav'
import { DAY_LABELS } from '@/components/schedule/schedule-ui-types'

export interface PreferenceEntry {
  day: number
  type: 'prefer' | 'avoid' | 'off' | null
}

const PREF_STYLES = {
  prefer: {
    bg: 'bg-green-900/50',
    text: 'text-green-300',
    dot: 'bg-green-700',
    label: 'Tercih',
  },
  avoid: {
    bg: 'bg-orange-900/50',
    text: 'text-orange-200',
    dot: 'bg-orange-800',
    label: 'Kaçın',
  },
  off: {
    bg: 'bg-red-900/50',
    text: 'text-red-300',
    dot: 'bg-red-800',
    label: 'İzin',
  },
} as const

interface PreferenceGridProps {
  preferences?: PreferenceEntry[]
  onToggle?: (day: number, newType: PreferenceEntry['type']) => void
}

export default function PreferenceGrid({
  preferences: propPrefs,
  onToggle,
}: PreferenceGridProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const daysCount = new Date(year, month + 1, 0).getDate()
  const emptyPrefs = useMemo(
    () => Array.from({ length: daysCount }, (_, i) => ({ day: i + 1, type: null as PreferenceEntry['type'] })),
    [daysCount]
  )
  const prefs = propPrefs ?? emptyPrefs

  const [localPrefs, setLocalPrefs] = useState<
    Map<number, PreferenceEntry['type']>
  >(new Map(prefs.map((p) => [p.day, p.type])))

  // Sync on month change
  useMemo(() => {
    setLocalPrefs(new Map(prefs.map((p) => [p.day, p.type])))
  }, [prefs])

  const firstDow = new Date(year, month, 1).getDay()
  const offset = firstDow === 0 ? 6 : firstDow - 1

  function navMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setMonth(m)
    setYear(y)
  }

  const handleToggle = useCallback(
    (day: number) => {
      const cycle: PreferenceEntry['type'][] = [
        null,
        'prefer',
        'avoid',
        'off',
      ]
      const current = localPrefs.get(day) ?? null
      const idx = cycle.indexOf(current)
      const next = cycle[(idx + 1) % cycle.length]

      setLocalPrefs((prev) => {
        const m = new Map(prev)
        m.set(day, next)
        return m
      })
      onToggle?.(day, next)
    },
    [localPrefs, onToggle]
  )

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Tercih Girişi</CardTitle>
        <MonthNav
          year={year}
          month={month}
          onPrev={() => navMonth(-1)}
          onNext={() => navMonth(1)}
        />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {/* Legend */}
        <div className="flex gap-3 mb-3 flex-wrap">
          {Object.entries(PREF_STYLES).map(([key, s]) => (
            <span
              key={key}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span className={cn('w-2.5 h-2.5 rounded-full', s.dot)} />
              {s.label}
            </span>
          ))}
          <span className="text-[10px] text-muted-foreground/60">
            (Günlere tıkla: boş → tercih → kaçın → izin → temizle)
          </span>
        </div>

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
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`e${i}`} />
          ))}

          {Array.from({ length: daysCount }).map((_, i) => {
            const d = i + 1
            const type = localPrefs.get(d) ?? null
            const style = type ? PREF_STYLES[type] : null
            const dow = new Date(year, month, d).getDay()
            const isWeekend = dow === 0 || dow === 6

            return (
              <button
                key={d}
                onClick={() => handleToggle(d)}
                className={cn(
                  'flex flex-col items-center justify-center rounded-md min-h-[44px]',
                  'border transition-colors cursor-pointer active:scale-95 touch-manipulation',
                  style
                    ? cn(style.bg, style.text, 'border-transparent')
                    : isWeekend
                      ? 'bg-muted/30 border-border text-muted-foreground/60'
                      : 'bg-card border-border text-muted-foreground'
                )}
              >
                <span className="text-xs font-semibold">{d}</span>
                {style && (
                  <span className="text-[8px] font-medium mt-0.5">
                    {style.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
