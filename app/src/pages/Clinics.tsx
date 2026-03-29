import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { useScheduleStore } from '@/stores/schedule-store'
import ClinicList from '@/components/clinics/ClinicList'
import CreateClinicDialog from '@/components/clinics/CreateClinicDialog'
import ImportScheduleDialog from '@/components/clinics/ImportScheduleDialog'
import {
  createClinic,
  listMyClinics,
  listPendingClinics,
  approveClinic,
  type Clinic,
} from '@/services/clinic-service'
import { callDeleteClinic } from '@/services/admin-service'

export default function Clinics() {
  const { user, profile } = useAuthStore()
  const { setGroupId } = useScheduleStore()

  const [myClinics, setMyClinics] = useState<Clinic[]>([])
  const [pendingClinics, setPendingClinics] = useState<Clinic[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(
    profile?.clinicId ?? null,
  )
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchClinics = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const [my, pending] = await Promise.all([
        listMyClinics(user.uid),
        listPendingClinics(),
      ])
      setMyClinics(my)
      setPendingClinics(pending)
    } catch (err) {
      console.error('Klinik yükleme hatası:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    fetchClinics()
  }, [fetchClinics])

  function handleSelect(clinicId: string) {
    setSelectedId(clinicId)
    setGroupId(clinicId)
  }

  async function handleCreate(data: {
    name: string
    shiftTypes: Clinic['shiftTypes']
  }) {
    if (!user?.uid) return
    try {
      const clinic = await createClinic({ ...data, createdBy: user.uid })
      setMyClinics((prev) => [...prev, clinic])
      handleSelect(clinic.id)
    } catch (err) {
      console.error('Klinik oluşturma hatası:', err)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await callDeleteClinic(deleteTarget)
      if (result.ok) {
        setMyClinics((prev) => prev.filter((c) => c.id !== deleteTarget))
        if (selectedId === deleteTarget) setSelectedId(null)
      }
    } catch (err) {
      console.error('Klinik silme hatası:', err)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  async function handleApprove(clinicId: string) {
    try {
      await approveClinic(clinicId)
      setPendingClinics((prev) => prev.filter((c) => c.id !== clinicId))
      fetchClinics()
    } catch (err) {
      console.error('Klinik onaylama hatası:', err)
    }
  }

  return (
    <div className="p-4 pb-20 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Kliniklerim</h1>
        <div className="flex gap-2">
          <ImportScheduleDialog />
          <CreateClinicDialog onSubmit={handleCreate} />
        </div>
      </div>

      {selectedId && (
        <p className="text-xs text-muted-foreground">
          Seçili klinik:{' '}
          <Badge variant="outline" className="text-[10px]">
            {myClinics.find((c) => c.id === selectedId)?.name ?? selectedId}
          </Badge>
        </p>
      )}

      {/* Kliniklerim */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Kliniklerim</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Yükleniyor...
            </p>
          ) : (
            <ClinicList
              clinics={myClinics}
              selectedId={selectedId}
              onSelect={handleSelect}
              showDelete
              onDelete={(id) => setDeleteTarget(id)}
              emptyMessage="Henüz klinik oluşturmadınız."
            />
          )}
        </CardContent>
      </Card>

      {/* Onay Bekleyenler */}
      {pendingClinics.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">
              Onay Bekleyenler ({pendingClinics.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClinicList
              clinics={pendingClinics}
              selectedId={selectedId}
              onSelect={handleSelect}
              showApprove
              onApprove={handleApprove}
              emptyMessage="Bekleyen klinik yok."
            />
          </CardContent>
        </Card>
      )}
      {/* Silme onay dialogu */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-background p-5 space-y-4 shadow-lg">
            <h3 className="text-sm font-semibold">Kliniği Sil</h3>
            <p className="text-sm text-muted-foreground">
              <strong>{myClinics.find((c) => c.id === deleteTarget)?.name}</strong> kliniğini
              silmek istediğinize emin misiniz? Bu işlem geri alınamaz. Tüm asistan ve alan verileri silinecek.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                İptal
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
