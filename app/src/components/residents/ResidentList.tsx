import ResidentCard from './ResidentCard'
import type { Resident, ResidentStatus } from '@/types/schedule'

interface ResidentListProps {
  residents: Resident[]
  getStatus: (idx: number) => ResidentStatus
  getTargetInfo: (idx: number) => { target: number; current: number }
  onEditSeniority: (id: number) => void
  onRemove: (id: number) => void
  onLeave: (idx: number) => void
}

export default function ResidentList({
  residents,
  getStatus,
  getTargetInfo,
  onEditSeniority,
  onRemove,
  onLeave,
}: ResidentListProps) {
  if (residents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Henüz asistan eklenmemiş.
      </p>
    )
  }

  // Kıdem bazlı gruplama
  const groups: Record<number, { resident: Resident; idx: number }[]> = {}
  for (let i = 0; i < residents.length; i++) {
    const r = residents[i]
    if (!groups[r.kidem]) groups[r.kidem] = []
    groups[r.kidem].push({ resident: r, idx: i })
  }

  const sortedKeys = Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="space-y-4">
      {sortedKeys.map((kidem) => (
        <div key={kidem}>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">
            PGY-{kidem} ({groups[kidem].length} kişi)
          </h3>
          <div className="space-y-2">
            {groups[kidem].map(({ resident, idx }) => {
              const { target, current } = getTargetInfo(idx)
              return (
                <ResidentCard
                  key={resident.id}
                  resident={resident}
                  index={idx}
                  status={getStatus(idx)}
                  shiftCount={current}
                  target={target}
                  onEditSeniority={onEditSeniority}
                  onRemove={onRemove}
                  onLeave={onLeave}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
