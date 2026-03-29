import { useState, useRef, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { FileUp, Loader2, Check, X, Upload, Building2 } from 'lucide-react'
import { callImportFromSchedule } from '@/services/admin-service'
import { useScheduleStore } from '@/stores/schedule-store'
import { useAuthStore } from '@/stores/auth-store'
import { listMyClinics, type Clinic } from '@/services/clinic-service'
import type { Seniority } from '@/types/schedule'

interface ImportedResident {
  name: string
  pgy: number
  selected: boolean
}

interface ImportedZone {
  name: string
  selected: boolean
}

type Step = 'upload' | 'loading' | 'review' | 'error'

const ZONE_COLORS = [
  '#22c55e', '#eab308', '#ef4444', '#3b82f6', '#a855f7',
  '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#84cc16',
]

export default function ImportScheduleDialog() {
  const { residents, zones, state, groupId, setGroupId, setResidents, setZones, setState, saveResidents, saveZones } =
    useScheduleStore()
  const { user } = useAuthStore()

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const [error, setError] = useState('')
  const [importedResidents, setImportedResidents] = useState<ImportedResident[]>([])
  const [importedZones, setImportedZones] = useState<ImportedZone[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [selectedClinicId, setSelectedClinicId] = useState(groupId || '')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !user?.uid) return
    listMyClinics(user.uid).then((list) => {
      setClinics(list)
      if (!selectedClinicId && list.length > 0) {
        setSelectedClinicId(list[0].id)
      }
    })
  }, [open, user?.uid])

  function reset() {
    setStep('upload')
    setError('')
    setImportedResidents([])
    setImportedZones([])
    setPreview(null)
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset()
    setOpen(o)
  }

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError('Dosya 10MB\'dan küçük olmalı.')
      setStep('error')
      return
    }

    setStep('loading')

    try {
      const base64 = await fileToBase64(file)
      setPreview(file.type.startsWith('image/') ? `data:${file.type};base64,${base64}` : null)

      const result = await callImportFromSchedule(base64, file.type)

      if (!result.ok || !result.residents) {
        setError(result.message || 'Dosyadan veri çıkarılamadı.')
        setStep('error')
        return
      }

      setImportedResidents(result.residents.map((r) => ({ ...r, selected: true })))
      setImportedZones((result.zones || []).map((z) => ({ ...z, selected: true })))
      setStep('review')
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  function toggleResident(idx: number) {
    setImportedResidents((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)),
    )
  }

  function toggleZone(idx: number) {
    setImportedZones((prev) =>
      prev.map((z, i) => (i === idx ? { ...z, selected: !z.selected } : z)),
    )
  }

  function updatePgy(idx: number, pgy: number) {
    setImportedResidents((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, pgy } : r)),
    )
  }

  function handleConfirm() {
    const uid = user?.uid

    // ── Seçilen kliniğe geç ──
    if (selectedClinicId && selectedClinicId !== groupId) {
      setGroupId(selectedClinicId)
    }

    // ── Asistanları toplu ekle ──
    const selectedResidents = importedResidents.filter((r) => r.selected)
    if (selectedResidents.length > 0) {
      let list = [...residents]
      for (const r of selectedResidents) {
        const maxId = list.reduce((max, res) => Math.max(max, res.id), -1)
        list = [...list, { id: maxId + 1, name: r.name, kidem: (r.pgy || 1) as Seniority }]
      }
      setResidents(list)
      if (uid) saveResidents(uid)
    }

    // ── Alanları toplu ekle ──
    const selectedZones = importedZones.filter((z) => z.selected)
    if (selectedZones.length > 0) {
      let zoneList = [...zones]
      let ddm = { ...state.defaultDayMin }
      let mn = { ...state.minNobet }
      let qt = { ...state.quota }

      for (let i = 0; i < selectedZones.length; i++) {
        const z = selectedZones[i]
        const id = `zone_${Date.now()}_${i}`
        const color = ZONE_COLORS[zoneList.length % ZONE_COLORS.length]
        zoneList = [...zoneList, { id, name: z.name, color }]
        ddm = {
          ...ddm,
          [id]: {
            min: 1,
            max: 2,
            kidemMin: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            kidemMax: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            kidemKurallari: {},
            siftler: ['24h'],
          },
        }
        mn = { ...mn, [id]: { 1: 1, 2: 1, 3: 1, 4: 0, 5: 0 } }
        qt = { ...qt, [id]: { 1: 5, 2: 5, 3: 4, 4: 3, 5: 2 } }
      }

      setZones(zoneList)
      setState({ defaultDayMin: ddm, minNobet: mn, quota: qt })
      if (uid) saveZones(uid)
    }

    setOpen(false)
    reset()
  }

  const selectedCount = importedResidents.filter((r) => r.selected).length
  const zoneCount = importedZones.filter((z) => z.selected).length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <FileUp className="h-4 w-4 mr-1" />
            Listeden Aktar
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nöbet Listesinden İçe Aktar</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'PDF veya resim yükleyin, asistanlar ve alanlar otomatik çıkarılsın.'}
            {step === 'loading' && 'Dosya analiz ediliyor...'}
            {step === 'review' && 'Çıkarılan verileri kontrol edin, onaylayın.'}
            {step === 'error' && 'Bir hata oluştu.'}
          </DialogDescription>
        </DialogHeader>

        {/* Upload */}
        {step === 'upload' && (
          <div className="space-y-3">
            {/* Klinik seçimi */}
            {clinics.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  Hedef Klinik
                </label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                >
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {clinics.length === 0 && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                Henüz klinik oluşturmadınız. Önce bir klinik ekleyin.
              </div>
            )}

            {/* Dosya yükleme */}
            <div
              className={`border-2 border-dashed border-border rounded-lg p-8 text-center transition-colors ${
                clinics.length > 0 ? 'cursor-pointer hover:border-primary/50' : 'opacity-50 pointer-events-none'
              }`}
              onClick={() => clinics.length > 0 && fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Dosya seçmek için tıklayın</p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, JPG, PNG — maks 10MB
              </p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
            </div>
          </div>
        )}

        {/* Loading */}
        {step === 'loading' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              AI nöbet listesini okuyor...
            </p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
            <Button variant="outline" onClick={reset} className="w-full">
              Tekrar Dene
            </Button>
          </div>
        )}

        {/* Review */}
        {step === 'review' && (
          <div className="space-y-4">
            {preview && (
              <img
                src={preview}
                alt="Yüklenen dosya"
                className="w-full rounded-lg border border-border max-h-40 object-contain"
              />
            )}

            {/* Asistanlar */}
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Asistanlar ({selectedCount}/{importedResidents.length})
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {importedResidents.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      r.selected ? 'bg-primary/10' : 'bg-muted/30 opacity-50'
                    }`}
                  >
                    <button onClick={() => toggleResident(i)} className="shrink-0">
                      {r.selected ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <span className="flex-1 truncate">{r.name}</span>
                    <select
                      className="w-20 rounded border border-border bg-background px-1 py-0.5 text-xs"
                      value={r.pgy}
                      onChange={(e) => updatePgy(i, Number(e.target.value))}
                    >
                      <option value={0}>PGY-?</option>
                      {[1, 2, 3, 4, 5].map((y) => (
                        <option key={y} value={y}>PGY-{y}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Alanlar */}
            {importedZones.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Alanlar ({zoneCount}/{importedZones.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {importedZones.map((z, i) => (
                    <Badge
                      key={i}
                      variant={z.selected ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleZone(i)}
                    >
                      {z.selected ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                      {z.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'review' && (
          <DialogFooter>
            <DialogClose render={<Button variant="outline">İptal</Button>} />
            <Button onClick={handleConfirm} disabled={(selectedCount === 0 && zoneCount === 0) || !selectedClinicId}>
              {selectedCount} Asistan + {zoneCount} Alan Aktar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
