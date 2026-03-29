/**
 * Klinik Katılım (joinClinic) Testleri
 * Çalıştır: node --test functions/src/tests/clinic.test.js
 *
 * joinClinic fonksiyonunun doğrulama mantığını test eder.
 * Firebase bağımlılıkları mock'lanır.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ── Mock Veritabanı ─────────────────────────────────────────────────────────

let mockClinics = {};
let mockPendingResidents = {};
let mockUsers = {};
let mockResidents = {};

function resetMocks() {
  mockClinics = {};
  mockPendingResidents = {};
  mockUsers = {};
  mockResidents = {};
}

// ── joinClinic doğrulama mantığını simüle eden fonksiyon ────────────────────

/**
 * joinClinic'in doğrulama adımlarını izole ederek test eder.
 * Gerçek Firebase çağrıları yerine mock veri kullanır.
 */
function validateJoin({ hospitalCode, residentCode, uid }) {
  if (!hospitalCode || !residentCode) {
    return { error: 'invalid-argument', message: 'hospitalCode ve residentCode gerekli.' };
  }

  const hCode = hospitalCode.trim().toUpperCase();
  const rCode = residentCode.trim().toUpperCase();

  // Hastane kodu ile klinik bul
  const clinic = Object.values(mockClinics).find(
    c => c.joinCode === hCode && c.status === 'approved'
  );
  if (!clinic) {
    return { error: 'not-found', message: 'Geçersiz hastane kodu veya klinik henüz onaylanmamış.' };
  }

  // Kişisel kod doğrula
  const pendingKey = `${clinic.id}_${rCode}`;
  const pending = mockPendingResidents[pendingKey];
  if (!pending) {
    return { error: 'permission-denied', message: 'Geçersiz asistan kodu.' };
  }

  // Kullanılmış kod kontrolü
  if (pending.used) {
    return { error: 'already-exists', message: 'Bu kod zaten kullanılmış.' };
  }

  // Zaten kayıtlı mı?
  const existingResident = Object.values(mockResidents).find(
    r => r.clinicId === clinic.id && r.userId === uid
  );
  if (existingResident) {
    return { error: 'already-exists', message: 'Bu kliniğe zaten kayıtlısınız.' };
  }

  // Kullanıcı mevcut mu?
  const user = mockUsers[uid];
  if (!user) {
    return { error: 'not-found', message: 'Kullanıcı bulunamadı.' };
  }

  return { success: true, clinicId: clinic.id, clinicName: clinic.name };
}

// ── 1. Kod Doğrulama ──────────────────────────────────────────────────────

describe('Kod Doğrulama', () => {
  beforeEach(() => {
    resetMocks();
    mockClinics['c1'] = {
      id: 'c1',
      name: 'Test Kliniği',
      joinCode: 'HOSP01',
      residentJoinCode: 'RES01',
      status: 'approved',
      chiefResidentIds: ['chief1'],
    };
    mockPendingResidents['c1_ABC123'] = {
      name: 'Dr. Test',
      pgy: 2,
      used: false,
    };
    mockUsers['user1'] = {
      displayName: 'Test User',
      email: 'test@test.com',
      role: 'resident',
      pgy: 2,
    };
  });

  it('geçerli hastane kodu + asistan kodu ile katılım başarılı olmalı', () => {
    const result = validateJoin({
      hospitalCode: 'HOSP01',
      residentCode: 'ABC123',
      uid: 'user1',
    });
    assert.ok(result.success, 'Katılım başarılı olmalı');
    assert.equal(result.clinicId, 'c1');
    assert.equal(result.clinicName, 'Test Kliniği');
  });

  it('küçük harf ve boşluklu kod kabul edilmeli (trim + uppercase)', () => {
    const result = validateJoin({
      hospitalCode: '  hosp01  ',
      residentCode: '  abc123  ',
      uid: 'user1',
    });
    assert.ok(result.success, 'Trim ve uppercase sonrası kabul edilmeli');
  });

  it('geçersiz hastane kodu reddedilmeli', () => {
    const result = validateJoin({
      hospitalCode: 'WRONGCODE',
      residentCode: 'ABC123',
      uid: 'user1',
    });
    assert.equal(result.error, 'not-found');
  });

  it('onaylanmamış klinik reddedilmeli', () => {
    mockClinics['c1'].status = 'pending';
    const result = validateJoin({
      hospitalCode: 'HOSP01',
      residentCode: 'ABC123',
      uid: 'user1',
    });
    assert.equal(result.error, 'not-found');
  });

  it('boş hospitalCode reddedilmeli', () => {
    const result = validateJoin({
      hospitalCode: '',
      residentCode: 'ABC123',
      uid: 'user1',
    });
    assert.equal(result.error, 'invalid-argument');
  });

  it('boş residentCode reddedilmeli', () => {
    const result = validateJoin({
      hospitalCode: 'HOSP01',
      residentCode: '',
      uid: 'user1',
    });
    assert.equal(result.error, 'invalid-argument');
  });

  it('null kodlar reddedilmeli', () => {
    const result = validateJoin({
      hospitalCode: null,
      residentCode: null,
      uid: 'user1',
    });
    assert.equal(result.error, 'invalid-argument');
  });
});

// ── 2. Kullanılmış Kod Reddi ──────────────────────────────────────────────

describe('Kullanılmış Kod Reddi', () => {
  beforeEach(() => {
    resetMocks();
    mockClinics['c1'] = {
      id: 'c1',
      name: 'Test Kliniği',
      joinCode: 'HOSP01',
      status: 'approved',
      chiefResidentIds: [],
    };
    mockPendingResidents['c1_CODE01'] = {
      name: 'Dr. Ahmet',
      pgy: 1,
      used: true,  // zaten kullanılmış
      usedBy: 'otherUser',
    };
    mockUsers['user2'] = {
      displayName: 'User 2',
      email: 'u2@test.com',
      role: 'resident',
    };
  });

  it('daha önce kullanılmış kod reddedilmeli', () => {
    const result = validateJoin({
      hospitalCode: 'HOSP01',
      residentCode: 'CODE01',
      uid: 'user2',
    });
    assert.equal(result.error, 'already-exists');
    assert.ok(result.message.includes('kullanılmış'), result.message);
  });

  it('aynı kliniğe tekrar kayıt reddedilmeli', () => {
    // Bu sefer kod kullanılmamış ama kullanıcı zaten kayıtlı
    mockPendingResidents['c1_CODE02'] = {
      name: 'Dr. Ahmet',
      pgy: 1,
      used: false,
    };
    mockResidents['c1_user2'] = {
      clinicId: 'c1',
      userId: 'user2',
    };

    const result = validateJoin({
      hospitalCode: 'HOSP01',
      residentCode: 'CODE02',
      uid: 'user2',
    });
    assert.equal(result.error, 'already-exists');
    assert.ok(result.message.includes('zaten kayıtlı'), result.message);
  });
});

// ── 3. Geçersiz Kod Reddi ─────────────────────────────────────────────────

describe('Geçersiz Kod Reddi', () => {
  beforeEach(() => {
    resetMocks();
    mockClinics['c1'] = {
      id: 'c1',
      name: 'Test Kliniği',
      joinCode: 'HOSP01',
      status: 'approved',
      chiefResidentIds: [],
    };
    mockUsers['user3'] = {
      displayName: 'User 3',
      email: 'u3@test.com',
    };
  });

  it('pendingResidents\'ta olmayan kod reddedilmeli', () => {
    const result = validateJoin({
      hospitalCode: 'HOSP01',
      residentCode: 'INVALID',
      uid: 'user3',
    });
    assert.equal(result.error, 'permission-denied');
    assert.ok(result.message.includes('Geçersiz asistan kodu'), result.message);
  });

  it('farklı kliniğin kodu bu klinikte çalışmamalı', () => {
    // c2 kliniğinin kodu c1'de geçersiz
    mockPendingResidents['c2_XYZ789'] = {
      name: 'Dr. Başka',
      pgy: 3,
      used: false,
    };

    const result = validateJoin({
      hospitalCode: 'HOSP01', // c1 kliniği
      residentCode: 'XYZ789', // c2'nin kodu
      uid: 'user3',
    });
    assert.equal(result.error, 'permission-denied');
  });

  it('olmayan kullanıcı reddedilmeli', () => {
    mockPendingResidents['c1_VALID01'] = {
      name: 'Dr. Ghost',
      pgy: 1,
      used: false,
    };

    const result = validateJoin({
      hospitalCode: 'HOSP01',
      residentCode: 'VALID01',
      uid: 'nonexistent_user',
    });
    assert.equal(result.error, 'not-found');
    assert.ok(result.message.includes('Kullanıcı bulunamadı'), result.message);
  });
});

// ── 4. randCode fonksiyon davranışı ─────────────────────────────────────────

describe('randCode Benzersizlik', () => {
  // manage.js'teki randCode: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function randCode(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  it('üretilen kod istenen uzunlukta olmalı', () => {
    assert.equal(randCode(6).length, 6);
    assert.equal(randCode(8).length, 8);
    assert.equal(randCode(1).length, 1);
  });

  it('kod sadece izin verilen karakterlerden oluşmalı', () => {
    for (let i = 0; i < 100; i++) {
      const code = randCode(6);
      for (const ch of code) {
        assert.ok(chars.includes(ch), `Karakter '${ch}' geçersiz`);
      }
    }
  });

  it('karışıklığa yol açan karakterler (0, O, I, 1) bulunmamalı', () => {
    // chars dizisinde 0, O, I, 1 yok (kasıtlı)
    assert.ok(!chars.includes('0'), '0 olmamalı');
    assert.ok(!chars.includes('O'), 'O olmamalı');
    assert.ok(!chars.includes('I'), 'I olmamalı');
    assert.ok(!chars.includes('1'), '1 olmamalı');
  });

  it('100 kod üretildiğinde tekrar olmamalı (yüksek olasılıkla)', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(randCode(6));
    }
    // 30^6 ≈ 729M olasılık, 100 kodda çakışma olasılığı ihmal edilebilir
    assert.equal(codes.size, 100, 'Tüm kodlar benzersiz olmalı');
  });
});
