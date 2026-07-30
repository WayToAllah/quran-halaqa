import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
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
// NOTE: deliberately the DEFAULT in-memory cache.
//
// An IndexedDB-backed cache (persistentLocalCache) was tried and REVERTED: it
// broke sign-in. useAuth treats any getMembership() failure as 'denied', and a
// persistent client that cannot bring up IndexedDB — or that is offline with
// the members doc uncached — rejects the read instead of falling back, so the
// teacher was bounced back to the login screen after "جاري الدخول".
//
// Persisting the offline write queue is still worth having (a force-quit with
// a queued session currently loses it), but it must not be reintroduced until
// the auth path stops reading a Firestore doc failure as "not a member".
export const db = getFirestore(app);
export const auth = getAuth(app);

// Point at the local Emulator Suite during development/tests, never in a
// real production build (checked via Vite's import.meta.env.DEV).
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
