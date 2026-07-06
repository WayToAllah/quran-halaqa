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
 * both of which are outside that sandbox's allowed domains. This is meant
 * to run on Muhammad's own machine (or a CI job with normal internet).
 *
 * ---------------------------------------------------------------------------
 * HOW TO RUN (on a machine with normal internet access):
 *
 * 1. Export the current RTDB data:
 *    Firebase Console → Realtime Database → ⋮ menu → "Export JSON"
 *    Save it as e.g. rtdb-export.json in this folder.
 *
 * 2. Get a service account key (one-time):
 *    Firebase Console → Project Settings → Service Accounts →
 *    "Generate new private key" → save as serviceAccountKey.json
 *    (⚠️ do NOT commit this file — it's already covered by .gitignore's
 *    `*.json` service-account pattern; double check before committing)
 *
 * 3. Find your admin Firebase Auth UID:
 *    Firebase Console → Authentication → Users → copy the UID column
 *    for your admin account.
 *
 * 4. Enable Firestore (if not already): Firebase Console → Firestore
 *    Database → Create database.
 *
 * 5. Dry run first (no writes, just prints what WOULD happen):
 *    GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *      npx tsx scripts/migrate-rtdb-to-firestore.ts \
 *      --export ./rtdb-export.json \
 *      --admin-uid <YOUR_UID> \
 *      --dry-run
 *
 * 6. Then for real:
 *    GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *      npx tsx scripts/migrate-rtdb-to-firestore.ts \
 *      --export ./rtdb-export.json \
 *      --admin-uid <YOUR_UID>
 *
 * The script is idempotent (safe to re-run) — every write is a `set()` on
 * the same id, not an `add()`, so running it twice just overwrites with
 * the same data rather than duplicating anything.
 * ---------------------------------------------------------------------------
 */
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

interface Args {
  export: string;
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
  const exportPath = get('--export');
  const adminUid = get('--admin-uid');
  if (!exportPath || !adminUid) {
    console.error(
      'Usage: tsx scripts/migrate-rtdb-to-firestore.ts --export <path> --admin-uid <uid> [--mosque-id altayseer] [--halaqa-id main] [--dry-run]',
    );
    process.exit(1);
  }
  return {
    export: exportPath,
    adminUid,
    mosqueId: get('--mosque-id') ?? 'altayseer',
    halaqaId: get('--halaqa-id') ?? 'main',
    dryRun: argv.includes('--dry-run'),
  };
}

interface RtdbExport {
  students?: Record<string, Record<string, unknown>>;
  records?: Record<string, Record<string, unknown>>;
  publicStats?: Record<string, Record<string, unknown>>;
}

async function main() {
  const args = parseArgs();
  console.log(`Reading export from ${args.export} ...`);
  const raw: RtdbExport = JSON.parse(readFileSync(args.export, 'utf8'));

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

  // Reads the service account key from GOOGLE_APPLICATION_CREDENTIALS (see
  // the usage instructions at the top of this file) — never a hardcoded
  // credential in this repo. Fails with a clear error if that env var isn't set.
  initializeApp({ credential: applicationDefault() });
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

  // Verification: read back counts and compare against the source export.
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
