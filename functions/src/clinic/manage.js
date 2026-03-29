/**
 * Klinik yönetimi Cloud Functions
 *
 * createClinic  — klinik oluşturur ve kurucuyu chief_resident yapar
 * approveClinic — süper admin bir klinik başvurusunu onaylar
 * joinClinic    — asistan (hastane kodu + asistan kodu) ile kliniğe katılır
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { refs } = require('../utils/firestore');
const { sendToUsers, createNotification } = require('../utils/notify');

function randCode(n) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ── createClinic ───────────────────────────────────────────────────────────────
// (onCall, HttpsError, refs, FieldValue yukarıda require edilmiş olmalı)
exports.createClinic = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');

  const { name, hospitalName, shiftModel, shiftTypes, trainingMode } = request.data;
  if (!name) {
    throw new HttpsError('invalid-argument', 'Klinik adı gerekli.');
  }

  const db  = getFirestore();
  const uid = request.auth.uid;

  const userSnap = await refs.user(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');
  const userRole = userSnap.data().role;

  const joinCode         = randCode(6);
  const residentJoinCode = randCode(6);
  const clinicRef        = db.collection('clinics').doc();
  const status           = userRole === 'super_admin' ? 'approved' : 'pending';

  const resolvedShiftTypes = Array.isArray(shiftTypes) && shiftTypes.length > 0
    ? shiftTypes
    : shiftModel ? [shiftModel] : ['24h'];

  await clinicRef.set({
    name, hospitalName: hospitalName || '',
    shiftModel:   resolvedShiftTypes[0],
    shiftTypes:   resolvedShiftTypes,
    trainingMode: trainingMode || 'within_shift',
    joinCode, residentJoinCode, status,
    chiefResidentIds: [uid],
    createdBy:        uid,
    createdAt:        FieldValue.serverTimestamp(),
  });

  // Admin SDK ile rol + clinicId güncelle (client kurallarını bypass eder)
  const updates = { clinicId: clinicRef.id };
  if (userRole !== 'super_admin') updates.role = 'chief_resident';
  await refs.user(uid).update(updates);

  return { clinicId: clinicRef.id, joinCode, residentJoinCode, status };
});

// ── approveClinic ──────────────────────────────────────────────────────────────
exports.approveClinic = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');

  const { clinicId } = request.data;
  if (!clinicId) throw new HttpsError('invalid-argument', 'clinicId gerekli.');

  // Sadece süper admin
  const userDoc = await refs.user(request.auth.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Sadece süper admin klinik onaylayabilir.');
  }

  const clinicRef = refs.clinic(clinicId);
  const clinicDoc = await clinicRef.get();
  if (!clinicDoc.exists) throw new HttpsError('not-found', 'Klinik bulunamadı.');

  const clinic = clinicDoc.data();
  if (clinic.status === 'approved') {
    throw new HttpsError('already-exists', 'Klinik zaten onaylı.');
  }

  await clinicRef.update({
    status:     'approved',
    approvedBy: request.auth.uid,
    approvedAt: FieldValue.serverTimestamp(),
  });

  // Başasistanlara bildirim
  const chiefIds = clinic.chiefResidentIds || [];
  if (chiefIds.length > 0) {
    await Promise.all([
      sendToUsers(chiefIds, {
        title: 'Klinik Onaylandı',
        body:  `"${clinic.name}" kliniği onaylandı. Artık asistan ekleyebilirsiniz.`,
      }, { type: 'clinic_approved', clinicId }),
      ...chiefIds.map(uid =>
        createNotification(uid, {
          title: 'Klinik Onaylandı',
          body:  `"${clinic.name}" kliniği onaylandı.`,
          type:  'clinic_approved',
          data:  { clinicId },
        })
      ),
    ]);
  }

  return { clinicId, status: 'approved' };
});

// ── autoMatchResident ──────────────────────────────────────────────────────────
// Google Auth sonrası otomatik eşleştirme: kullanıcının emailini tüm kliniklerde arar
// Eşleşme bulursa kullanıcıyı o kliniğe otomatik kaydeder
exports.autoMatchResident = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');

  const db    = getFirestore();
  const uid   = request.auth.uid;
  const email = (request.auth.token.email || '').toLowerCase().trim();

  if (!email) {
    return { matched: false };
  }

  // Tüm kliniklerde pendingResidents'ta email araması yap
  const clinicsSnap = await db.collection('clinics')
    .where('status', '==', 'approved')
    .get();

  for (const clinicDoc of clinicsSnap.docs) {
    const clinicId   = clinicDoc.id;
    const clinicData = clinicDoc.data();

    const pendingSnap = await db.collection('clinics').doc(clinicId)
      .collection('pendingResidents')
      .where('email', '==', email)
      .where('used',  '==', false)
      .limit(1)
      .get();

    if (pendingSnap.empty) continue;

    const pendingDoc = pendingSnap.docs[0];
    const pending    = pendingDoc.data();
    const pendingRef = pendingDoc.ref;

    // Kullanıcı zaten bu kliniğe kayıtlı mı?
    const existingSnap = await refs.residents(clinicId)
      .where('userId', '==', uid)
      .limit(1)
      .get();
    if (!existingSnap.empty) continue;

    // Kullanıcı profilini al
    const userSnap = await refs.user(uid).get();
    if (!userSnap.exists) throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');
    const userData = userSnap.data();

    const batch = db.batch();

    // pendingResidents kaydını kullanıldı olarak işaretle
    batch.update(pendingRef, {
      used:   true,
      usedBy: uid,
      usedAt: FieldValue.serverTimestamp(),
    });

    // residents alt koleksiyonuna ekle
    batch.set(refs.residents(clinicId).doc(uid), {
      userId:   uid,
      name:     pending.name || userData.displayName || '',
      email:    email,
      pgy:      pending.pgy || userData.pgy || 1,
      status:   'active',
      joinedAt: FieldValue.serverTimestamp(),
    });

    // Kullanıcı profilini güncelle
    batch.update(refs.user(uid), {
      clinicId:  clinicId,
      role:      userData.role === 'super_admin' ? 'super_admin' : 'resident',
      seniority: pending.pgy || userData.pgy || 1,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Başasistanlara bildirim
    const chiefIds = clinicData.chiefResidentIds || [];
    const name     = pending.name || userData.displayName || 'Bir asistan';
    if (chiefIds.length > 0) {
      await Promise.all([
        sendToUsers(chiefIds, {
          title: 'Yeni Asistan Katıldı (Otomatik)',
          body:  `${name} email eşleşmesiyle kliniğinize katıldı.`,
        }, { type: 'resident_joined', clinicId }),
        ...chiefIds.map(cid => createNotification(cid, {
          title: 'Yeni Asistan Katıldı (Otomatik)',
          body:  `${name} email eşleşmesiyle kliniğinize katıldı.`,
          type:  'resident_joined',
          data:  { clinicId, userId: uid },
        })),
      ]);
    }

    return { matched: true, clinicId, clinicName: clinicData.name };
  }

  return { matched: false };
});

// ── deleteClinic ─────────────────────────────────────────────────────────────────
exports.deleteClinic = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');

  const { clinicId } = request.data;
  if (!clinicId) throw new HttpsError('invalid-argument', 'clinicId gerekli.');

  const db  = getFirestore();
  const uid = request.auth.uid;

  // Yetki: super_admin veya klinik sahibi (chief_resident)
  const userSnap = await refs.user(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');
  const userRole = userSnap.data().role;

  const clinicRef = refs.clinic(clinicId);
  const clinicDoc = await clinicRef.get();
  if (!clinicDoc.exists) throw new HttpsError('not-found', 'Klinik bulunamadı.');

  const clinicData = clinicDoc.data();
  const isOwner = clinicData.createdBy === uid;
  const isChief = (clinicData.chiefResidentIds || []).includes(uid);
  const isSuperAdmin = userRole === 'super_admin';

  if (!isSuperAdmin && !isOwner && !isChief) {
    throw new HttpsError('permission-denied', 'Bu kliniği silme yetkiniz yok.');
  }

  // Alt koleksiyonları sil (residents, pendingResidents, zones)
  const subcollections = ['residents', 'pendingResidents', 'zones', 'trainingBlocks'];
  for (const sub of subcollections) {
    const snap = await clinicRef.collection(sub).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (snap.docs.length > 0) await batch.commit();
  }

  // Klinik dokümanını sil
  await clinicRef.delete();

  return { ok: true, clinicId };
});

// ── joinClinic ─────────────────────────────────────────────────────────────────
// Yeni sistem: her asistan kendi kişisel koduyla (pendingResidents) katılır
// Akış: başasistan panelden asistan adı girer → benzersiz kod üretilir → asistana verilir
// Asistan: hastane kodu + kişisel kodu girer → kendi ismine/profiline bağlanır
// Alternatif: residentCode verilmezse email ile pendingResidents eşleştirmesi yapılır
exports.joinClinic = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');

  const { hospitalCode, residentCode } = request.data;
  if (!hospitalCode) {
    throw new HttpsError('invalid-argument', 'hospitalCode gerekli.');
  }

  const db          = getFirestore();
  const uid         = request.auth.uid;
  const hCode       = hospitalCode.trim().toUpperCase();
  const email       = (request.auth.token.email || '').toLowerCase().trim();

  // Hastane koduna göre klinik bul
  const clinicSnap = await db.collection('clinics')
    .where('joinCode', '==', hCode)
    .where('status',   '==', 'approved')
    .limit(1)
    .get();

  if (clinicSnap.empty) {
    throw new HttpsError('not-found', 'Geçersiz hastane kodu veya klinik henüz onaylanmamış.');
  }

  const clinicDoc  = clinicSnap.docs[0];
  const clinicId   = clinicDoc.id;
  const clinicData = clinicDoc.data();

  let pendingRef;
  let pending;

  if (residentCode) {
    // Yol 1: Kişiye özel kod ile eşleştirme (mevcut akış)
    const rCode = residentCode.trim().toUpperCase();
    pendingRef  = db.collection('clinics').doc(clinicId).collection('pendingResidents').doc(rCode);
    const pendingSnap = await pendingRef.get();

    if (!pendingSnap.exists) {
      throw new HttpsError('permission-denied', 'Geçersiz asistan kodu.');
    }
    pending = pendingSnap.data();
  } else if (email) {
    // Yol 2: Email ile pendingResidents eşleştirmesi
    const pendingSnap = await db.collection('clinics').doc(clinicId)
      .collection('pendingResidents')
      .where('email', '==', email)
      .where('used',  '==', false)
      .limit(1)
      .get();

    if (pendingSnap.empty) {
      throw new HttpsError('permission-denied', 'Bu email ile eşleşen bir davet bulunamadı. Asistan kodunuzu girin.');
    }
    pendingRef = pendingSnap.docs[0].ref;
    pending    = pendingSnap.docs[0].data();
  } else {
    throw new HttpsError('invalid-argument', 'residentCode veya email gerekli.');
  }

  if (pending.used) {
    throw new HttpsError('already-exists', 'Bu davet zaten kullanılmış.');
  }

  // Kullanıcı zaten bu kliniğe kayıtlı mı?
  const existingSnap = await refs.residents(clinicId)
    .where('userId', '==', uid)
    .limit(1)
    .get();
  if (!existingSnap.empty) {
    throw new HttpsError('already-exists', 'Bu kliniğe zaten kayıtlısınız.');
  }

  // Kullanıcı profilini al
  const userDoc = await refs.user(uid).get();
  if (!userDoc.exists) throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');
  const userData = userDoc.data();

  const batch = db.batch();

  // Kodu kullanıldı olarak işaretle
  batch.update(pendingRef, { used: true, usedBy: uid, usedAt: FieldValue.serverTimestamp() });

  // residents alt koleksiyonuna ekle — isim pending kaydından gelir
  const residentRef = refs.residents(clinicId).doc(uid);
  batch.set(residentRef, {
    userId:   uid,
    name:     pending.name || userData.displayName || '',
    email:    userData.email || email || '',
    pgy:      pending.pgy   || userData.pgy || 1,
    status:   'active',
    joinedAt: FieldValue.serverTimestamp(),
  });

  // Kullanıcı profilini güncelle
  batch.update(refs.user(uid), {
    clinicId:  clinicId,
    role:      userData.role === 'super_admin' ? 'super_admin' : 'resident',
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  // Başasistanlara bildirim
  const chiefIds = clinicData.chiefResidentIds || [];
  const name     = pending.name || userData.displayName || 'Bir asistan';
  if (chiefIds.length > 0) {
    await Promise.all([
      sendToUsers(chiefIds, {
        title: 'Yeni Asistan Katıldı',
        body:  `${name} kliniğinize katıldı.`,
      }, { type: 'resident_joined', clinicId }),
      ...chiefIds.map(cid => createNotification(cid, {
        title: 'Yeni Asistan Katıldı',
        body:  `${name} kliniğinize katıldı.`,
        type:  'resident_joined',
        data:  { clinicId, userId: uid },
      })),
    ]);
  }

  return { clinicId, clinicName: clinicData.name, residentName: name };
});
