/**
 * generateSchedule — HTTP Cloud Function
 * POST /generateSchedule
 *
 * Body: { clinicId, year, month }
 * Auth: Bearer token (başasistan)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { runAlgorithm } = require('./algorithm');
const { refs, getClinicResidents, getClinicZones, getTrainingBlocks } = require('../utils/firestore');

exports.generateSchedule = onCall({ timeoutSeconds: 120 }, async (request) => {
  // ── Yetki kontrolü ──────────────────────────────────────────────────────
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');

  const { clinicId, year, month } = request.data;
  if (!clinicId || year === undefined || month === undefined) {
    throw new HttpsError('invalid-argument', 'clinicId, year ve month gerekli.');
  }

  const db = getFirestore();

  // Kullanıcı bu kliniğin başasistanı mı?
  const userDoc = await refs.user(request.auth.uid).get();
  if (!userDoc.exists) throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');

  const userData = userDoc.data();
  const clinicDoc = await refs.clinic(clinicId).get();
  if (!clinicDoc.exists) throw new HttpsError('not-found', 'Klinik bulunamadı.');

  const clinicData = clinicDoc.data();
  const isChief = (clinicData.chiefResidentIds || []).includes(request.auth.uid) ||
                  userData.role === 'super_admin';
  if (!isChief) throw new HttpsError('permission-denied', 'Sadece başasistanlar nöbet oluşturabilir.');

  // ── Kilit kontrolü (aynı anda iki kişi çalıştırmasın) ────────────────────
  if (clinicData.activeScheduleLock && clinicData.activeScheduleLock !== request.auth.uid) {
    throw new HttpsError('already-exists', 'Başka bir başasistan şu anda nöbet oluşturuyor. Lütfen bekleyin.');
  }

  // Kilidi al
  await refs.clinic(clinicId).update({ activeScheduleLock: request.auth.uid });

  try {
    // ── Veriyi topla ─────────────────────────────────────────────────────
    const [residents, zones, trainingBlocks] = await Promise.all([
      getClinicResidents(clinicId),
      getClinicZones(clinicId),
      getTrainingBlocks(clinicId),
    ]);

    if (!residents.length) throw new HttpsError('failed-precondition', 'Klinikte aktif asistan bulunamadı.');
    if (!zones.length)     throw new HttpsError('failed-precondition', 'Klinikte aktif alan bulunamadı.');

    // Tercihleri getir (bu ay için mevcut schedule varsa onun altından)
    const scheduleId = `${clinicId}_${year}_${month}`;
    const prefSnap = await refs.prefs(scheduleId).get();
    const preferences = prefSnap.docs.map(d => ({ residentId: d.data().userId, ...d.data() }));

    // Önceki ay son günü ve sonraki ay ilk günü nöbet bilgisi
    const prevScheduleId = `${clinicId}_${month === 0 ? year - 1 : year}_${month === 0 ? 11 : month - 1}`;
    const nextScheduleId = `${clinicId}_${month === 11 ? year + 1 : year}_${month === 11 ? 0 : month + 1}`;

    const [prevSnap, nextSnap] = await Promise.all([
      refs.schedule(prevScheduleId).get(),
      refs.schedule(nextScheduleId).get(),
    ]);

    const prevMonthLastDays  = buildEdgeDayMap(prevSnap, residents, 'last');
    const nextMonthFirstDays = buildEdgeDayMap(nextSnap, residents, 'first');

    // Algoritma konfigürasyonu
    const cfg = buildConfig(clinicData, zones, residents);

    // ── Algoritmayı çalıştır ──────────────────────────────────────────────
    const { schedule, analysis } = runAlgorithm({
      residents,
      zones,
      config:         cfg,
      preferences,
      trainingBlocks,
      year,
      month,
      prevMonthLastDays,
      nextMonthFirstDays,
    });

    // ── Firestore'a yaz ───────────────────────────────────────────────────
    const batch = db.batch();

    // Schedule dokümanı
    const schedRef = refs.schedule(scheduleId);
    batch.set(schedRef, {
      clinicId,
      year,
      month,
      status:    'draft',
      createdBy: request.auth.uid,
      analysis,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Bireysel shift kayıtları
    const shiftsRef = refs.shifts(scheduleId);
    // Önce mevcut shift'leri sil (yeniden oluşturma)
    const existingShifts = await shiftsRef.get();
    existingShifts.docs.forEach(d => batch.delete(d.ref));

    Object.entries(schedule).forEach(([k, zoneId]) => {
      const [residentId, dayStr] = k.split('_');
      batch.set(shiftsRef.doc(k), {
        residentId,
        zoneId,
        day:       parseInt(dayStr),
        year,
        month,
        isWeekend: isWeekendDay(year, month, parseInt(dayStr)),
      });
    });

    await batch.commit();

    return {
      scheduleId,
      totalShifts: Object.keys(schedule).length,
      analysis,
    };

  } finally {
    // Kilidi her durumda serbest bırak
    await refs.clinic(clinicId).update({ activeScheduleLock: null }).catch(() => {});
  }
});

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function buildConfig(clinicData, zones, residents) {
  const algoCfg = clinicData.algoConfig || {};

  // Alan min/max per day
  const zoneMinPerDay = {};
  const zoneMaxPerDay = {};
  zones.forEach(z => {
    zoneMinPerDay[z.id] = z.minPerDay || 0;
    zoneMaxPerDay[z.id] = z.maxPerDay || 99;
  });

  // Alan kotası per kıdem (aylık toplam)
  const zoneQuota = {};
  zones.forEach(z => {
    zoneQuota[z.id] = z.capacityRules || {};
  });

  return {
    consecutiveDistance: algoCfg.consecutiveDistance || 1,
    avoidanceStrength:   algoCfg.avoidanceStrength   || 'strong',
    weekendBalance:      algoCfg.weekendBalance       || 'equal',
    leaveTargetAdjust:   algoCfg.leaveTargetAdjust    || 'proportional',
    targetShiftsByPgy:   clinicData.targetShiftsByPgy || { 1: 10, 2: 9, 3: 8, 4: 7, 5: 6 },
    zoneMinPerDay,
    zoneMaxPerDay,
    zoneQuota,
  };
}

function buildEdgeDayMap(schedSnap, residents, edge) {
  const map = {};
  if (!schedSnap.exists) return map;
  const data = schedSnap.data();
  if (!data || !data.shifts) return map;
  // shifts sub-koleksiyona erişemeyiz burada; bu data schedule doc'ta özet olarak tutulabilir
  // Şimdilik boş dön — ileride optimize edilecek
  return map;
}

function isWeekendDay(y, m, d) {
  const dw = new Date(y, m, d).getDay();
  return dw === 0 || dw === 6;
}
