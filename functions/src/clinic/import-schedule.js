/**
 * PDF/Resim'den nöbet listesi verisi çıkarma
 * Claude API (Vision) ile asistan isimleri, PGY ve zone'ları otomatik parse eder
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Anthropic = require('@anthropic-ai/sdk').default;
const { refs } = require('../utils/firestore');

const anthropicKey = defineSecret('ANTHROPIC_API_KEY');

const EXTRACTION_PROMPT = `Bu bir hastane acil servis nöbet çizelgesi. Lütfen bu görüntüden şu bilgileri çıkar ve JSON formatında döndür:

1. **residents**: Tüm asistanların listesi. Her biri için:
   - "name": Tam adı (ad soyad)
   - "pgy": Kıdem yılı (PGY/yıl bilgisi varsa sayı olarak, yoksa 0)

2. **zones**: Tüm nöbet alanlarının listesi. Her biri için:
   - "name": Alan adı (örn: "Yeşil Alan", "Sarı Alan", "Kırmızı Alan", "Resüs", "Triaj" vb.)

Kurallar:
- Sadece JSON döndür, başka metin yazma
- Tekrar eden isimleri bir kez yaz
- Alan adlarını standartlaştır (kısaltmaları aç)
- PGY bilgisi yoksa 0 yaz
- Türkçe karakter kullan (ı, ş, ç, ğ, ü, ö)

Beklenen format:
{
  "residents": [
    { "name": "Ad Soyad", "pgy": 3 }
  ],
  "zones": [
    { "name": "Alan Adı" }
  ]
}`;

exports.importFromSchedule = onCall(
  { secrets: [anthropicKey], timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
    }

    // Sadece super_admin ve chief_resident kullanabilir
    const userSnap = await refs.user(request.auth.uid).get();
    if (!userSnap.exists) throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');
    const role = userSnap.data().role;
    if (role !== 'super_admin' && role !== 'chief_resident') {
      throw new HttpsError('permission-denied', 'Bu özellik sadece yöneticiler içindir.');
    }

    const { imageBase64, mimeType } = request.data;
    if (!imageBase64) {
      throw new HttpsError('invalid-argument', 'Görüntü verisi gerekli.');
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const mime = mimeType || 'image/jpeg';
    if (!validTypes.includes(mime)) {
      throw new HttpsError('invalid-argument', `Desteklenmeyen dosya türü: ${mime}`);
    }

    try {
      const client = new Anthropic({ apiKey: anthropicKey.value() });

      // PDF → document bloku, resim → image bloku
      const fileBlock = mime === 'application/pdf'
        ? {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: imageBase64,
            },
          }
        : {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mime,
              data: imageBase64,
            },
          };

      const content = [fileBlock, { type: 'text', text: EXTRACTION_PROMPT }];

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');

      // JSON parse — Claude bazen ```json ... ``` ile sarar
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new HttpsError('internal', 'AI yanıtından JSON çıkarılamadı.');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Temel doğrulama
      if (!Array.isArray(parsed.residents) || !Array.isArray(parsed.zones)) {
        throw new HttpsError('internal', 'AI yanıtı beklenen formatta değil.');
      }

      return {
        residents: parsed.residents.map((r) => ({
          name: String(r.name || '').trim(),
          pgy: Number(r.pgy) || 0,
        })),
        zones: parsed.zones.map((z) => ({
          name: String(z.name || '').trim(),
        })),
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('importFromSchedule hatası:', err);
      throw new HttpsError('internal', `İçe aktarma hatası: ${err.message}`);
    }
  }
);
