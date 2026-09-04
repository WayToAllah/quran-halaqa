import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { auth } from '../../data/firebase';
import { getMembership } from '../../data/mosques.repo';
import { rememberMembership, recallMembership, forgetMembership } from '../../data/membershipCache';
import { classifyMembershipError } from '../../domain/authErrors';
import { useTenant } from '../tenant/TenantContext';
import type { MosqueMember } from '../../types';

export type AuthStatus =
  'loading' | 'signed-out' | 'checking-membership' | 'denied' | 'unreachable' | 'ready';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  member: MosqueMember | null;
  /** True when `ready` was reached from a device-local confirmation because the
   * server could not be reached — the app is usable but its data is stale. */
  offlineSession: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Re-run the membership check, for the retry button on `unreachable`. */
  retryMembership: () => void;
}

/**
 * Mirrors the live app's gate: nothing renders until a signed-in session is
 * confirmed (see index.html's `firebase.auth().onAuthStateChanged` +
 * `#login-screen`) — except this version additionally checks mosque
 * membership (Phase 2's rules require an explicit `members/{uid}` doc, not
 * just "any authenticated user").
 *
 * The membership check has THREE outcomes, not two. Collapsing them was a real
 * lockout: the server saying "not a member" and the app failing to ask at all
 * both ended as `denied`, so opening the app without a connection told a
 * legitimate teacher their account had no access. A read that never completed
 * is now `unreachable`, and if this device has already seen the server confirm
 * this account, the app opens against the local record instead.
 */
export function useAuth(): AuthState {
  const { mosqueId } = useTenant();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<MosqueMember | null>(null);
  const [offlineSession, setOfflineSession] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  // The signed-in user, so a retry can re-check without waiting for another
  // auth state change (which will not come — the session is already valid).
  const userRef = useRef<User | null>(null);

  const check = useCallback(
    async (u: User) => {
      setStatus('checking-membership');
      try {
        const m = await getMembership(mosqueId, u.uid);
        if (m) {
          rememberMembership(mosqueId, u.uid, m);
          setMember(m);
          setOfflineSession(false);
          setStatus('ready');
        } else {
          // An authoritative "no" — drop any local record so it can't outlive
          // the access it was recording.
          forgetMembership(mosqueId, u.uid);
          setMember(null);
          setStatus('denied');
        }
      } catch (err) {
        const failure = classifyMembershipError(err, navigator.onLine);
        if (failure === 'denied') {
          console.error('membership denied:', err);
          forgetMembership(mosqueId, u.uid);
          setMember(null);
          setStatus('denied');
          return;
        }
        // Never reached the server. Fall back to a previous confirmation from
        // this device if there is one; otherwise say so plainly rather than
        // accusing the account of having no access.
        const cached = recallMembership(mosqueId, u.uid);
        console.warn('membership check unreachable:', err);
        if (cached) {
          setMember(cached);
          setOfflineSession(true);
          setStatus('ready');
        } else {
          setMember(null);
          setStatus('unreachable');
        }
      }
    },
    [mosqueId],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      userRef.current = u;
      setUser(u);
      if (!u) {
        setMember(null);
        setOfflineSession(false);
        setStatus('signed-out');
        return;
      }
      void check(u);
    });
    return unsubscribe;
  }, [check]);

  // A retry re-runs the check against the session already in hand.
  useEffect(() => {
    if (retryTick === 0) return;
    const u = userRef.current;
    if (u) void check(u);
  }, [retryTick, check]);

  return {
    status,
    user,
    member,
    offlineSession,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signOutUser: async () => {
      await firebaseSignOut(auth);
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(auth, email);
    },
    retryMembership: () => setRetryTick((n) => n + 1),
  };
}
