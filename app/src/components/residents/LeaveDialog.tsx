import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useScheduleStore } from '@/stores/schedule-store'
import { getMonthlyLeaves, monthKey, daysInMonth, MONTHS, isWeekend } from '@/lib/schedule-helpers'

import type { Resident } from '@/types/schedule'

interface LeaveDialogProps {
  open: boolean
  onClose: () => void
  resident: Resident | null
  residentIndex: number
}

export default function LeaveDialog({
  open,
  onClose,
  resident,
  residentIndex,
}: LeaveDialogProps) {
  const { state, setState } = useScheduleStore()
  const { y, m } = state.currentDate
  const moKey = monthKey(y, m)
  const days = daysInMonth(y, m)

  const leaves = useMemo(
    () => getMonthlyLeaves(state.astProfiles, residentIndex, moKey),
    [state.astProfiles, residentIndex, moKey],
  )

  const [localLeaves, setLocalLeaves] = useState<number[]>(leaves)

  // Dialog açılınca sync
  useMemo(() => {
    setLocalLeaves(leaves)
  }, [leaves])

  function toggleDay(day: number) {
    setLocalLeaves((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  function handleSave() {
    // toggleLeaveDay her seferinde tek gün toggle eder
    // Önce mevcut izinleri kaldır, sonra yenileri ekle
    let newState = { ...state, astProfiles: { ...state.astProfiles } }
    const profile = newState.astProfiles[residentIndex] ?? { durum: 'aktif' as const }
    const izinliAylik = { ...(profile.izinliAylik ?? {}) }
    izinliAylik[moKey] = [...localLeaves]
    newState.astProfiles[residentIndex] = { ...profile, izinliAylik }
    setState(newState)
    onClose()
  }

  if (!resident) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{resident.name} — İzin Günleri</DialogTitle>
          <DialogDescription>
            {MONTHS[m]} {y} — İzinli günleri seçin
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-7 gap-1 text-center">
          {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map((d) => (
            <div key={d} className="text-[10px] text-muted-foreground font-medium py-1">
              {d}
            </div>
          ))}

          {/* Boş hücreler — ayın ilk günü hangi güne denk geliyor */}
          {Array.from({ length: new Date(y, m, 1).getDay() === 0 ? 6 : new Date(y, m, 1).getDay() - 1 }).map((_, i) => (
            <div key={`e-${i}`} />
          ))}

          {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
            const isLeave = localLeaves.includes(day)
            const we = isWeekend(y, m, day)
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`
                  rounded-md py-1.5 text-xs transition-colors
                  ${isLeave
                    ? 'bg-destructive/20 text-destructive font-semibold'
                    : we
                      ? 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      : 'hover:bg-muted/50'
                  }
                `}
              >
                {day}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {localLeaves.length} gün izinli
        </p>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">İptal</Button>} />
          <Button onClick={handleSave}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
