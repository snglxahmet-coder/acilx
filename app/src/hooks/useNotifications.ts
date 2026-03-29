import { useEffect, useRef, useCallback } from 'react'
import { getToken, onMessage } from 'firebase/messaging'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db, getMessagingInstance, VAPID_KEY } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth-store'

/**
 * FCM push bildirim hook'u
 * - Bildirim izni ister
 * - FCM token alır ve Firestore'a kaydeder (users/{uid}.fcmTokens array)
 * - Foreground mesajları yakalar ve alert gösterir
 */
export function useNotifications() {
  const user = useAuthStore((s) => s.user)
  const initialized = useRef(false)

  const saveToken = useCallback(
    async (token: string) => {
      if (!user) return
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, { fcmTokens: arrayUnion(token) })
    },
    [user],
  )

  useEffect(() => {
    if (!user || initialized.current) return
    initialized.current = true

    let unsubMessage: (() => void) | undefined

    async function init() {
      try {
        const messaging = await getMessagingInstance()
        if (!messaging) return

        // İzin iste
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        // VAPID key kontrolü
        if (!VAPID_KEY) {
          console.warn(
            '[FCM] VAPID_KEY tanımlı değil. Firebase Console > Project Settings > Cloud Messaging > Web Push certificates bölümünden alıp firebase.ts dosyasına yapıştırın.',
          )
          return
        }

        // Token al ve kaydet
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
            || await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
        })

        if (token) {
          await saveToken(token)
        }

        // Foreground bildirim dinleyicisi
        unsubMessage = onMessage(messaging, (payload) => {
          const title = payload.notification?.title || 'AcilX'
          const body = payload.notification?.body || ''

          // Basit native bildirim (uygulama açıkken)
          if (Notification.permission === 'granted') {
            new Notification(title, {
              body,
              icon: '/icons/icon-192.png',
            })
          }
        })
      } catch (err) {
        console.error('[FCM] Bildirim başlatma hatası:', err)
      }
    }

    init()

    return () => {
      unsubMessage?.()
    }
  }, [user, saveToken])
}
