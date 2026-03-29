import { useState, useCallback } from 'react'
import { useResidents } from '@/hooks/useResidents'
import { useAuthStore } from '@/stores/auth-store'
import ResidentList from '@/components/residents/ResidentList'
import AddResidentDialog from '@/components/residents/AddResidentDialog'
import LeaveDialog from '@/components/residents/LeaveDialog'
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
import type { Seniority } from '@/types/schedule'

export default function Residents() {
  const {
    residents,
    getStatus,
    getTargetInfo,
    addResident,
    removeResident,
    updateSeniority,
    saveResidents,
  } = useResidents()
  const { user } = useAuthStore()

  // ── Kıdem düzenleme ──
  const [editId, setEditId] = useState<number | null>(null)
  const [editSeniority, setEditSeniority] = useState<Seniority>(1)

  function openEditSeniority(id: number) {
    const r = residents.find((r) => r.id === id)
    if (r) {
      setEditSeniority(r.kidem)
      setEditId(id)
    }
  }

  function handleSaveSeniority() {
    if (editId !== null) {
      updateSeniority(editId, editSeniority)
      if (user?.uid) saveResidents(user.uid)
      setEditId(null)
    }
  }

  // ── Silme onayı ──
  const [removeId, setRemoveId] = useState<number | null>(null)

  function handleConfirmRemove() {
    if (removeId !== null) {
      removeResident(removeId)
      if (user?.uid) saveResidents(user.uid)
      setRemoveId(null)
    }
  }

  // ── İzin dialogu ──
  const [leaveIdx, setLeaveIdx] = useState<number | null>(null)

  // ── Asistan ekleme ──
  const handleAdd = useCallback(
    (name: string, seniority: Seniority) => {
      addResident(name, seniority)
      if (user?.uid) saveResidents(user.uid)
    },
    [addResident, saveResidents, user?.uid],
  )


  const removeResident_ = residents.find((r) => r.id === removeId)

  return (
    <div className="p-4 pb-20 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Asistanlar</h1>
        <AddResidentDialog onAdd={handleAdd} />
      </div>

      <p className="text-xs text-muted-foreground">
        {residents.length} asistan kayıtlı
      </p>

      <ResidentList
        residents={residents}
        getStatus={getStatus}
        getTargetInfo={getTargetInfo}
        onEditSeniority={openEditSeniority}
        onRemove={setRemoveId}
        onLeave={setLeaveIdx}
      />

      {/* Kıdem Düzenleme Dialog */}
      <Dialog open={editId !== null} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kıdem Düzenle</DialogTitle>
            <DialogDescription>
              {residents.find((r) => r.id === editId)?.name}
            </DialogDescription>
          </DialogHeader>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={editSeniority}
            onChange={(e) => setEditSeniority(Number(e.target.value) as Seniority)}
          >
            {[1, 2, 3, 4, 5].map((y) => (
              <option key={y} value={y}>PGY-{y}</option>
            ))}
          </select>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">İptal</Button>} />
            <Button onClick={handleSaveSeniority}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silme Onay Dialog */}
      <Dialog open={removeId !== null} onOpenChange={(o) => !o && setRemoveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asistan Çıkar</DialogTitle>
            <DialogDescription>
              <strong>{removeResident_?.name}</strong> listeden çıkarılsın mı?
              Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">İptal</Button>} />
            <Button variant="destructive" onClick={handleConfirmRemove}>
              Çıkar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* İzin Dialog */}
      <LeaveDialog
        open={leaveIdx !== null}
        onClose={() => setLeaveIdx(null)}
        resident={leaveIdx !== null ? residents[leaveIdx] ?? null : null}
        residentIndex={leaveIdx ?? 0}
      />
    </div>
  )
}
