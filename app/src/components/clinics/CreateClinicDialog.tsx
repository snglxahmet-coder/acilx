import { useState } from 'react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { ShiftType } from '@/services/clinic-service'

const SHIFT_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: '24h', label: '24 Saat' },
  { value: '12-12', label: '12-12' },
  { value: '8-8-8', label: '8-8-8' },
]

interface CreateClinicDialogProps {
  onSubmit: (data: { name: string; shiftTypes: ShiftType[] }) => void
}

export default function CreateClinicDialog({ onSubmit }: CreateClinicDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(['24h'])

  function toggleShift(s: ShiftType) {
    setShiftTypes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    )
  }

  function handleSubmit() {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), shiftTypes })
    setName('')
    setShiftTypes(['24h'])
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Yeni Klinik
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Klinik Oluştur</DialogTitle>
          <DialogDescription>
            Klinik bilgilerini girin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Klinik Adı</label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Antalya Şehir Hastanesi Acil Tıp Kliniği"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Hastane + klinik adını birlikte yazın
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Vardiya Tipleri</label>
            <p className="text-[10px] text-muted-foreground mb-1.5">
              Birden fazla seçebilirsiniz
            </p>
            <div className="flex gap-2">
              {SHIFT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    shiftTypes.includes(opt.value)
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                  onClick={() => toggleShift(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">İptal</Button>} />
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || shiftTypes.length === 0}
          >
            Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
