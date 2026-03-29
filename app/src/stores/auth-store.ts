import { create } from 'zustand'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { Profile } from '@/types'

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        const profile = snap.exists() ? (snap.data() as Profile) : null
        set({ user, profile, loading: false })
      } catch {
        set({ user, profile: null, loading: false })
      }
    } else {
      set({ user: null, profile: null, loading: false })
    }
  })

  return {
    user: null,
    profile: null,
    loading: true,

    signIn: async (email: string, password: string) => {
      await signInWithEmailAndPassword(auth, email, password)
    },

    signInWithGoogle: async () => {
      const provider = new GoogleAuthProvider()
      provider.addScope('email')
      provider.addScope('profile')
      try {
        const result = await signInWithPopup(auth, provider)
        const u = result.user
        const userRef = doc(db, 'users', u.uid)
        const snap = await getDoc(userRef)
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName ?? u.email,
            role: 'resident',
            clinicId: null,
            createdAt: serverTimestamp(),
          }, { merge: true })
        }
      } catch (err: unknown) {
        const code = (err as { code?: string }).code
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider)
          return
        }
        throw err
      }
    },

    signOut: async () => {
      await firebaseSignOut(auth)
    },
  }
})
