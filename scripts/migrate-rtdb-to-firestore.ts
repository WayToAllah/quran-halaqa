/**
 * Migrates the current flat RTDB data (`students`, `records`, `publicStats`)
 * into the new Firestore hierarchy:
 *
 *   mosques/{mosqueId}
 *     members/{adminUid}: { role: 'owner' }
 *     halaqat/{halaqaId}
 *       students/{studentId}   ← same id, same fields, unchanged
 *       records/{recordId}     ← same id, same fields, unchanged
 *   publicStats/{token}        ← same token, same fields, unchanged (top-level)
 *
 * Student/record IDs and parentTokens are preserved EXACTLY, so every
 * `child.html?t={token}` link already sent out on WhatsApp keeps working
 * with zero changes once the app is pointed at Firestore.
 *
 * ⚠️ CANNOT be run from the sandboxed environment this was written in — it
 * needs real network access to Firebase (firebaseio.com, googleapis.com),
 * both outside that sandbox's allowed domains. Designed to run either:
 *   (a) via GitHub Actions — see .github/workflows/migrate.yml, triggered
 *       manually from the Actions tab, no local setup needed at all; or
 *   (b) on any machine with normal internet access and Node.js installed.
 *
 * By default this reads LIVE data straight from the Realtime Database via
 * the Admin SDK (no manual "Export JSON" step needed) — pass --export
 * <path> instead to migrate from a previously-downloaded export file.
 *
 * ---------------------------------------------------------------------------
 * HOW TO RUN VIA GITHUB ACTIONS (recommended — no local install needed):
 * See the numbered steps in .github/workflows/migrate.yml's header comment.
 *
 * HOW TO RUN LOCALLY (alternative, needs Node.js):
 * 1. Get a service account key (one-time): Firebase Console → Project
 *    Settings → Service Accounts → "Generate new private key" → save as
 *    serviceAccountKey.json (already covered by .gitignore — do not commit it)
 * 2. Find your admin Firebase Auth UID: Firebase Console → Authentication
 *    → Users → copy the UID column for your admin account.
 * 3. Enable Firestore (if not already): Firebase Console → Firestore
 *    Database → Create database.
 * 4. Dry run first (no writes, just prints what WOULD happen):
 *    GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *      npx tsx scripts/migrate-rtdb-to-firestore.ts --admin-uid <YOUR_UID> --dry-run
 * 5. Then for real (same command, minus --dry-run).
 *
 * The script is idempotent (safe to re-run) — every write is a `set()` on
 * the same id, not an `add()`, so running it twice just overwrites with
 * the same data rather than duplicating anything.
 * ---------------------------------------------------------------------------
 */
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

const RTDB_URL = 'https://quran-app-abe52-default-rtdb.firebaseio.com';

interface Args {
  exportPath?: string;
  adminUid: string;
  mosqueId: string;
  halaqaId: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const adminUid = get('--admin-uid');
  if (!adminUid) {
    console.error(
      'Usage: tsx scripts/migrate-rtdb-to-firestore.ts --admin-uid <uid> [--export <path>] [--mosque-id altayseer] [--halaqa-id main] [--dry-run]',
    );
    process.exit(1);
  }
  return {
    exportPath: get('--export'),
    adminUid,
    mosqueId: get('--mosque-id') ?? 'altayseer',
    halaqaId: get('--halaqa-id') ?? 'main',
    dryRun: argv.includes('--dry-run'),
  };
}

interface RtdbSnapshot {
  students?: Record<string, Record<string, unknown>>;
  records?: Record<string, Record<string, unknown>>;
  publicStats?: Record<string, Record<string, unknown>>;
}

async function loadFromRtdb(): Promise<RtdbSnapshot> {
  console.log(`Reading live data from ${RTDB_URL} ...`);
  const db = getDatabase();
  const [studentsSnap, recordsSnap, publicStatsSnap] = await Promise.all([
    db.ref('students').once('value'),
    db.ref('records').once('value'),
    db.ref('publicStats').once('value'),
  ]);
  return {
    students: studentsSnap.val() ?? {},
    records: recordsSnap.val() ?? {},
    publicStats: publicStatsSnap.val() ?? {},
  };
}

function loadFromFile(path: string): RtdbSnapshot {
  console.log(`Reading export from ${path} ...`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function main() {
  const args = parseArgs();

  // Every mode below needs credentials, including a dry-run that reads
  // live data — only a dry-run reading from a local --export file needs none.
  const needsFirebase = !args.exportPath || !args.dryRun;
  if (needsFirebase) {
    initializeApp({ credential: applicationDefault(), databaseURL: RTDB_URL });
  }

  const raw: RtdbSnapshot = args.exportPath ? loadFromFile(args.exportPath) : await loadFromRtdb();

  const students = raw.students ?? {};
  const records = raw.records ?? {};
  const publicStats = raw.publicStats ?? {};

  const studentIds = Object.keys(students);
  const recordIds = Object.keys(records);
  const tokenIds = Object.keys(publicStats);

  console.log(`Found: ${studentIds.length} students, ${recordIds.length} records, ${tokenIds.length} publicStats entries`);
  console.log(`Target: mosques/${args.mosqueId}/halaqat/${args.halaqaId}`);
  console.log(`Admin UID for membership: ${args.adminUid}`);

  if (args.dryRun) {
    console.log('\n--dry-run: no writes will be made. Sample of what would be written:');
    console.log('  mosques/' + args.mosqueId, '{ name: "مسجد التيسير", createdAt: <now> }');
    console.log('  mosques/' + args.mosqueId + '/members/' + args.adminUid, '{ role: "owner" }');
    console.log(
      '  mosques/' + args.mosqueId + '/halaqat/' + args.halaqaId,
      '{ name: "الحلقة الرئيسية", excludedDates: ["2026-06-04"], attendanceBadgeThreshold: 70 }',
    );
    if (studentIds[0]) {
      console.log(`  .../students/${studentIds[0]}`, JSON.stringify(students[studentIds[0]]).slice(0, 150));
    }
    if (recordIds[0]) {
      console.log(`  .../records/${recordIds[0]}`, JSON.stringify(records[recordIds[0]]).slice(0, 150));
    }
    if (tokenIds[0]) {
      console.log(`  publicStats/${tokenIds[0]}`, JSON.stringify(publicStats[tokenIds[0]]).slice(0, 150));
    }
    console.log('\nRe-run without --dry-run to actually write.');
    return;
  }

  const db = getFirestore();
  const halaqaRef = db.doc(`mosques/${args.mosqueId}/halaqat/${args.halaqaId}`);

  console.log('\nWriting mosque + membership + halaqa metadata...');
  await db.doc(`mosques/${args.mosqueId}`).set({ name: 'مسجد التيسير', createdAt: Date.now() }, { merge: true });
  await db.doc(`mosques/${args.mosqueId}/members/${args.adminUid}`).set({ role: 'owner' }, { merge: true });
  await halaqaRef.set(
    { name: 'الحلقة الرئيسية', excludedDates: ['2026-06-04'], attendanceBadgeThreshold: 70 },
    { merge: true },
  );

  console.log(`Writing ${studentIds.length} students...`);
  {
    let batch = db.batch();
    let count = 0;
    for (const id of studentIds) {
      batch.set(halaqaRef.collection('students').doc(id), students[id]);
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();
  }

  console.log(`Writing ${recordIds.length} records...`);
  {
    let batch = db.batch();
    let count = 0;
    for (const id of recordIds) {
      batch.set(halaqaRef.collection('records').doc(id), records[id]);
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();
  }

  console.log(`Writing ${tokenIds.length} publicStats entries...`);
  {
    let batch = db.batch();
    let count = 0;
    for (const token of tokenIds) {
      batch.set(db.doc(`publicStats/${token}`), publicStats[token]);
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();
  }

  // Verification: read back counts and compare against the source.
  console.log('\nVerifying...');
  const [studentsSnap, recordsSnap] = await Promise.all([
    halaqaRef.collection('students').count().get(),
    halaqaRef.collection('records').count().get(),
  ]);
  const writtenStudents = studentsSnap.data().count;
  const writtenRecords = recordsSnap.data().count;
  console.log(`  students: ${writtenStudents} written / ${studentIds.length} expected`);
  console.log(`  records:  ${writtenRecords} written / ${recordIds.length} expected`);

  if (writtenStudents !== studentIds.length || writtenRecords !== recordIds.length) {
    console.error('\n⚠️  MISMATCH — do not switch the app over to Firestore until this is resolved.');
    process.exit(1);
  }
  console.log('\n✅ Migration complete and verified.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
