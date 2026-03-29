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
import { UserPlus } from 'lucide-react'
import type { Seniority } from '@/types/schedule'

interface AddResidentDialogProps {
  onAdd: (name: string, seniority: Seniority, email?: string) => void
}

export default function AddResidentDialog({ onAdd }: AddResidentDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [seniority, setSeniority] = useState<Seniority>(1)
  const [email, setEmail] = useState('')

  function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) return
    const trimmedEmail = email.trim() || undefined
    onAdd(trimmed, seniority, trimmedEmail)
    setName('')
    setSeniority(1)
    setEmail('')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <UserPlus className="h-4 w-4 mr-1" />
            Asistan Ekle
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Asistan Ekle</DialogTitle>
          <DialogDescription>
            Asistan adını ve kıdem yılını girin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Ad Soyad
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Dr. Mehmet Kaya"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              E-posta (opsiyonel)
            </label>
            <input
              type="email"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Google hesap e-postası"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Asistanlık Yılı (PGY)
            </label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={seniority}
              onChange={(e) => setSeniority(Number(e.target.value) as Seniority)}
            >
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y} value={y}>PGY-{y}</option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">İptal</Button>} />
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
