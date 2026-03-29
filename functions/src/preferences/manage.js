/**
 * Tercih dönemi yönetimi
 * openPreferencePeriod  — başasistan tercih dönemini açar, asistanlara bildirim
 * closePreferencePeriod — başasistan tercih dönemini kapatır
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { refs, getClinicResidents } = require('../utils/firestore');
const { sendToUsers, createNotification } = require('../utils/notify');

// ── openPreferencePeriod ───────────────────────────────────────────────────────
exports.openPreferencePeriod = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');

  const { clinicId, year, month, deadlineDate } = request.data;
  if (!clinicId || year === undefined || month === undefined) {
    throw new HttpsError('invalid-argument', 'clinicId, year ve month gerekli.');
  }

  const db = getFirestore();

  // Yetki kontrolü
  await assertChief(request.auth.uid, clinicId);

  const scheduleId = `${clinicId}_${year}_${month}`;
  const periodId   = scheduleId;

  // Mevcut açık dönem var mı?
  const existing = await refs.prefPeriods().doc(periodId).get();
  if (existing.exists && existing.data().status === 'open') {
    throw new HttpsError('already-exists', 'Bu ay için zaten açık bir tercih dönemi var.');
  }

  await refs.prefPeriods().doc(periodId).set({
    clinicId,
    year,
    month,
    scheduleId,
    status:      'open',
    openedBy:    request.auth.uid,
    openedAt:    FieldValue.serverTimestamp(),
    deadline:    deadlineDate ? new Date(deadlineDate) : null,
    closedAt:    null,
  });

  // Asistanlara bildirim gönder
  const residents = await getClinicResidents(clinicId);
  const userIds   = residents.map(r => r.userId).filter(Boolean);
  const monthLabel = `${year} / ${String(month + 1).padStart(2, '0')}`;

  if (userIds.length > 0) {
    await Promise.all([
      sendToUsers(userIds, {
        title: 'Tercih Dönemi Açıldı',
        body:  `${monthLabel} nöbet tercih dönemi açıldı. Tercihlerinizi girmeyi unutmayın.`,
      }, { type: 'preference_period_open', scheduleId }),
      ...userIds.map(uid =>
        createNotification(uid, {
          title: 'Tercih Dönemi Açıldı',
          body:  `${monthLabel} nöbet tercih dönemi açıldı.`,
          type:  'preference_period_open',
          data:  { scheduleId, clinicId, year: String(year), month: String(month) },
        })
      ),
    ]);
  }

  return { periodId, status: 'open' };
});

// ── closePreferencePeriod ──────────────────────────────────────────────────────
exports.closePreferencePeriod = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');

  const { clinicId, year, month } = request.data;
  if (!clinicId || year === undefined || month === undefined) {
    throw new HttpsError('invalid-argument', 'clinicId, year ve month gerekli.');
  }

  await assertChief(request.auth.uid, clinicId);

  const periodId  = `${clinicId}_${year}_${month}`;
  const periodRef = refs.prefPeriods().doc(periodId);
  const snap      = await periodRef.get();

  if (!snap.exists) {
    throw new HttpsError('not-found', 'Tercih dönemi bulunamadı.');
  }
  if (snap.data().status !== 'open') {
    throw new HttpsError('failed-precondition', 'Tercih dönemi zaten kapalı.');
  }

  await periodRef.update({
    status:   'closed',
    closedBy: request.auth.uid,
    closedAt: FieldValue.serverTimestamp(),
  });

  return { periodId, status: 'closed' };
});

// ── Yardımcı ──────────────────────────────────────────────────────────────────
async function assertChief(uid, clinicId) {
  const [userDoc, clinicDoc] = await Promise.all([
    refs.user(uid).get(),
    refs.clinic(clinicId).get(),
  ]);

  if (!userDoc.exists)   throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');
  if (!clinicDoc.exists) throw new HttpsError('not-found', 'Klinik bulunamadı.');

  const isChief = (clinicDoc.data().chiefResidentIds || []).includes(uid) ||
                  userDoc.data().role === 'super_admin';
  if (!isChief) throw new HttpsError('permission-denied', 'Sadece başasistanlar bu işlemi yapabilir.');
}
