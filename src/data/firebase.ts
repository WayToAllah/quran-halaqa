import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Same Firebase project as production (quran-app-abe52); this app talks to
// Firestore instead of the Realtime Database once Phase 2's migration runs.
// Public config values (apiKey etc.) are not secrets — Firestore/RTDB access
// control is enforced entirely by the security rules, never by hiding this.
const firebaseConfig = {
  apiKey: 'AIzaSyCLzsd-tyAPKoS6HQ-Kw6LEwaxPSibbKSg',
  authDomain: 'quran-app-abe52.firebaseapp.com',
  projectId: 'quran-app-abe52',
  storageBucket: 'quran-app-abe52.firebasestorage.app',
  messagingSenderId: '484959710944',
  appId: '1:484959710944:web:454059b1f2136c0d73aa85',
};

export const app = initializeApp(firebaseConfig);
/**
 * IndexedDB-backed cache when the browser can support one, otherwise the
 * default in-memory cache.
 *
 * Why it matters: reads are served from the local copy when there is no
 * connection, so the student picker, the log and the previous-session lookup
 * still work offline instead of coming back empty. It also persists the OFFLINE
 * WRITE QUEUE, so force-quitting the app with a session waiting to upload no
 * longer discards it.
 *
 * This was tried once before and reverted, because it broke sign-in: the
 * membership read rejected instead of falling back and useAuth read ANY failure
 * there as "not a member", bouncing the teacher back to the login screen. That
 * root cause is fixed (see classifyMembershipError + useAuth) — a read that
 * cannot complete is now 'unreachable', never a rejection — which is what makes
 * it safe to enable again.
 *
 * The guard below only covers environments with NO IndexedDB at all (some
 * privacy modes). A store that exists but fails later can't be detected here,
 * since `db` has to be constructed synchronously; in that case the SDK warns
 * and reads fail, which the auth path now survives rather than locking out.
 *
 * Multi-tab manager: the halaqa is often open on a phone and a laptop at once,
 * and the single-tab manager makes the second one fail to acquire the lease.
 */
const canPersist = (() => {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
})();

export const db = canPersist
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : getFirestore(app);
export const auth = getAuth(app);

// Point at the local Emulator Suite during development/tests, never in a
// real production build (checked via Vite's import.meta.env.DEV).
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
