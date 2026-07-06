import { useEffect, useState } from 'preact/hooks';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { auth } from '../../data/firebase';
import { getMembership } from '../../data/mosques.repo';
import { MOSQUE_ID } from '../../config';
import type { MosqueMember } from '../../types';

export type AuthStatus = 'loading' | 'signed-out' | 'checking-membership' | 'denied' | 'ready';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  member: MosqueMember | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

/**
 * Mirrors the live app's gate: nothing renders until a signed-in session is
 * confirmed (see index.html's `firebase.auth().onAuthStateChanged` +
 * `#login-screen`) — except this version additionally checks mosque
 * membership (Phase 2's rules require an explicit `members/{uid}` doc, not
 * just "any authenticated user").
 */
export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<MosqueMember | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setMember(null);
        setStatus('signed-out');
        return;
      }
      setStatus('checking-membership');
      try {
        const m = await getMembership(MOSQUE_ID, u.uid);
        setMember(m);
        setStatus(m ? 'ready' : 'denied');
      } catch (err) {
        console.error('membership check failed:', err);
        setStatus('denied');
      }
    });
    return unsubscribe;
  }, []);

  return {
    status,
    user,
    member,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signOutUser: async () => {
      await firebaseSignOut(auth);
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(auth, email);
    },
  };
}
