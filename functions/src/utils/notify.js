/**
 * FCM push bildirim yardımcısı
 */

const { getMessaging } = require('firebase-admin/messaging');
const { refs, getFcmTokens } = require('./firestore');

/**
 * Belirli kullanıcılara push bildirimi gönderir
 * @param {string[]} userIds - Alıcı kullanıcı ID listesi
 * @param {object} notification - { title, body }
 * @param {object} data - Ek veri (deep link vb.)
 */
async function sendToUsers(userIds, notification, data = {}) {
  if (!userIds || userIds.length === 0) return;

  const tokens = await getFcmTokens(userIds);
  if (tokens.length === 0) return;

  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    tokens,
    android: {
      notification: { channelId: 'acilx_default', sound: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
  };

  const response = await getMessaging().sendEachForMulticast(message);

  // Geçersiz token'ları temizle
  if (response.failureCount > 0) {
    const invalidTokens = [];
    response.responses.forEach((r, i) => {
      if (!r.success &&
          (r.error?.code === 'messaging/invalid-registration-token' ||
           r.error?.code === 'messaging/registration-token-not-registered')) {
        invalidTokens.push(tokens[i]);
      }
    });
    if (invalidTokens.length > 0) {
      await removeInvalidTokens(invalidTokens);
    }
  }

  return response;
}

/**
 * Geçersiz FCM token'larını Firestore'dan siler
 */
async function removeInvalidTokens(invalidTokens) {
  const { db } = require('./firestore');
  const snap = await db().collection('users')
    .where('fcmTokens', 'array-contains-any', invalidTokens.slice(0, 10))
    .get();

  const batch = db().batch();
  snap.docs.forEach(doc => {
    const current = doc.data().fcmTokens || [];
    const cleaned = current.filter(t => !invalidTokens.includes(t));
    batch.update(doc.ref, { fcmTokens: cleaned });
  });
  await batch.commit();
}

/**
 * Firestore'a bildirim kaydı oluşturur (in-app bildirimler için)
 */
async function createNotification(userId, { title, body, type, data = {} }) {
  await refs.notifications().add({
    userId,
    title,
    body,
    type,
    data,
    isRead: false,
    createdAt: new Date(),
  });
}

module.exports = { sendToUsers, createNotification };
