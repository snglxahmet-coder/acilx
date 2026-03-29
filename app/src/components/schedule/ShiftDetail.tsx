import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ArrowLeftRight } from 'lucide-react'
import { MONTH_NAMES, shortName, type DayShift } from './schedule-ui-types'
import SwapMatchSheet from '@/components/swaps/SwapMatchSheet'
import SwapPickMyShift from '@/components/swaps/SwapPickMyShift'

const DAYS_FULL = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
]

interface ShiftDetailProps {
  open: boolean
  onClose: () => void
  day: DayShift | null
  year: number
  month: number
  myIdx: number
  onSwapRequest?: (day: number, zoneId: string) => void
}

export default function ShiftDetail({
  open,
  onClose,
  day,
  year,
  month,
  myIdx,
}: ShiftDetailProps) {
  const [matchSheetOpen, setMatchSheetOpen] = useState(false)
  const [matchSheetZone, setMatchSheetZone] = useState('')
  const [pickMyShiftOpen, setPickMyShiftOpen] = useState(false)
  const [targetForPick, setTargetForPick] = useState<{
    idx: number
    day: number
    zoneId: string
  } | null>(null)

  if (!day) return null

  const isMyDay = !!day.myZone
  const dateLabel = `${day.day} ${MONTH_NAMES[month]} ${year} · ${DAYS_FULL[day.dayOfWeek]}`

  function handleSwapMyShift(zoneId: string) {
    setMatchSheetZone(zoneId)
    setMatchSheetOpen(true)
  }

  function handleSwapWithOther(targetIdx: number, targetDay: number, targetZoneId: string) {
    setTargetForPick({ idx: targetIdx, day: targetDay, zoneId: targetZoneId })
    setPickMyShiftOpen(true)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm">{dateLabel}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-3 mt-4 px-1">
            {day.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bu gün için nöbet ataması yok.
              </p>
            ) : (
              day.assignments.map((a) => {
                const isMyZone = day.myZone?.id === a.zone.id

                return (
                  <ZoneBlock
                    key={a.zone.id}
                    zone={a.zone}
                    residents={a.residents}
                    isMyDay={isMyZone}
                    onSwapMyShift={
                      isMyZone ? () => handleSwapMyShift(a.zone.id) : undefined
                    }
                    onSwapWithOther={
                      !isMyDay && myIdx >= 0
                        ? (targetIdx) =>
                            handleSwapWithOther(
                              targetIdx,
                              day.day,
                              a.zone.id,
                            )
                        : undefined
                    }
                  />
                )
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Kendi nöbetimden takas: eşleşme listesi */}
      <SwapMatchSheet
        open={matchSheetOpen}
        onClose={() => setMatchSheetOpen(false)}
        requesterIdx={myIdx}
        requesterDay={day.day}
        requesterZoneId={matchSheetZone}
        year={year}
        month={month}
      />

      {/* Başkasının nöbetiyle takas: hangi nöbetimle? */}
      {targetForPick && (
        <SwapPickMyShift
          open={pickMyShiftOpen}
          onClose={() => {
            setPickMyShiftOpen(false)
            setTargetForPick(null)
          }}
          myIdx={myIdx}
          targetIdx={targetForPick.idx}
          targetDay={targetForPick.day}
          targetZoneId={targetForPick.zoneId}
          year={year}
          month={month}
        />
      )}
    </>
  )
}

function ZoneBlock({
  zone,
  residents,
  isMyDay,
  onSwapMyShift,
  onSwapWithOther,
}: {
  zone: DayShift['assignments'][0]['zone']
  residents: DayShift['assignments'][0]['residents']
  isMyDay: boolean
  onSwapMyShift?: () => void
  onSwapWithOther?: (targetIdx: number) => void
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: zone.color }}
          />
          <span className="text-xs font-bold">{zone.name}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {residents.length} kişi
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {residents.map((r) => (
          <div
            key={r.uid}
            className="flex items-center gap-1.5 rounded-md bg-background border px-2 py-1"
          >
            <Badge variant="outline" className="text-[9px] px-1 py-0">
              K{r.seniority}
            </Badge>
            <span className="text-[11px] font-semibold">
              {shortName(r.name)}
            </span>
          </div>
        ))}
      </div>

      {/* Kendi nöbetim — "Takas Teklif Et" */}
      {isMyDay && onSwapMyShift && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={onSwapMyShift}
        >
          <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
          Takas Teklif Et
        </Button>
      )}

      {/* Başkasının nöbeti — "Bu nöbetle takas et" */}
      {!isMyDay && onSwapWithOther && residents.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full text-xs"
          onClick={() => {
            const targetIdx = Number(residents[0].uid)
            onSwapWithOther(targetIdx)
          }}
        >
          <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
          Bu nöbetle takas et
        </Button>
      )}
    </div>
  )
}
