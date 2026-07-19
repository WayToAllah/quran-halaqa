/**
 * REVERSE of migrate-rtdb-to-firestore.ts.
 *
 * Copies the v2 Firestore data back into the old flat Realtime Database shape
 * used by the production admin app (index.html), so that if you work in v2 for
 * a while and then want to fall back to the old app, your v2 data comes with
 * you:
 *
 *   mosques/{mosqueId}/halaqat/{halaqaId}/students/{id}  → students/{fbKey(id)}
 *   mosques/{mosqueId}/halaqat/{halaqaId}/records/{id}   → records/{fbKey(id)}
 *   publicStats/{token}                                  → publicStats/{fbKey(token)}
 *
 * IDs/tokens are preserved exactly (via the same fbKey() the old app uses), so
 * every studentId↔record link and every child.html?t={token} link keeps
 * working once the old app reads them.
 *
 * ⚠️ SAFETY — this is the ONLY script that WRITES to the live RTDB, so it is
 * deliberately conservative:
 *   • Default is a NON-DESTRUCTIVE upsert: it set()s each doc by id. It never
 *     deletes anything from RTDB unless you explicitly ask.
 *   • --dry-run prints what WOULD happen and writes nothing.
 *   • --prune (mirror mode) additionally removes RTDB students/records that no
 *     longer exist in Firestore — and even then only actually deletes with
 *     --prune --confirm. Use only if you truly want RTDB to mirror Firestore.
 *
 * Like the forward script, this CANNOT run from the sandbox (needs Firebase
 * network). Run it from GitHub Actions (a companion workflow) or any machine
 * with Node.js + a service account key.
 *
 * Usage:
 *   tsx scripts/restore-firestore-to-rtdb.ts [--mosque-id altayseer]
 *       [--halaqa-id main] [--dry-run] [--prune [--confirm]]
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { fbKey } from '../src/domain/rtdbKey';
import { idsOnlyInSource } from '../src/domain/migrationDiff';

const RTDB_URL = 'https://quran-app-abe52-default-rtdb.firebaseio.com';

interface Args {
  mosqueId: string;
  halaqaId: string;
  dryRun: boolean;
  prune: boolean;
  confirm: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    mosqueId: get('--mosque-id') ?? 'altayseer',
    halaqaId: get('--halaqa-id') ?? 'main',
    dryRun: argv.includes('--dry-run'),
    prune: argv.includes('--prune'),
    confirm: argv.includes('--confirm'),
  };
}

/** Re-attach the doc id onto the body (Firestore keeps id only as the key). */
function withId(id: string, data: Record<string, unknown>): Record<string, unknown> {
  return { id, ...data };
}

async function main() {
  const args = parseArgs();
  initializeApp({ credential: applicationDefault(), databaseURL: RTDB_URL });

  const fs = getFirestore();
  const halaqaRef = fs.doc(`mosques/${args.mosqueId}/halaqat/${args.halaqaId}`);

  console.log(`Reading Firestore: mosques/${args.mosqueId}/halaqat/${args.halaqaId} ...`);
  const [studentsSnap, recordsSnap, publicStatsSnap] = await Promise.all([
    halaqaRef.collection('students').get(),
    halaqaRef.collection('records').get(),
    fs.collection('publicStats').get(),
  ]);

  const students = studentsSnap.docs.map((d) => withId(d.id, d.data()));
  const records = recordsSnap.docs.map((d) => withId(d.id, d.data()));
  const publicStats = publicStatsSnap.docs.map((d) => ({ token: d.id, data: d.data() }));

  console.log(
    `Found in Firestore: ${students.length} students, ${records.length} records, ${publicStats.length} publicStats`,
  );

  const db = getDatabase();

  // Read the CURRENT live RTDB ids so we can report what's new/changed and,
  // if pruning, what would be removed. Read-only.
  const [rtdbStudentsSnap, rtdbRecordsSnap] = await Promise.all([
    db.ref('students').once('value'),
    db.ref('records').once('value'),
  ]);
  const rtdbStudents = (rtdbStudentsSnap.val() ?? {}) as Record<string, Record<string, unknown>>;
  const rtdbRecords = (rtdbRecordsSnap.val() ?? {}) as Record<string, Record<string, unknown>>;

  // For prune: RTDB keys present that DON'T correspond to any Firestore id.
  const fsStudentKeys = students.map((s) => fbKey(String(s.id)));
  const fsRecordKeys = records.map((r) => fbKey(String(r.id)));
  const staleStudentKeys = idsOnlyInSource(Object.keys(rtdbStudents), fsStudentKeys);
  const staleRecordKeys = idsOnlyInSource(Object.keys(rtdbRecords), fsRecordKeys);

  console.log(`\nLive RTDB currently has ${Object.keys(rtdbStudents).length} students, ${Object.keys(rtdbRecords).length} records.`);
  console.log(`Upsert (set by id) would write ${students.length} students, ${records.length} records, ${publicStats.length} publicStats.`);
  if (args.prune) {
    console.log(`Prune would additionally remove ${staleStudentKeys.length} students, ${staleRecordKeys.length} records from RTDB (not in Firestore).`);
  }

  if (args.dryRun) {
    console.log('\n--dry-run: no writes. Samples of what would be written:');
    if (students[0]) console.log('  students/' + fbKey(String(students[0].id)), JSON.stringify(students[0]).slice(0, 150));
    if (records[0]) console.log('  records/' + fbKey(String(records[0].id)), JSON.stringify(records[0]).slice(0, 150));
    if (publicStats[0]) console.log('  publicStats/' + fbKey(publicStats[0].token), JSON.stringify(publicStats[0].data).slice(0, 150));
    if (args.prune && (staleStudentKeys.length || staleRecordKeys.length)) {
      console.log('\n  Would prune these RTDB keys (absent from Firestore):');
      for (const k of staleStudentKeys) console.log('    students/' + k, '|', rtdbStudents[k]?.name ?? '—');
      for (const k of staleRecordKeys) console.log('    records/' + k, '|', rtdbRecords[k]?.date ?? '—', '|', rtdbRecords[k]?.student ?? '—');
    }
    console.log('\nRe-run without --dry-run to actually write.');
    return;
  }

  // Upsert students.
  console.log(`\nWriting ${students.length} students to RTDB...`);
  {
    const updates: Record<string, unknown> = {};
    for (const s of students) updates['students/' + fbKey(String(s.id))] = s;
    await db.ref().update(updates);
  }

  // Upsert records.
  console.log(`Writing ${records.length} records to RTDB...`);
  {
    const updates: Record<string, unknown> = {};
    for (const r of records) updates['records/' + fbKey(String(r.id))] = r;
    await db.ref().update(updates);
  }

  // Upsert publicStats.
  console.log(`Writing ${publicStats.length} publicStats to RTDB...`);
  {
    const updates: Record<string, unknown> = {};
    for (const p of publicStats) updates['publicStats/' + fbKey(p.token)] = p.data;
    if (Object.keys(updates).length) await db.ref().update(updates);
  }

  // Optional prune (guarded): remove RTDB entries absent from Firestore.
  if (args.prune) {
    const total = staleStudentKeys.length + staleRecordKeys.length;
    console.log(`\nPrune: ${total} RTDB entr(ies) not present in Firestore.`);
    for (const k of staleStudentKeys) console.log('    students/' + k, '|', rtdbStudents[k]?.name ?? '—');
    for (const k of staleRecordKeys) console.log('    records/' + k, '|', rtdbRecords[k]?.date ?? '—', '|', rtdbRecords[k]?.student ?? '—');
    if (!args.confirm) {
      console.log('\n  --prune preview only (no --confirm): nothing deleted.');
    } else if (total) {
      const removals: Record<string, null> = {};
      for (const k of staleStudentKeys) removals['students/' + k] = null;
      for (const k of staleRecordKeys) removals['records/' + k] = null;
      await db.ref().update(removals);
      console.log(`  Deleted ${total} entr(ies) from RTDB.`);
    } else {
      console.log('  Nothing to prune.');
    }
  }

  // Verify by reading back RTDB counts.
  console.log('\nVerifying...');
  const [afterStudents, afterRecords] = await Promise.all([
    db.ref('students').once('value'),
    db.ref('records').once('value'),
  ]);
  const nStudents = Object.keys(afterStudents.val() ?? {}).length;
  const nRecords = Object.keys(afterRecords.val() ?? {}).length;
  console.log(`  RTDB now has ${nStudents} students, ${nRecords} records.`);
  console.log('\n✅ Restore complete.');
}

main()
  .then(() => {
    // Same reason as the forward script: the Admin RTDB module holds a
    // background socket open that otherwise prevents the process from exiting.
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
