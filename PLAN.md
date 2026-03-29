# ACİLX — Yol Haritasi & Ilerleme Takibi

> Bu dosya projenin asama bazli is planini ve ilerleme durumunu takip eder.
> PRD ("ne yapilacak") → bu dosya ("hangi sirayla, su an neredeyiz").
> Detayli gereksinimler icin: `AcilX_PRD.md`

---

## Mevcut Durum

**Aktif Asama:** Asama 7 kalan maddeler (gercek veri + test + go/no-go)
**Son Guncelleme:** 2026-03-29
**Hedef:** Mayis cizelgesi ACiLX'ten (Nisan sonu yayinlanir)

---

## Gecis Stratejisi: MedShift → ACiLX

### Vizyon
ACiLX'i MedShift'in yerini alacak sekilde kliniğe sunmak. "Nobet sistemini yeniledim" algisiyla purussuz gecis. Asistanlar yeni uygulama degil, guncelleme olarak algilamalı.

### Temel Deger Onerisi
"Tek tusla ay hazir" — MedShift'teki manuel duzenleme zahmetini ortadan kaldirmak.

### Gecis Yaklasimi
**Buyuk Patlama** — tek seferde gecis, MedShift yedek olarak durur.

### Onboarding Akisi

**Basasistan onceden yapar:**
1. Tum asistanlari isimleriyle ACiLX'e ekler
2. Zone'lari, PGY bilgilerini girer
3. Tercih donemini acar

**Asistanin deneyimi (~10 saniye):**
1. WhatsApp grubuna mesaj: "Nobet sistemini yeniledim, tercihlerinizi buradan girin" + link
2. Linke tiklar → ACiLX acilir
3. "Google ile Giris" butonuna basar
4. Adi ve klinigi hazir gorunur
5. Tercih ekrani karsilar → tercihlerini girer

**Asistanin yapMAyacagi seyler:**
- Kayit formu doldurmak
- Klinik kodu girmek
- Davetiye kabul etmek
- Profil bilgisi girmek

### Iletisim Plani

**Tercih acilinca (~15-18 Nisan):**
> "Merhaba, nobet tercih sistemini yeniledim. Artik buradan gireceksiniz. Google hesabinizla giris yapin, tercihlerinizi girin" + link

**Cizelge yayinlaninca (~30 Nisan):**
> "Mayis nobet listesi yayinlandi, ayni yerden bakabilirsiniz" + link

**Olasi sorulara cevap:**
- "MedShift ne oldu?" → "Artik buradan yonetiyoruz, daha pratik"
- "Bu ne uygulamasi?" → "Nobet sistemimiz, Google ile gir yeter"

### Gecis Takvimi

```
28-31 Mart         → Asama 4A tamamla + 4 QA
1-5 Nisan          → Asama 5 (3 rol paneli React'e tasima)
5-8 Nisan          → Asama 6 (PWA config + deploy)
8-10 Nisan         → Gercek veri girisi (asistanlar, zone'lar, PGY)
10-12 Nisan        → Test — MedShift Nisan verisiyle karsilastir
12-15 Nisan        → Bug duzeltme buffer
15-18 Nisan        → Tercih donemini ac, asistanlara link gonder
18-28 Nisan        → Asistanlar tercih girer
28-30 Nisan        → Cizelge uret, yayinla
1 Mayis            → ACiLX aktif
```

### Go/No-Go Karar Noktasi: 12 Nisan
- Test sonuclari iyiyse → devam
- Ciddi sorun varsa → Mayis MedShift'le, Haziran'a ertele
- Bu karari sadece basasistan verir, asistanlar habersiz, prestij kaybi sifir

### Risk Yonetimi

| Risk | Etki | Onlem | Geri Donus |
|------|------|-------|------------|
| Cizelge uretimi hatali | Yuksek | MedShift Nisan verisiyle karsilastirmali test | MedShift'le Mayis cizelgesi hazirla |
| Google Auth eslestirme sorunu | Yuksek | 8-10 Nisan'da kendi tel + 1-2 asistanla test | Manuel eslestirme butonu ekle |
| PWA mobilde duzgun calismiyor | Orta | Asama 6'da iPhone + Android test zorunlu | Responsive web olarak calisir |
| Asistanlar tercih girmiyor | Dusuk | WhatsApp'ta 2-3 hatirlatma | Basasistan hatirlatir |

### Karar Gunlugu

| # | Karar | Alternatifler | Neden Bu |
|---|-------|--------------|----------|
| 1 | ACiLX kendi markasiyla cikar, "yeniledim" soylemiyle | MedShift taklidi / "guncellendi" yalani | Yasal risk yok, marka olusur, guven korunur |
| 2 | Buyuk Patlama gecisi (tek seferde) | Golge calistirma / Kademeli | Basit, inandirici, MedShift yedek olarak durur |
| 3 | Mayis cizelgesi hedef (~18 Nisan tercih, ~30 Nisan yayin) | Haziran'a erteleme | Takvim uygun, 4A zaten bitmek uzere |
| 4 | Asistanlari basasistan onceden ekler, Google Auth ile eslesir | JoinCode sistemi | "Kayit oluyorum" hissi sifir |
| 5 | WhatsApp ile "yeniledim" mesaji | Email / duyuru / toplanti | Herkesin kullandigi kanal, kisa ve otoriter |
| 6 | 12 Nisan go/no-go karari | Kesin tarih yok | Asistanlar habersiz, prestij kaybi sifir |

---

## Tamamlanan Asamalar

### ~~ASAMA 1: React Proje Altyapisi~~ ✅
- ~~Vite + React + TypeScript kurulumu~~
- ~~Tailwind CSS + shadcn/ui entegrasyonu~~
- ~~Firebase SDK entegrasyonu (Auth, Firestore, Functions)~~
- ~~Zustand state management kurulumu~~
- ~~ESLint + TypeScript config~~
- ~~Proje klasor yapisi (pages/, components/, stores/, lib/, types/)~~

### ~~ASAMA 2: Tasarim Sistemi~~ ✅
- ~~Tailwind tema token'lari (PRD §9 renk paleti)~~
- ~~Dark mode varsayilan tema (CSS degiskenleri)~~
- ~~Inter font + mono font entegrasyonu~~
- ~~8px grid spacing sistemi~~
- ~~shadcn/ui bilesenleri (badge, button, card, dialog, sheet, tabs)~~
- ~~Lucide icon seti~~

### ~~ASAMA 3: Auth + Routing + Layout Shell~~ ✅
- ~~Zustand auth-store (Firebase Auth listener + Firestore profil)~~
- ~~React Router yapisi~~
- ~~Role-based layout shell~~
- ~~Login sayfasi (email + sifre)~~

### ~~ASAMA 4: Nobet Is Mantigi + UI Bilesenleri~~ ✅
- ~~Takvim grid bileseni~~
- ~~Gun detay paneli~~
- ~~Asistan/alan listesi gorunumleri~~
- ~~Vanilla JS modullerinden React store/hook/lib'e tasima~~
- ~~Schedule store (Zustand)~~
- ~~Firestore real-time listeners~~
- ~~Mufettis kontrolu + birlestirme~~

### ~~ASAMA 5: 3 Rol Paneli~~ ✅ (28 Mart 2026)
- ~~5A: Resident Paneli — Dashboard, Schedule, Preferences, Profile~~
- ~~5B: Admin (chief_resident) Paneli — Residents, Zones, Swaps~~
- ~~5B: Super Admin Paneli — Clinics, klinik secimi + yonetim~~
- ~~**NOT:** CalendarGrid/ShiftList/DayCell mock-data notu~~ ✅ Kontrol edildi (29 Mart) — mock yok, tum bilesenler Firestore'dan gercek veriyle calisiyor

### ~~REFACTOR: 30+ satir fonksiyonlar~~ ✅ (28 Mart 2026)
- ~~Kod inceleme standartlarina gore uzun fonksiyonlar parcalandi~~

### ~~ASAMA 6: PWA Config + Deploy~~ ✅ (28 Mart 2026)
- ~~Service worker React build'e entegre (vite-plugin-pwa + workbox)~~
- ~~manifest.json React app'e taşındı~~
- ~~PWA meta tag'leri (apple-mobile-web-app vb.)~~
- ~~Offline fallback sayfasi (workbox navigateFallback)~~
- ~~Firebase Hosting config (public-react, SPA rewrites, cache headers)~~
- ~~Mufettis final QA kontrolu~~
- ~~Code-splitting: 819KB tek chunk → max 349KB (firebase/react/ui/app)~~
- ~~Deploy: firebase deploy --only hosting → canli: acilx-d3635.web.app~~

---

## Mobil Bug & UX Duzeltmeleri (Oncelikli — Asama 5B/6 ile paralel)

> Kaynak: Kullanici testi (28 Mart 2026)

### ~~Buglar~~ ✅ (29 Mart 2026)
- [x] **Alt bar kayma:** `pb-[env(safe-area-inset-bottom)]` eklendi (BottomNav.tsx)
- [x] **Pinch-to-zoom:** viewport meta `maximum-scale=1.0, user-scalable=no, viewport-fit=cover` eklendi (app/index.html)
- [x] **Ust bar kesiliyor:** `pt-[env(safe-area-inset-top)]` eklendi (ProtectedLayout.tsx)
- [x] **Tercih donemi kapali iken tercih giriliyor:** Buton + handleSave + grid disabled, kapali uyari banner eklendi (Preferences.tsx)
- [x] **Google ile giris gorunmuyor:** signInWithGoogle (popup+redirect fallback) + Google butonu eklendi (auth-store.ts, Login.tsx)
- [x] **autoMatch/joinClinic alan uyusmazligi:** CF `matched`/response vs client `ok` — admin-service.ts'te mapping duzeltildi (29 Mart 2026)

### ~~UX Iyilestirmeleri — Takas Akisi Yeniden Tasarim~~ ✅ (29 Mart 2026)
- [x] **"Takas talebi olustur" butonu kaldirildi** — SwapCreateDialog Schedule.tsx'ten cikarildi
- [x] **Takvimde takas akisi:** Kendi nobetine tikla → SwapMatchSheet acilir → checkSwapEligibility ile kural uyumlu eslesmeler listelenir
- [x] **Baskalarinin nobetlerinde takas rozeti:** DayCell'de ↔ rozeti (swapAvailable && !isMyDay)
- [x] **Kural kontrolu:** Tum takas islemleri checkSwapEligibility() ile kontrol ediliyor (art arda, izin, doluluk, kidem)

---

## Siradaki Asamalar (Kritik Yol — Mayis Gecisi Icin)

### ~~Google Auth (Asama 6'dan kalan)~~ ✅ (29 Mart 2026)
**Ajanlar:** Usta + Kalipci + Mufettis

- [x] Google ile giris (OAuth 2.0) — Login.tsx + auth-store.ts (popup + redirect fallback)
- [x] Google email ile mevcut kullanici otomatik eslestirme — autoMatchResident CF + JoinClinic.tsx + AddResidentDialog email alani
- [ ] Test: install prompt, offline calisma

### ASAMA 7: Canliya Gecis + Migration (DEVAM EDİYOR)
**Ajanlar:** Mufettis → Tesisatci → Usta
**Hedef:** 8-15 Nisan
**Bagimlilik:** Asama 6 tamamlanmali ✅

- [x] Firebase Hosting config: React build'i serve et (Asama 6'da yapildi — public-react, SPA rewrites, cache headers)
- [x] Tum roller login → panel → islem akisi testi (29 Mart — Mufettis: 6 bug bulundu ve duzeltildi)
- [x] Domain ayari: app.acilx.org → Firebase Hosting (29 Mart — yayinda)
- [x] FCM push bildirimleri React'te (29 Mart — useNotifications hook, firebase-messaging-sw.js, foreground toast)
- [x] Firestore Security Rules son review (29 Mart — 4 guvenlik acigi duzeltildi)
- [ ] **Gercek veri girisi:** asistanlar, zone'lar, PGY (basasistan yapar)
- [ ] **Karsilastirmali test:** ACiLX cizelge vs MedShift Nisan cizelgesi
- [ ] **Go/No-Go karari (12 Nisan)**
- [ ] Tercih donemini ac, asistanlara WhatsApp'tan link gonder
- [ ] Cizelge uret, son duzenlemeler, yayinla (28-30 Nisan)

---

## Sonraki Asamalar (Gecis Sonrasi)

### ASAMA 8: Onboarding & UX Cilalama
**Ajanlar:** Kalipci + Boyaci + Usta
**PRD Ref:** §1.3, §1.16

- [ ] Splash screen (logo + slogan)
- [ ] Onboarding carousel (3-4 slayt)
- [ ] Apple ile giris
- [ ] Sifre sifirlama akisi
- [ ] Profil tamamlama ekrani (ad, soyad, unvan, kidem)
- [ ] Klinik secim ekrani (olustur / katil)
- [ ] Onay bekleme ekrani
- [ ] Bildirim tercihleri ayarlari
- [ ] Profil fotografi yukleme (Firebase Storage)

### ASAMA 9: Nobet Sistemi Eksik Parcalar
**Ajanlar:** Usta + Kalipci
**PRD Ref:** §1.8, §1.11, §1.12

- [ ] Nobet olusturma wizard UI (adim adim)
- [ ] Manuel duzenleme — surukle-birak nobet degistirme
- [ ] Adalet raporu ciktisi (hedef vs gerceklesen)
- [ ] Alan x kidem dagilim matrisi
- [ ] Sapma analizi (hedefe en uzak asistanlar)
- [ ] Swap 48 saat expired otomatik iptal (CF cron)
- [ ] Swap tarihi gecerse otomatik iptal
- [ ] Basasistan dogrudan manuel swap
- [ ] Takvimde bekleyen swap simgesi
- [ ] Klinik duyurusu olusturma + bildirimi

### ASAMA 10: Premium — Skor & Algoritmalar & Ilac
**Ajanlar:** Doktor → Profesor + Kalipci
**PRD Ref:** §1.13, §1.14, §1.15

- [ ] Skor listesi sayfasi (arama + filtreleme)
- [ ] 15 skor hesaplayici (HEART, Wells, CURB-65, GCS, qSOFA, NIHSS, APACHE II, CHA2DS2-VASc, HAS-BLED, ABCD2, Ottawa, Ranson, PERC, C-Spine, Alvarado)
- [ ] Her skorda kaynak referansi + disclaimer
- [ ] Algoritma listesi sayfasi
- [ ] Ilk 5 algoritma (gogus agrisi, dispne, akut karin, travma ABCDE, ACLS)
- [ ] Ilac doz hesaplayici (ACLS, RSI, analjezik, sedatif, antidot, vazoaktif, pediatrik, antibiyotik)

### ASAMA 11: Odeme Sistemi + Paywall
**Ajanlar:** Usta + Kalipci + Hukukcu
**PRD Ref:** §2.7, §17.4, §18

- [ ] Plan secim sayfasi (aylik / yillik)
- [ ] Web: Stripe veya iyzico entegrasyonu
- [ ] Premium icerik paywall mekanizmasi
- [ ] Abonelik yonetim sayfasi
- [ ] KVKK gizlilik politikasi + kullanim sartlari
- [ ] Disclaimer metinleri (tibbi sorumluluk reddi)

### ASAMA 12: Icerik & Egitim (PRD Faz 2)
**Ajanlar:** Arastirmaci → Doktor → Profesor + Usta + Kalipci
**PRD Ref:** §2.1-2.6

- [ ] Turkce makale ozetleri sistemi + Claude API pipeline
- [ ] Kilavuz guncelleme modulu
- [ ] Tintinalli egitim notlari (ilk bolumler)
- [ ] Vaka simulasyonlari — ilk 10
- [ ] Kalan 7 interaktif algoritma
- [ ] AI icerik pipeline (ceviri + ozetleme + editor kuyruk)

### ASAMA 13: Kariyer & Gelisim (PRD Faz 3)
**Ajanlar:** Kalipci + Usta + Doktor
**PRD Ref:** §3.1-3.5

- [ ] Logbook (girisimsel yetkinlik takibi + PDF export)
- [ ] Akademik ders takibi + PDF export
- [ ] Burnout yonetim araclari (Maslach anketi, stres, meditasyon)
- [ ] Sosyal aktiviteler (etkinlik olusturma/katilma)
- [ ] Makale/tez yazarligi danismanlik rehberleri

### ASAMA 14: Magaza Yayini + Olcekleme (PRD Faz 4)
**Ajanlar:** Tesisatci + Usta + Esnaf + Gazeteci
**PRD Ref:** §4.1-4.7

- [ ] Capacitor ile iOS/Android sarmalama
- [ ] App Store + Play Store listing hazirlik
- [ ] iOS In-App Purchase + Android Play Billing
- [ ] Coklu klinik uyeligi (rotasyon/nakil)
- [ ] i18n altyapisi + Ingilizce ceviri
- [ ] Gelismis analytics dashboard
- [ ] Light mode tema
