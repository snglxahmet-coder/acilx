import ClinicCard from './ClinicCard'
import type { Clinic } from '@/services/clinic-service'

interface ClinicListProps {
  clinics: Clinic[]
  selectedId: string | null
  onSelect: (clinicId: string) => void
  showApprove?: boolean
  onApprove?: (clinicId: string) => void
  showDelete?: boolean
  onDelete?: (clinicId: string) => void
  emptyMessage?: string
}

export default function ClinicList({
  clinics,
  selectedId,
  onSelect,
  showApprove,
  onApprove,
  showDelete,
  onDelete,
  emptyMessage = 'Klinik bulunamadı.',
}: ClinicListProps) {
  if (clinics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {clinics.map((clinic) => (
        <ClinicCard
          key={clinic.id}
          clinic={clinic}
          isSelected={selectedId === clinic.id}
          onSelect={onSelect}
          showApprove={showApprove}
          onApprove={onApprove}
          showDelete={showDelete}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
