import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getMessaging, isSupported } from 'firebase/messaging'
import type { Messaging } from 'firebase/messaging'

export const firebaseConfig = {
  apiKey: 'AIzaSyB84OiA8dA8MqIDhp2mVPHbOwbfM7hXkcw',
  authDomain: 'acilx-d3635.firebaseapp.com',
  projectId: 'acilx-d3635',
  storageBucket: 'acilx-d3635.firebasestorage.app',
  messagingSenderId: '539148511591',
  appId: '1:539148511591:web:4ca4f0eb49a1345c4fa7c2',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)

// FCM Messaging — tarayıcı destekliyorsa başlat
let messagingInstance: Messaging | null = null

export async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance
  const supported = await isSupported()
  if (!supported) return null
  messagingInstance = getMessaging(app)
  return messagingInstance
}

// Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
// TODO: Firebase Console'dan VAPID key alıp buraya yapıştır
export const VAPID_KEY = ''
