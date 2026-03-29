import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { callAutoMatchResident, callJoinClinicByCode } from '@/services/admin-service'

const INPUT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function JoinClinic() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const [autoLoading, setAutoLoading] = useState(true)
  const [autoResult, setAutoResult] = useState<string | null>(null)

  const [hospitalCode, setHospitalCode] = useState('')
  const [residentCode, setResidentCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Otomatik eşleştirme dene
  useEffect(() => {
    let cancelled = false
    async function tryAutoMatch() {
      try {
        const res = await callAutoMatchResident()
        if (cancelled) return
        if (res.ok && res.clinicName) {
          setAutoResult(`Kliniğiniz bulundu: ${res.clinicName}`)
          setTimeout(() => {
            if (!cancelled) window.location.reload()
          }, 1500)
        } else {
          setAutoResult(null)
        }
      } catch {
        if (!cancelled) setAutoResult(null)
      } finally {
        if (!cancelled) setAutoLoading(false)
      }
    }
    tryAutoMatch()
    return () => { cancelled = true }
  }, [navigate])

  async function handleJoin() {
    const hCode = hospitalCode.trim()
    const rCode = residentCode.trim()
    if (!hCode || !rCode) return

    setError(null)
    setSuccess(null)
    setJoining(true)
    try {
      const res = await callJoinClinicByCode(hCode, rCode)
      if (res.ok) {
        setSuccess(res.clinicName ? `Katıldınız: ${res.clinicName}` : 'Kliniğe katıldınız!')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setError(res.message ?? 'Katılım başarısız. Kodları kontrol edin.')
      }
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            Acil<span className="text-primary">X</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Hoş geldiniz{profile?.displayName ? `, ${profile.displayName}` : ''}!
            <br />Kliniğinize katılmanız gerekiyor.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Otomatik eşleştirme */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Otomatik Eşleştirme</p>
            {autoLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">Eşleştirme deneniyor…</span>
              </div>
            ) : autoResult ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">{autoResult}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Otomatik eşleşme bulunamadı. Aşağıdan manuel katılabilirsiniz.
              </p>
            )}
          </div>

          {/* Ayırıcı */}
          {!autoResult && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">veya</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Manuel katılım formu */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Klinik Kodu
                  </label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    placeholder="Hastane kodu"
                    value={hospitalCode}
                    onChange={(e) => setHospitalCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Kişisel Kod
                  </label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    placeholder="Size verilen kod"
                    value={residentCode}
                    onChange={(e) => setResidentCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 p-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <p className="text-xs text-green-700">{success}</p>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleJoin}
                  disabled={joining || !hospitalCode.trim() || !residentCode.trim()}
                >
                  {joining ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {joining ? 'Katılınıyor…' : 'Katıl'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
