/**
 * Firestore yardımcı fonksiyonlar
 */

const { getFirestore } = require('firebase-admin/firestore');

const db = () => getFirestore();

// Koleksiyon referansları
const refs = {
  users:             () => db().collection('users'),
  user:        (uid) => db().collection('users').doc(uid),

  clinics:           () => db().collection('clinics'),
  clinic:    (cId)   => db().collection('clinics').doc(cId),
  zones:     (cId)   => db().collection('clinics').doc(cId).collection('zones'),
  residents: (cId)   => db().collection('clinics').doc(cId).collection('residents'),
  training:  (cId)   => db().collection('clinics').doc(cId).collection('trainingBlocks'),

  schedules:         () => db().collection('schedules'),
  schedule:  (sId)   => db().collection('schedules').doc(sId),
  shifts:    (sId)   => db().collection('schedules').doc(sId).collection('shifts'),
  prefs:     (sId)   => db().collection('schedules').doc(sId).collection('preferences'),

  prefPeriods:       () => db().collection('preferencePeriods'),

  swaps:             () => db().collection('swapRequests'),
  swap:      (swId)  => db().collection('swapRequests').doc(swId),

  notifications:     () => db().collection('notifications'),

  articles:          () => db().collection('articles'),
  scores:            () => db().collection('scores'),
  algorithms:        () => db().collection('algorithms'),
  medications:       () => db().collection('medications'),

  logbook:           () => db().collection('logbookEntries'),
  academic:          () => db().collection('academicRecords'),
  burnout:           () => db().collection('burnoutAssessments'),

  audit:             () => db().collection('audit'),
};

/**
 * Klinikteki tüm aktif asistanları getirir
 */
async function getClinicResidents(clinicId) {
  const snap = await refs.residents(clinicId)
    .where('status', '==', 'active')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Klinikteki tüm aktif alanları getirir
 */
async function getClinicZones(clinicId) {
  const snap = await refs.zones(clinicId)
    .where('isActive', '==', true)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Klinikteki eğitim bloklarını getirir
 */
async function getTrainingBlocks(clinicId) {
  const snap = await refs.training(clinicId).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Bir ayın tercihlerini getirir
 */
async function getPreferences(scheduleId) {
  const snap = await refs.prefs(scheduleId).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * FCM token'larını kullanıcı listesine göre toplar
 */
async function getFcmTokens(userIds) {
  const tokens = [];
  const chunks = chunkArray(userIds, 10);
  for (const chunk of chunks) {
    const snaps = await Promise.all(chunk.map(uid => refs.user(uid).get()));
    snaps.forEach(s => {
      if (s.exists && s.data().fcmTokens) {
        tokens.push(...s.data().fcmTokens);
      }
    });
  }
  return [...new Set(tokens)]; // tekrarsız
}

/**
 * Klinikteki tüm başasistanların user ID'lerini döndürür
 */
async function getChiefIds(clinicId) {
  const snap = await refs.clinic(clinicId).get();
  if (!snap.exists) return [];
  return snap.data().chiefResidentIds || [];
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

module.exports = { db, refs, getClinicResidents, getClinicZones, getTrainingBlocks, getPreferences, getFcmTokens, getChiefIds };
