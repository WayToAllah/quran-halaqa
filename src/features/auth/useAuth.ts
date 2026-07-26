import { useCallback, useEffect, useState } from 'preact/hooks';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { auth } from '../../data/firebase';
import { getMembership, getUserMosques, listHalaqat } from '../../data/mosques.repo';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
import { pickActiveMosque } from '../../domain/activeMosque';
import { pickActiveHalaqa } from '../../domain/activeHalaqa';
import type { Halaqa, MosqueMember, UserMosqueLink } from '../../types';

export type AuthStatus = 'loading' | 'signed-out' | 'checking-membership' | 'denied' | 'ready';

const REMEMBERED_MOSQUE_KEY = 'activeMosqueId';
const REMEMBERED_HALAQA_KEY = 'activeHalaqaId';

/** The mosque + halaqa the app is currently operating on, plus the lists
 * needed to switch between them. Membership is mosque-level: every halaqa in
 * the active mosque is listed and usable, which is what lets a substitute
 * teacher record in a colleague's halaqa. */
export interface ActiveMosqueState {
  mosqueId: string;
  halaqaId: string;
  mosques: UserMosqueLink[];
  halaqat: Halaqa[];
  switchMosque: (mosqueId: string) => void;
  switchHalaqa: (halaqaId: string) => void;
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
 * app behaves exactly as before — one mosque, altayseer. This is what lets
 * multi-tenant ship without requiring the Console/admins doc to exist. */
const FALLBACK_LINK: UserMosqueLink = { mosqueId: MOSQUE_ID, label: 'مسجد التيسير' };

/** Used when a mosque has no halaqa DOCS. Firestore lets a subcollection
 * (halaqat/main/students) exist without its parent doc, which is exactly the
 * case in the current single-tenant data — so an empty listHalaqat() must NOT
 * be treated as "no halaqat", or the live app would find no students. */
const fallbackHalaqa = (): Halaqa => ({
  id: HALAQA_ID,
  name: 'الحلقة الرئيسية',
  excludedDates: [],
  attendanceBadgeThreshold: 70,
});

function readRemembered(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private mode / storage disabled — just fall back to default
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
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
  const [halaqat, setHalaqat] = useState<Halaqa[]>([fallbackHalaqa()]);
  const [activeHalaqaId, setActiveHalaqaId] = useState<string>(HALAQA_ID);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setMember(null);
        setMosques([FALLBACK_LINK]);
        setActiveId(MOSQUE_ID);
        setHalaqat([fallbackHalaqa()]);
        setActiveHalaqaId(HALAQA_ID);
        setStatus('signed-out');
        return;
      }
      setStatus('checking-membership');
      try {
        // Resolve the user's mosque list first. No admins doc → single-mosque
        // fallback, so existing single-tenant users are unaffected.
        const userMosques = await getUserMosques(u.uid);
        const list = userMosques && userMosques.mosques.length ? userMosques.mosques : [FALLBACK_LINK];
        const chosen = pickActiveMosque(list, readRemembered(REMEMBERED_MOSQUE_KEY)) ?? list[0];
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

  // Load the active mosque's halaqat whenever the mosque changes (or right
  // after membership is confirmed). Access is mosque-level, so every halaqa
  // here is fully usable — a substitute can pick any of them and record.
  useEffect(() => {
    if (status !== 'ready' || !activeId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listHalaqat(activeId);
        // Empty means "no halaqa docs", NOT "no data" — see fallbackHalaqa().
        const effective = list.length ? list : [fallbackHalaqa()];
        if (cancelled) return;
        setHalaqat(effective);
        const chosen =
          pickActiveHalaqa(effective, readRemembered(REMEMBERED_HALAQA_KEY), user?.uid ?? null) ?? effective[0];
        setActiveHalaqaId(chosen.id);
      } catch (err) {
        console.error('listHalaqat failed:', err);
        if (cancelled) return;
        // Never leave the app without a halaqa to read from.
        setHalaqat([fallbackHalaqa()]);
        setActiveHalaqaId(HALAQA_ID);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, activeId, user?.uid]);

  const switchMosque = useCallback(
    (mosqueId: string) => {
      const target = mosques.find((m) => m.mosqueId === mosqueId);
      if (!target || target.mosqueId === activeId) return;
      remember(REMEMBERED_MOSQUE_KEY, target.mosqueId);
      setActiveId(target.mosqueId);
      // The remembered halaqa belongs to the previous mosque; clear it so the
      // new mosque picks its own default (own circle → first) instead of
      // trying to keep an id that doesn't exist there.
      try {
        localStorage.removeItem(REMEMBERED_HALAQA_KEY);
      } catch {
        /* non-fatal */
      }
    },
    [mosques, activeId],
  );

  const switchHalaqa = useCallback(
    (halaqaId: string) => {
      const target = halaqat.find((h) => h.id === halaqaId);
      if (!target || target.id === activeHalaqaId) return;
      remember(REMEMBERED_HALAQA_KEY, target.id);
      setActiveHalaqaId(target.id);
    },
    [halaqat, activeHalaqaId],
  );

  const activeLink = mosques.find((m) => m.mosqueId === activeId) ?? mosques[0] ?? FALLBACK_LINK;
  const activeHalaqa = halaqat.find((h) => h.id === activeHalaqaId) ?? halaqat[0];

  return {
    status,
    user,
    member,
    active: {
      mosqueId: activeLink.mosqueId,
      halaqaId: activeHalaqa?.id ?? HALAQA_ID,
      mosques,
      halaqat,
      switchMosque,
      switchHalaqa,
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
