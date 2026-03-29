import { useState, useCallback } from 'react'
import { useScheduleStore } from '@/stores/schedule-store'
import { useAuthStore } from '@/stores/auth-store'
import ZoneList from '@/components/zones/ZoneList'
import ZoneFormDialog from '@/components/zones/ZoneFormDialog'
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
import type { Zone } from '@/types/schedule'

export default function Zones() {
  const { zones, state, setZones, setState, saveZones } = useScheduleStore()
  const { user } = useAuthStore()

  const [formOpen, setFormOpen] = useState(false)
  const [editZone, setEditZone] = useState<Zone | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function handleEdit(zone: Zone) {
    setEditZone(zone)
    setFormOpen(true)
  }

  const handleSave = useCallback(
    (data: { id?: string; name: string; color: string; min: number; max: number }) => {
      if (data.id) {
        // Düzenleme
        setZones(zones.map((z) => (z.id === data.id ? { ...z, name: data.name, color: data.color } : z)))
        setState({
          defaultDayMin: {
            ...state.defaultDayMin,
            [data.id]: {
              ...state.defaultDayMin[data.id],
              min: data.min,
              max: data.max,
            },
          },
        })
      } else {
        // Yeni alan
        const id = `zone_${Date.now()}`
        setZones([...zones, { id, name: data.name, color: data.color }])
        setState({
          defaultDayMin: {
            ...state.defaultDayMin,
            [id]: {
              min: data.min,
              max: data.max,
              kidemMin: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
              kidemMax: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
              kidemKurallari: {},
              siftler: ['24h'],
            },
          },
          minNobet: {
            ...state.minNobet,
            [id]: { 1: 1, 2: 1, 3: 1, 4: 0, 5: 0 },
          },
          quota: {
            ...state.quota,
            [id]: { 1: 5, 2: 5, 3: 4, 4: 3, 5: 2 },
          },
        })
      }
      setEditZone(null)
      if (user?.uid) saveZones(user.uid)
    },
    [zones, state, setZones, setState, saveZones, user?.uid],
  )

  function handleConfirmDelete() {
    if (!deleteId) return
    setZones(zones.filter((z) => z.id !== deleteId))
    const { [deleteId]: _ddm, ...restDDM } = state.defaultDayMin
    const { [deleteId]: _mn, ...restMN } = state.minNobet
    const { [deleteId]: _q, ...restQ } = state.quota
    // Çizelgeden bu alana ait atamaları temizle
    const newSchedule = { ...state.schedule }
    for (const key of Object.keys(newSchedule)) {
      if (newSchedule[key] === deleteId) delete newSchedule[key]
    }
    setState({
      defaultDayMin: restDDM,
      minNobet: restMN,
      quota: restQ,
      schedule: newSchedule,
    })
    setDeleteId(null)
    if (user?.uid) saveZones(user.uid)
  }

  const deleteZone = zones.find((z) => z.id === deleteId)

  return (
    <div className="p-4 pb-20 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Alanlar</h1>
        <ZoneFormDialog
          open={formOpen && !editZone}
          onOpenChange={(o) => { setFormOpen(o); if (!o) setEditZone(null) }}
          editZone={null}
          onSave={handleSave}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {zones.length} alan tanımlı
      </p>

      <ZoneList
        zones={zones}
        rules={state.defaultDayMin}
        onEdit={handleEdit}
        onDelete={setDeleteId}
      />

      {/* Düzenleme Dialog */}
      {editZone && (
        <ZoneFormDialog
          open={!!editZone}
          onOpenChange={(o) => { if (!o) setEditZone(null) }}
          editZone={editZone}
          onSave={handleSave}
        />
      )}

      {/* Silme Onay Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alan Sil</DialogTitle>
            <DialogDescription>
              <strong>{deleteZone?.name}</strong> alanını silmek istediğinizden emin misiniz?
              Bu alana yapılmış tüm atamalar da silinecek.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">İptal</Button>} />
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
