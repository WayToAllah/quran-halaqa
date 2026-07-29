import { initializeApp } from 'firebase/app';
import {
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
 * IndexedDB-backed cache, NOT the default in-memory one.
 *
 * A write made with no connection is queued by the SDK rather than failing. With
 * the memory cache that queue lives only as long as the tab: force-quitting the
 * app while a session was waiting to upload threw the session away silently, with
 * nothing shown to the teacher. Persisting the queue means it survives a restart
 * and flushes on its own when the connection comes back.
 *
 * The multi-tab manager is required because the halaqa is often open on a phone
 * and a laptop at once; the single-tab manager makes the second tab fail to
 * acquire the lease. If IndexedDB is unavailable (private browsing), the SDK
 * warns and falls back to memory rather than throwing.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const auth = getAuth(app);

// Point at the local Emulator Suite during development/tests, never in a
// real production build (checked via Vite's import.meta.env.DEV).
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
