/**
 * Swap talep tetikleyicileri
 * onSwapCreated  — yeni takas talebi oluşturulduğunda hedef asistana bildirim
 * onSwapUpdated  — takas durumu değiştiğinde ilgili taraflara bildirim
 *
 * Durum makinesi (PRD §6.3):
 *   pending_target → (hedef kabul) → pending_chief → (başasistan onay) → approved
 *                  → (hedef ret)   → rejected
 *                  → (başasistan ret) → rejected
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue }             = require('firebase-admin/firestore');
const { refs }                                  = require('../utils/firestore');
const { sendToUsers, createNotification }       = require('../utils/notify');

// ── onSwapCreated ──────────────────────────────────────────────────────────────
exports.onSwapCreated = onDocumentCreated('swapRequests/{swapId}', async (event) => {
  const swap   = event.data.data();
  const swapId = event.params.swapId;

  if (!swap || swap.status !== 'pending_target') return;

  // Hedef asistana bildirim
  await Promise.all([
    sendToUsers([swap.targetId], {
      title: 'Yeni Nöbet Takası Talebi',
      body:  'Bir meslektaşınız nöbet takası talep etti. Detayları incelemeyi unutmayın.',
    }, {
      type:   'swap_request',
      swapId,
    }),
    createNotification(swap.targetId, {
      title:  'Yeni Nöbet Takası Talebi',
      body:   'Bir meslektaşınız nöbet takası talep etti.',
      type:   'swap_request',
      data:   { swapId },
    }),
  ]);
});

// ── onSwapUpdated ──────────────────────────────────────────────────────────────
exports.onSwapUpdated = onDocumentUpdated('swapRequests/{swapId}', async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();
  const swapId = event.params.swapId;

  if (!before || !after) return;
  if (before.status === after.status) return; // Durum değişmemişse işlem yok

  const db = getFirestore();

  // ── pending_target → pending_chief (hedef kabul etti) ─────────────────────
  if (before.status === 'pending_target' && after.status === 'pending_chief') {
    // Kliniğin başasistanlarını bul
    const clinicDoc = await refs.clinic(after.clinicId).get();
    const chiefIds  = clinicDoc.exists ? (clinicDoc.data().chiefResidentIds || []) : [];

    await Promise.all([
      // Talep sahibine bildirim
      sendToUsers([after.requesterId], {
        title: 'Takas Talebi Kabul Edildi',
        body:  'Meslektaşınız takas talebinizi kabul etti. Başasistan onayı bekleniyor.',
      }, { type: 'swap_accepted_by_target', swapId }),
      createNotification(after.requesterId, {
        title: 'Takas Talebi Kabul Edildi',
        body:  'Meslektaşınız takas talebinizi kabul etti. Başasistan onayı bekleniyor.',
        type:  'swap_accepted_by_target',
        data:  { swapId },
      }),
      // Başasistanlara bildirim
      ...(chiefIds.length > 0 ? [
        sendToUsers(chiefIds, {
          title: 'Onay Bekleyen Takas Talebi',
          body:  'İki asistan nöbet takası yapmak istiyor. Onayınızı bekliyorlar.',
        }, { type: 'swap_pending_chief', swapId }),
        ...chiefIds.map(uid => createNotification(uid, {
          title: 'Onay Bekleyen Takas Talebi',
          body:  'İki asistan nöbet takası yapmak istiyor.',
          type:  'swap_pending_chief',
          data:  { swapId },
        })),
      ] : []),
    ]);
    return;
  }

  // ── pending_target → rejected (hedef reddetti) ────────────────────────────
  if (before.status === 'pending_target' && after.status === 'rejected') {
    await Promise.all([
      sendToUsers([after.requesterId], {
        title: 'Takas Talebi Reddedildi',
        body:  'Meslektaşınız takas talebinizi reddetti.',
      }, { type: 'swap_rejected_by_target', swapId }),
      createNotification(after.requesterId, {
        title: 'Takas Talebi Reddedildi',
        body:  'Meslektaşınız takas talebinizi reddetti.',
        type:  'swap_rejected_by_target',
        data:  { swapId },
      }),
    ]);
    return;
  }

  // ── pending_chief → approved (başasistan onayladı) ────────────────────────
  if (before.status === 'pending_chief' && after.status === 'approved') {
    await applySwapToShifts(db, after, swapId);

    await Promise.all([
      sendToUsers([after.requesterId, after.targetId], {
        title: 'Takas Onaylandı!',
        body:  'Nöbet takası başasistan tarafından onaylandı. Çizelgeniz güncellendi.',
      }, { type: 'swap_approved', swapId }),
      createNotification(after.requesterId, {
        title: 'Takas Onaylandı!',
        body:  'Nöbet takası onaylandı. Çizelgeniz güncellendi.',
        type:  'swap_approved',
        data:  { swapId },
      }),
      createNotification(after.targetId, {
        title: 'Takas Onaylandı!',
        body:  'Nöbet takası onaylandı. Çizelgeniz güncellendi.',
        type:  'swap_approved',
        data:  { swapId },
      }),
    ]);
    return;
  }

  // ── pending_chief → rejected (başasistan reddetti) ───────────────────────
  if (before.status === 'pending_chief' && after.status === 'rejected') {
    await Promise.all([
      sendToUsers([after.requesterId, after.targetId], {
        title: 'Takas Reddedildi',
        body:  'Nöbet takası başasistan tarafından reddedildi.',
      }, { type: 'swap_rejected_by_chief', swapId }),
      createNotification(after.requesterId, {
        title: 'Takas Reddedildi',
        body:  'Nöbet takası başasistan tarafından reddedildi.',
        type:  'swap_rejected_by_chief',
        data:  { swapId },
      }),
      createNotification(after.targetId, {
        title: 'Takas Reddedildi',
        body:  'Nöbet takası başasistan tarafından reddedildi.',
        type:  'swap_rejected_by_chief',
        data:  { swapId },
      }),
    ]);
  }
});

// ── Onaylanan takas için shift kayıtlarını güncelle ───────────────────────────
async function applySwapToShifts(db, swap, swapId) {
  // swap.fromShiftId  → requester'ın nöbeti
  // swap.toShiftId    → target'ın nöbeti
  // swap.scheduleId   → hangi çizelge
  if (!swap.scheduleId || !swap.fromShiftId || !swap.toShiftId) return;

  const shiftsRef  = refs.shifts(swap.scheduleId);
  const fromRef    = shiftsRef.doc(swap.fromShiftId);
  const toRef      = shiftsRef.doc(swap.toShiftId);

  const [fromSnap, toSnap] = await Promise.all([fromRef.get(), toRef.get()]);
  if (!fromSnap.exists || !toSnap.exists) return;

  const fromData = fromSnap.data();
  const toData   = toSnap.data();

  // Sadece residentId'leri yer değiştir
  const batch = db.batch();
  batch.update(fromRef, {
    residentId: toData.residentId,
    swappedVia: swapId,
    updatedAt:  FieldValue.serverTimestamp(),
  });
  batch.update(toRef, {
    residentId: fromData.residentId,
    swappedVia: swapId,
    updatedAt:  FieldValue.serverTimestamp(),
  });

  // Schedule'ın updatedAt'ini de güncelle
  batch.update(refs.schedule(swap.scheduleId), {
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}
