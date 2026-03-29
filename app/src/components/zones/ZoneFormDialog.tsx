import { useState, useEffect } from 'react'
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
import type { Zone } from '@/types/schedule'

const COLORS = [
  '#EF9F27', '#3B82F6', '#10B981', '#EF4444',
  '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4',
]

interface ZoneFormDialogProps {
  editZone?: Zone | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: { id?: string; name: string; color: string; min: number; max: number }) => void
}

export default function ZoneFormDialog({
  editZone,
  open,
  onOpenChange,
  onSave,
}: ZoneFormDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [min, setMin] = useState(1)
  const [max, setMax] = useState(3)

  useEffect(() => {
    if (editZone) {
      setName(editZone.name)
      setColor(editZone.color)
    } else {
      setName('')
      setColor(COLORS[0])
      setMin(1)
      setMax(3)
    }
  }, [editZone, open])

  function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({
      id: editZone?.id,
      name: trimmed,
      color,
      min,
      max,
    })
    onOpenChange(false)
  }

  const isEdit = !!editZone

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!isEdit && (
        <DialogTrigger
          render={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Alan Ekle
            </Button>
          }
        />
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Alan Düzenle' : 'Yeni Alan Ekle'}</DialogTitle>
          <DialogDescription>
            Alan adı, renk ve kapasite bilgilerini girin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Alan Adı</label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Triaj, Resüsitasyon..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Renk</label>
            <div className="flex gap-2 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{
                    backgroundColor: c,
                    border: color === c ? '2px solid white' : '2px solid transparent',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Min Kişi</label>
              <input
                type="number"
                min={0}
                max={10}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Max Kişi</label>
              <input
                type="number"
                min={0}
                max={10}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={max}
                onChange={(e) => setMax(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">İptal</Button>} />
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {isEdit ? 'Güncelle' : 'Ekle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
