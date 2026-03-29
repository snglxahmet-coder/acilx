import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { useScheduleStore } from '@/stores/schedule-store'

interface SwapCreateDialogProps {
  onSubmit?: (data: {
    toResidentUid: string
    fromDay: number
    toDay: number
    fromZoneId: string
    toZoneId: string
  }) => void
}

export default function SwapCreateDialog({ onSubmit }: SwapCreateDialogProps) {
  const [open, setOpen] = useState(false)
  const { residents, zones } = useScheduleStore()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full" />}>
        <Plus className="h-4 w-4 mr-1" />
        Yeni Takas Talebi
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Takas Talebi Oluştur</DialogTitle>
          <DialogDescription>
            Nöbet takas teklifinizi gönderin.
          </DialogDescription>
        </DialogHeader>
        <SwapForm
          residents={residents}
          zones={zones}
          onSubmit={(data) => {
            onSubmit?.(data)
            setOpen(false)
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function SwapForm({
  residents,
  zones,
  onSubmit,
  onCancel,
}: {
  residents: { name: string; kidem: number }[]
  zones: { id: string; name: string }[]
  onSubmit: SwapCreateDialogProps['onSubmit'] extends ((...a: infer P) => void) | undefined ? (...a: P) => void : never
  onCancel: () => void
}) {
  const [toUid, setToUid] = useState('')
  const [fromDay, setFromDay] = useState('')
  const [toDay, setToDay] = useState('')
  const [fromZone, setFromZone] = useState('')
  const [toZone, setToZone] = useState('')

  const isValid =
    toUid && fromDay && toDay && fromZone && toZone

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onSubmit({
      toResidentUid: toUid,
      fromDay: Number(fromDay),
      toDay: Number(toDay),
      fromZoneId: fromZone,
      toZoneId: toZone,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <FormSelect
        label="Takas yapılacak asistan"
        value={toUid}
        onChange={setToUid}
        options={residents.map((r, i) => ({
          value: String(i),
          label: `${r.name} (K${r.kidem})`,
        }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormInput
          label="Benim nöbet günüm"
          type="number"
          value={fromDay}
          onChange={setFromDay}
          min={1}
          max={31}
        />
        <FormInput
          label="İstenen gün"
          type="number"
          value={toDay}
          onChange={setToDay}
          min={1}
          max={31}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormSelect
          label="Benim alanım"
          value={fromZone}
          onChange={setFromZone}
          options={zones.map((z) => ({
            value: z.id,
            label: z.name,
          }))}
        />
        <FormSelect
          label="İstenen alan"
          value={toZone}
          onChange={setToZone}
          options={zones.map((z) => ({
            value: z.id,
            label: z.name,
          }))}
        />
      </div>

      <DialogFooter className="gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          İptal
        </Button>
        <Button type="submit" size="sm" disabled={!isValid}>
          Gönder
        </Button>
      </DialogFooter>
    </form>
  )
}

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">Seçin...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function FormInput({
  label,
  type,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  min?: number
  max?: number
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}
