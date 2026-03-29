import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

const FIREBASE_ERROR_TR: Record<string, string> = {
  'auth/invalid-credential': 'E-posta veya şifre hatalı.',
  'auth/invalid-email': 'Geçersiz e-posta adresi.',
  'auth/user-disabled': 'Bu hesap devre dışı bırakılmış.',
  'auth/user-not-found': 'Bu e-posta ile kayıtlı hesap bulunamadı.',
  'auth/wrong-password': 'Şifre hatalı.',
  'auth/too-many-requests': 'Çok fazla deneme yaptınız. Lütfen biraz bekleyin.',
  'auth/network-request-failed': 'Bağlantı hatası. İnternetinizi kontrol edin.',
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    const code = (error as { code: string }).code
    return FIREBASE_ERROR_TR[code] ?? 'Giriş yapılamadı. Lütfen tekrar deneyin.'
  }
  return 'Giriş yapılamadı. Lütfen tekrar deneyin.'
}

const INPUT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function Login() {
  const { user, loading, signIn, signInWithGoogle } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Yükleniyor…</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            Acil<span className="text-primary">X</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">Hesabınıza giriş yapın</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-input bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.2 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.1z"/>
              <path fill="#FBBC05" d="M10.5 28.6A14.8 14.8 0 019.5 24c0-1.6.3-3.2.8-4.6L2.4 13.3A23.8 23.8 0 000 24c0 3.8.9 7.4 2.5 10.6l8-6z"/>
              <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.6-5.9c-2 1.4-4.6 2.2-7.6 2.2-6.3 0-11.6-3.7-13.5-9l-8 6.1C6.5 42.6 14.6 48 24 48z"/>
            </svg>
            {googleLoading ? 'Google\'a yönlendiriliyor…' : 'Google ile Giriş Yap'}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">veya</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                E-posta
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="email"
                required
                className={INPUT_CLASS}
                placeholder="ornek@email.com"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Şifre
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={INPUT_CLASS}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
