/**
 * Schedule tetikleyicileri
 * onSchedulePublished — çizelge 'draft' → 'published' geçince tüm asistanlara bildirim
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { refs, getClinicResidents } = require('../utils/firestore');
const { sendToUsers, createNotification } = require('../utils/notify');

exports.onSchedulePublished = onDocumentUpdated('schedules/{scheduleId}', async (event) => {
  const before    = event.data.before.data();
  const after     = event.data.after.data();
  const scheduleId = event.params.scheduleId;

  if (!before || !after) return;

  // Sadece draft → published geçişini yakala
  if (before.status !== 'draft' || after.status !== 'published') return;

  const { clinicId, year, month } = after;

  // Kliniğin tüm aktif asistanlarını al
  const residents = await getClinicResidents(clinicId);
  const userIds   = residents
    .map(r => r.userId)
    .filter(Boolean);

  if (userIds.length === 0) return;

  const monthLabel = `${year} / ${String(month + 1).padStart(2, '0')}`;

  await Promise.all([
    sendToUsers(userIds, {
      title: 'Nöbet Çizelgesi Yayınlandı',
      body:  `${monthLabel} nöbet çizelgesi yayınlandı. Nöbetlerinizi kontrol edebilirsiniz.`,
    }, {
      type:       'schedule_published',
      scheduleId,
    }),
    ...userIds.map(uid =>
      createNotification(uid, {
        title: 'Nöbet Çizelgesi Yayınlandı',
        body:  `${monthLabel} nöbet çizelgesi yayınlandı.`,
        type:  'schedule_published',
        data:  { scheduleId, clinicId, year: String(year), month: String(month) },
      })
    ),
  ]);
});
