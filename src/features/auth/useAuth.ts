import { useCallback, useEffect, useState } from 'preact/hooks';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { auth } from '../../data/firebase';
import { getMembership, getUserMosques } from '../../data/mosques.repo';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
import { pickActiveMosque } from '../../domain/activeMosque';
import type { MosqueMember, UserMosqueLink } from '../../types';

export type AuthStatus = 'loading' | 'signed-out' | 'checking-membership' | 'denied' | 'ready';

const REMEMBERED_MOSQUE_KEY = 'activeMosqueId';

/** The single mosque the app is currently operating on, plus (when the user
 * belongs to more than one) the full list so a switcher can be shown. For a
 * one-mosque user, `mosques` has a single entry and `switchMosque` is a no-op
 * in practice. */
export interface ActiveMosqueState {
  mosqueId: string;
  halaqaId: string;
  mosques: UserMosqueLink[];
  switchMosque: (mosqueId: string) => void;
}

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  member: MosqueMember | null;
  active: ActiveMosqueState;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

/** The single-tenant fallback: if the user has no `admins/{uid}` doc yet, the
 * app behaves exactly as before — one mosque, altayseer/main. This is what
 * lets multi-tenant ship without requiring the Console/admins doc to exist. */
const FALLBACK_LINK: UserMosqueLink = { mosqueId: MOSQUE_ID, halaqaId: HALAQA_ID, label: 'مسجد التيسير' };

function readRememberedMosque(): string | null {
  try {
    return localStorage.getItem(REMEMBERED_MOSQUE_KEY);
  } catch {
    return null; // private mode / storage disabled — just fall back to first
  }
}

function rememberMosque(mosqueId: string) {
  try {
    localStorage.setItem(REMEMBERED_MOSQUE_KEY, mosqueId);
  } catch {
    /* non-fatal: the choice just won't persist across restarts */
  }
}

/**
 * Mirrors the live app's gate: nothing renders until a signed-in session is
 * confirmed, except this version additionally (1) checks mosque membership
 * (Phase 2's rules require an explicit `members/{uid}` doc) and (2) resolves
 * which mosque(s) the admin belongs to via `admins/{uid}`, replacing the old
 * hardcoded MOSQUE_ID. Missing admins doc → single-mosque altayseer fallback.
 */
export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<MosqueMember | null>(null);
  const [mosques, setMosques] = useState<UserMosqueLink[]>([FALLBACK_LINK]);
  const [activeId, setActiveId] = useState<string>(MOSQUE_ID);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setMember(null);
        setMosques([FALLBACK_LINK]);
        setActiveId(MOSQUE_ID);
        setStatus('signed-out');
        return;
      }
      setStatus('checking-membership');
      try {
        // Resolve the user's mosque list first. No admins doc → single-mosque
        // fallback, so existing single-tenant users are unaffected.
        const userMosques = await getUserMosques(u.uid);
        const list = userMosques && userMosques.mosques.length ? userMosques.mosques : [FALLBACK_LINK];
        const chosen = pickActiveMosque(list, readRememberedMosque()) ?? list[0];
        setMosques(list);
        setActiveId(chosen.mosqueId);

        // Membership is still enforced per-mosque by the rules; check the
        // chosen mosque's members/{uid} doc as the actual access gate.
        const m = await getMembership(chosen.mosqueId, u.uid);
        setMember(m);
        setStatus(m ? 'ready' : 'denied');
      } catch (err) {
        console.error('membership check failed:', err);
        setStatus('denied');
      }
    });
    return unsubscribe;
  }, []);

  const switchMosque = useCallback(
    (mosqueId: string) => {
      const target = mosques.find((m) => m.mosqueId === mosqueId);
      if (!target || target.mosqueId === activeId) return;
      rememberMosque(target.mosqueId);
      setActiveId(target.mosqueId);
    },
    [mosques, activeId],
  );

  const activeLink = mosques.find((m) => m.mosqueId === activeId) ?? mosques[0] ?? FALLBACK_LINK;

  return {
    status,
    user,
    member,
    active: {
      mosqueId: activeLink.mosqueId,
      halaqaId: activeLink.halaqaId,
      mosques,
      switchMosque,
    },
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
