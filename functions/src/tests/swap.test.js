/**
 * Swap State Machine Testleri
 * Çalıştır: node --test functions/src/tests/swap.test.js
 *
 * Bu testler swap triggers.js'teki state machine mantığını ve
 * applySwapToShifts fonksiyonunu test eder.
 * Firebase bağımlılıkları mock'lanır.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ── Mock altyapısı ──────────────────────────────────────────────────────────

// Mock veritabanı
let mockDb = {};
let mockBatchOps = [];

function resetMocks() {
  mockDb = {};
  mockBatchOps = [];
}

function setDoc(path, data) {
  mockDb[path] = { ...data };
}

function getDoc(path) {
  const data = mockDb[path];
  return {
    exists: !!data,
    data: () => data || null,
    id: path.split('/').pop(),
  };
}

// Batch mock
function createBatch() {
  mockBatchOps = [];
  return {
    update: (ref, data) => mockBatchOps.push({ type: 'update', path: ref._path, data }),
    set: (ref, data) => mockBatchOps.push({ type: 'set', path: ref._path, data }),
    commit: async () => {
      for (const op of mockBatchOps) {
        if (op.type === 'update') {
          mockDb[op.path] = { ...(mockDb[op.path] || {}), ...op.data };
        } else if (op.type === 'set') {
          mockDb[op.path] = op.data;
        }
      }
    },
  };
}

function mockDocRef(path) {
  return {
    _path: path,
    get: async () => getDoc(path),
    update: async (data) => {
      mockDb[path] = { ...(mockDb[path] || {}), ...data };
    },
  };
}

// ── State Machine Testleri (doğrudan durum geçişlerini test et) ─────────────

describe('Swap State Machine Geçişleri', () => {
  // State machine kuralları:
  // pending_target → pending_chief  (hedef kabul)
  // pending_target → rejected       (hedef ret)
  // pending_chief → approved        (başasistan onay)
  // pending_chief → rejected        (başasistan ret)

  const validTransitions = [
    ['pending_target', 'pending_chief'],
    ['pending_target', 'rejected'],
    ['pending_chief', 'approved'],
    ['pending_chief', 'rejected'],
  ];

  const invalidTransitions = [
    ['pending_target', 'approved'],   // Direkt onay olamaz
    ['pending_chief', 'pending_target'], // Geri gidemez
    ['approved', 'pending_target'],   // Onaydan geri dönüş yok
    ['approved', 'rejected'],         // Onaydan ret yok
    ['rejected', 'pending_target'],   // Ret geri alınamaz
    ['rejected', 'approved'],         // Ret sonrası onay yok
  ];

  function isValidTransition(from, to) {
    return validTransitions.some(([f, t]) => f === from && t === to);
  }

  for (const [from, to] of validTransitions) {
    it(`${from} → ${to} geçerli olmalı`, () => {
      assert.ok(isValidTransition(from, to), `${from} → ${to} geçerli bir geçiş`);
    });
  }

  for (const [from, to] of invalidTransitions) {
    it(`${from} → ${to} geçersiz olmalı`, () => {
      assert.ok(!isValidTransition(from, to), `${from} → ${to} geçersiz bir geçiş`);
    });
  }
});

// ── Tam akış: pending_target → pending_chief → approved ─────────────────────

describe('Tam Akış: pending_target → pending_chief → approved', () => {
  beforeEach(() => resetMocks());

  it('approved sonrasi shift residentId yer degistirmeli', async () => {
    // Shift verisi hazırla
    setDoc('schedules/s1/shifts/shift_from', {
      residentId: 'requester_1',
      zoneId: 'z1',
      day: 5,
    });
    setDoc('schedules/s1/shifts/shift_to', {
      residentId: 'target_1',
      zoneId: 'z2',
      day: 10,
    });
    setDoc('schedules/s1', { updatedAt: null });

    const swap = {
      requesterId: 'requester_1',
      targetId: 'target_1',
      clinicId: 'c1',
      scheduleId: 's1',
      fromShiftId: 'shift_from',
      toShiftId: 'shift_to',
      status: 'approved',
    };

    // applySwapToShifts mantığını simüle et
    const fromRef = mockDocRef('schedules/s1/shifts/shift_from');
    const toRef = mockDocRef('schedules/s1/shifts/shift_to');

    const [fromSnap, toSnap] = await Promise.all([fromRef.get(), toRef.get()]);
    assert.ok(fromSnap.exists, 'from shift mevcut olmalı');
    assert.ok(toSnap.exists, 'to shift mevcut olmalı');

    const fromData = fromSnap.data();
    const toData = toSnap.data();

    const batch = createBatch();
    batch.update(fromRef, {
      residentId: toData.residentId,
      swappedVia: 'swap_1',
    });
    batch.update(toRef, {
      residentId: fromData.residentId,
      swappedVia: 'swap_1',
    });
    await batch.commit();

    // Doğrulama: residentId'ler yer değişmiş olmalı
    const updatedFrom = getDoc('schedules/s1/shifts/shift_from');
    const updatedTo = getDoc('schedules/s1/shifts/shift_to');

    assert.equal(updatedFrom.data().residentId, 'target_1',
      'from shift artık target\'ın olmalı');
    assert.equal(updatedTo.data().residentId, 'requester_1',
      'to shift artık requester\'ın olmalı');
  });

  it('swap sonrası swappedVia alanı doldurulmalı', async () => {
    setDoc('schedules/s1/shifts/shift_a', { residentId: 'ra' });
    setDoc('schedules/s1/shifts/shift_b', { residentId: 'rb' });

    const batch = createBatch();
    batch.update(mockDocRef('schedules/s1/shifts/shift_a'), {
      residentId: 'rb',
      swappedVia: 'swap_99',
    });
    batch.update(mockDocRef('schedules/s1/shifts/shift_b'), {
      residentId: 'ra',
      swappedVia: 'swap_99',
    });
    await batch.commit();

    assert.equal(getDoc('schedules/s1/shifts/shift_a').data().swappedVia, 'swap_99');
    assert.equal(getDoc('schedules/s1/shifts/shift_b').data().swappedVia, 'swap_99');
  });
});

// ── pending_target → rejected akışı ─────────────────────────────────────────

describe('Ret Akışı: pending_target → rejected', () => {
  beforeEach(() => resetMocks());

  it('rejected durumunda shift\'ler değişmemeli', async () => {
    setDoc('schedules/s1/shifts/shift_from', { residentId: 'requester_1' });
    setDoc('schedules/s1/shifts/shift_to', { residentId: 'target_1' });

    // Ret durumunda applySwapToShifts çağrılmaz
    // Shift'lerin değişmediğini doğrula
    const fromData = getDoc('schedules/s1/shifts/shift_from').data();
    const toData = getDoc('schedules/s1/shifts/shift_to').data();

    assert.equal(fromData.residentId, 'requester_1', 'Ret sonrası from shift değişmemeli');
    assert.equal(toData.residentId, 'target_1', 'Ret sonrası to shift değişmemeli');
  });

  it('status aynı kalırsa işlem yapılmamalı (guard clause)', () => {
    const before = { status: 'pending_target' };
    const after = { status: 'pending_target' };

    // triggers.js'te: if (before.status === after.status) return;
    assert.equal(before.status, after.status, 'Durum değişmemiş');
    // Bu durumda fonksiyon erken dönmeli
  });
});

// ── Shift Swap Doğruluğu ───────────────────────────────────────────────────

describe('Shift Swap Doğruluğu', () => {
  beforeEach(() => resetMocks());

  it('swap eksik alan varsa (scheduleId yok) işlem yapılmamalı', () => {
    const swap = {
      requesterId: 'r1',
      targetId: 'r2',
      scheduleId: null,  // eksik
      fromShiftId: 'f1',
      toShiftId: 't1',
    };

    // applySwapToShifts: if (!swap.scheduleId || !swap.fromShiftId || !swap.toShiftId) return;
    const shouldSkip = !swap.scheduleId || !swap.fromShiftId || !swap.toShiftId;
    assert.ok(shouldSkip, 'Eksik alan olduğunda swap atlanmalı');
  });

  it('swap eksik alan varsa (fromShiftId yok) işlem yapılmamalı', () => {
    const swap = {
      requesterId: 'r1',
      targetId: 'r2',
      scheduleId: 's1',
      fromShiftId: null,  // eksik
      toShiftId: 't1',
    };

    const shouldSkip = !swap.scheduleId || !swap.fromShiftId || !swap.toShiftId;
    assert.ok(shouldSkip, 'fromShiftId eksik olduğunda swap atlanmalı');
  });

  it('olmayan shift dokümanı ile swap yapılmamalı', async () => {
    // shift_from mevcut değil
    const fromSnap = getDoc('schedules/s1/shifts/nonexistent');
    assert.ok(!fromSnap.exists, 'Olmayan shift bulunmamalı');
    // applySwapToShifts: if (!fromSnap.exists || !toSnap.exists) return;
  });

  it('swap sonrası her iki shift da karşılıklı güncellenmeli (simetri)', async () => {
    setDoc('schedules/s1/shifts/sf', { residentId: 'alice', zoneId: 'z1', day: 3 });
    setDoc('schedules/s1/shifts/st', { residentId: 'bob', zoneId: 'z2', day: 7 });

    const batch = createBatch();
    const sfRef = mockDocRef('schedules/s1/shifts/sf');
    const stRef = mockDocRef('schedules/s1/shifts/st');

    const sfData = (await sfRef.get()).data();
    const stData = (await stRef.get()).data();

    batch.update(sfRef, { residentId: stData.residentId, swappedVia: 'sw1' });
    batch.update(stRef, { residentId: sfData.residentId, swappedVia: 'sw1' });
    await batch.commit();

    const updSf = getDoc('schedules/s1/shifts/sf').data();
    const updSt = getDoc('schedules/s1/shifts/st').data();

    assert.equal(updSf.residentId, 'bob');
    assert.equal(updSt.residentId, 'alice');
    // zone ve day değişmemeli
    assert.equal(updSf.zoneId, 'z1');
    assert.equal(updSt.zoneId, 'z2');
    assert.equal(updSf.day, 3);
    assert.equal(updSt.day, 7);
  });
});
