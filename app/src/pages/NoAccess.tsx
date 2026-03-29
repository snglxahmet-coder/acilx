import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldX } from 'lucide-react'

export default function NoAccess() {
  return (
    <div className="flex items-center justify-center p-6 min-h-[60vh]">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <ShieldX size={40} className="mx-auto mb-2 text-destructive" />
          <CardTitle>Erişim Yetkiniz Yok</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Bu sayfaya erişim yetkiniz bulunmuyor. Lütfen yetkili bir hesapla giriş yapın.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
