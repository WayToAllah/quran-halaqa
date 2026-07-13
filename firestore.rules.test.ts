/**
 * Firestore rules tests — run against the real Firestore Emulator via
 * @firebase/rules-unit-testing, NOT against production. This is the
 * automated replacement for manually clicking through the RTDB Rules
 * Playground in Firebase Console.
 *
 * ⚠️ These tests download and run a JVM-based emulator binary from
 * storage.googleapis.com on first use. That domain is blocked in the
 * sandboxed environment these rules were authored in, so they could not be
 * executed there — this was verified directly (the download failed with a
 * 403/allowlist error) rather than assumed. They run correctly:
 *   - locally on any machine with normal internet access: `npm run test:rules`
 *   - in CI: see .github/workflows/ci.yml, which has unrestricted network
 * Do not treat this file as "tested" until one of those has actually run it.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-quran-halaqa-rules-test';
const MOSQUE_ID = 'altayseer';
const HALAQA_ID = 'main';
const ADMIN_UID = 'admin_1';
const OUTSIDER_UID = 'outsider_1';
const TOKEN = 'test-token-abc123';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed as a privileged (rules-bypassing) admin context: the mosque doc,
  // one member (ADMIN_UID), and one student — mirrors what a real deployment
  // looks like before any client rule is exercised.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'mosques', MOSQUE_ID), { name: 'مسجد التيسير', createdAt: Date.now() });
    await setDoc(doc(db, 'mosques', MOSQUE_ID, 'members', ADMIN_UID), { role: 'admin' });
    await setDoc(doc(db, 'mosques', MOSQUE_ID, 'halaqat', HALAQA_ID), {
      name: 'الحلقة الرئيسية',
      excludedDates: [],
      attendanceBadgeThreshold: 70,
    });
    await setDoc(doc(db, 'mosques', MOSQUE_ID, 'halaqat', HALAQA_ID, 'students', 's_1'), {
      name: 'زيد احمد',
    });
    await setDoc(doc(db, 'publicStats', TOKEN), { name: 'زيد احمد', attendPct: 80 });
  });
});

describe('students/records — mosque membership required', () => {
  it('denies an unauthenticated client from reading students', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'mosques', MOSQUE_ID, 'halaqat', HALAQA_ID, 'students', 's_1')));
  });

  it('denies an unauthenticated client from writing students', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, 'mosques', MOSQUE_ID, 'halaqat', HALAQA_ID, 'students', 's_evil'), { name: 'x' }),
    );
  });

  it('denies a signed-in user who is NOT a member of this mosque', async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(getDoc(doc(db, 'mosques', MOSQUE_ID, 'halaqat', HALAQA_ID, 'students', 's_1')));
    await assertFails(
      setDoc(doc(db, 'mosques', MOSQUE_ID, 'halaqat', HALAQA_ID, 'students', 's_1'), { name: 'مخترق' }),
    );
  });

  it('allows a mosque member to read and write students', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(getDoc(doc(db, 'mosques', MOSQUE_ID, 'halaqat', HALAQA_ID, 'students', 's_1')));
    await assertSucceeds(
      setDoc(doc(db, 'mosques', MOSQUE_ID, 'halaqat', HALAQA_ID, 'students', 's_2'), { name: 'طالب جديد' }),
    );
  });

  it('allows a mosque member to delete a student', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(deleteDoc(doc(db, 'mosques', MOSQUE_ID, 'halaqat', HALAQA_ID, 'students', 's_1')));
  });
});

describe('mosques/{id} and members/{uid} — no client writes ever', () => {
  it('denies any client (even a member) from writing the mosque document itself', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertFails(setDoc(doc(db, 'mosques', MOSQUE_ID), { name: 'اسم مزوّر' }));
  });

  it('denies any client from writing a membership doc (self-granting access)', async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(setDoc(doc(db, 'mosques', MOSQUE_ID, 'members', OUTSIDER_UID), { role: 'owner' }));
  });
});

describe('publicStats/{token} — public get, no list, member-only write (transitional)', () => {
  it('allows an unauthenticated read of a single known token', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'publicStats', TOKEN)));
  });

  it('denies an UNauthenticated client (a parent) from writing publicStats', async () => {
    const dbAnon = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(dbAnon, 'publicStats', TOKEN), { name: 'مزوّر' }));
  });

  it('denies an ANONYMOUS-provider signed-in user from writing publicStats', async () => {
    // The real attack vector: Anonymous auth is enabled on this project (the
    // production parent-form.html uses it), so anyone can signInAnonymously()
    // and pass a bare `request.auth != null` check. Membership must be what
    // gates the write, not mere sign-in.
    const dbAnonAuth = testEnv
      .authenticatedContext('anon_visitor_1', { firebase: { sign_in_provider: 'anonymous' } })
      .firestore();
    await assertFails(setDoc(doc(dbAnonAuth, 'publicStats', TOKEN), { name: 'مزوّر', attendPct: 0 }));
  });

  it('denies a signed-in NON-member (e.g. self-registered email account) from writing publicStats', async () => {
    const dbOutsider = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(setDoc(doc(dbOutsider, 'publicStats', TOKEN), { name: 'مزوّر' }));
  });

  it('allows a mosque MEMBER to write publicStats (transitional — moves to Cloud Function in Phase 5)', async () => {
    const dbAdmin = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(setDoc(doc(dbAdmin, 'publicStats', TOKEN), { name: 'زيد احمد', attendPct: 80 }));
  });
});
