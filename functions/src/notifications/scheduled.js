/**
 * Zamanlanmış bildirimler (Cloud Scheduler / cron)
 *
 * scheduledShiftReminder      — her gün 08:00, ertesi gün nöbeti olanları uyarır
 * scheduledPreferenceReminder — her gün 09:00, deadline'ı yaklaşan tercih dönemleri için hatırlatma
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { sendToUsers, createNotification } = require('../utils/notify');

// ── scheduledShiftReminder ─────────────────────────────────────────────────────
// Her gün 08:00 UTC+3 (05:00 UTC) çalışır; ertesi gün nöbeti olanları bilgilendirir
exports.scheduledShiftReminder = onSchedule('0 5 * * *', async () => {
  const db       = getFirestore();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tYear  = tomorrow.getFullYear();
  const tMonth = tomorrow.getMonth();       // 0-based
  const tDay   = tomorrow.getDate();

  // Yarınki nöbetleri sorgula: tüm çizelgelerden shifts
  // Firestore'da shifts koleksiyonu schedules/{id}/shifts altında olduğundan
  // collectionGroup sorgusu kullanıyoruz
  const snap = await db.collectionGroup('shifts')
    .where('year',  '==', tYear)
    .where('month', '==', tMonth)
    .where('day',   '==', tDay)
    .get();

  if (snap.empty) return;

  // Kullanıcı başına tek bildirim (bir asistan birden fazla alanda nöbet tutabilir)
  const notified = new Set();
  const promises = [];

  snap.docs.forEach(doc => {
    const { residentId } = doc.data();
    if (!residentId || notified.has(residentId)) return;
    notified.add(residentId);

    promises.push(
      sendToUsers([residentId], {
        title: 'Yarın Nöbetiniz Var',
        body:  'Yarın nöbetiniz bulunmaktadır. İyi nöbetler dileriz!',
      }, { type: 'shift_reminder' }),
      createNotification(residentId, {
        title: 'Yarın Nöbetiniz Var',
        body:  'Yarın nöbetiniz bulunmaktadır.',
        type:  'shift_reminder',
        data:  { day: String(tDay), month: String(tMonth), year: String(tYear) },
      })
    );
  });

  await Promise.allSettled(promises);
});

// ── scheduledPreferenceReminder ───────────────────────────────────────────────
// Her gün 09:00 UTC+3 (06:00 UTC) çalışır; deadline'ı 3 gün veya daha az kalan
// açık tercih dönemleri için henüz tercih girmemiş asistanlara hatırlatma yapar
exports.scheduledPreferenceReminder = onSchedule('0 6 * * *', async () => {
  const db  = getFirestore();
  const now = new Date();

  // 3 gün sonrasına kadar deadline'ı olan açık tercih dönemlerini bul
  const deadline3d = new Date(now);
  deadline3d.setDate(deadline3d.getDate() + 3);

  const periodsSnap = await db.collection('preferencePeriods')
    .where('status',   '==', 'open')
    .where('deadline', '<=', Timestamp.fromDate(deadline3d))
    .where('deadline', '>=', Timestamp.fromDate(now))
    .get();

  if (periodsSnap.empty) return;

  for (const periodDoc of periodsSnap.docs) {
    const period = periodDoc.data();
    const { clinicId, scheduleId, year, month } = period;

    // Kliniğin aktif asistanlarını al
    const residentsSnap = await db
      .collection('clinics').doc(clinicId)
      .collection('residents')
      .where('status', '==', 'active')
      .get();

    const allResidentUserIds = residentsSnap.docs
      .map(d => d.data().userId)
      .filter(Boolean);

    if (allResidentUserIds.length === 0) continue;

    // Bu dönem için tercih girmiş olanları bul
    const prefsSnap = await db
      .collection('schedules').doc(scheduleId)
      .collection('preferences')
      .get();
    const submittedUserIds = new Set(prefsSnap.docs.map(d => d.data().userId));

    // Tercih girmemiş asistanlar
    const pending = allResidentUserIds.filter(uid => !submittedUserIds.has(uid));
    if (pending.length === 0) continue;

    const monthLabel  = `${year} / ${String(month + 1).padStart(2, '0')}`;
    const deadlineStr = period.deadline?.toDate
      ? period.deadline.toDate().toLocaleDateString('tr-TR')
      : '';

    const promises = pending.flatMap(uid => [
      sendToUsers([uid], {
        title: 'Tercih Girmeyi Unuttunuz!',
        body:  `${monthLabel} nöbet tercihleri için son tarih: ${deadlineStr}. Hâlâ tercih girmediniz.`,
      }, { type: 'preference_reminder', scheduleId }),
      createNotification(uid, {
        title: 'Tercih Girmeyi Unuttunuz!',
        body:  `${monthLabel} nöbet tercihleri için son tarih: ${deadlineStr}.`,
        type:  'preference_reminder',
        data:  { scheduleId, clinicId },
      }),
    ]);

    await Promise.allSettled(promises);
  }
});
