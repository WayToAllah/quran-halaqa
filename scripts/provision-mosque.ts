/**
 * Provisions multi-tenant structure — mosques, halaqat, memberships, and the
 * `admins/{uid}` lookup the app reads at login.
 *
 * Creates/updates:
 *   mosques/{mosqueId}                    → { name, createdAt }
 *   mosques/{mosqueId}/members/{uid}      → { role }
 *   mosques/{mosqueId}/halaqat/{halaqaId} → { name, primaryTeacherUid, ... }
 *   admins/{uid}                          → { mosques: [{ mosqueId, label }] }
 *
 * ⚠️ CANNOT run from the dev sandbox (no network access to Firebase). Run it
 * via GitHub Actions — see .github/workflows/provision.yml — or on any machine
 * with internet + a service account key.
 *
 * Idempotent: every write is a merge-`set()` keyed by id, so re-running is
 * safe. It NEVER deletes anything and never touches students/records.
 *
 * ---------------------------------------------------------------------------
 * USAGE
 *
 *   npx tsx scripts/provision-mosque.ts --config provision.json [--dry-run]
 *
 * The config file describes what should exist. Example:
 *
 * {
 *   "mosques": [
 *     {
 *       "mosqueId": "altayseer",
 *       "name": "مسجد التيسير",
 *       "members": [{ "uid": "Hpbu8...", "role": "owner" }],
 *       "halaqat": [
 *         { "halaqaId": "main", "name": "الحلقة الرئيسية", "primaryTeacherUid": "Hpbu8..." },
 *         { "halaqaId": "asr",  "name": "حلقة العصر",      "primaryTeacherUid": "OTHER_UID" }
 *       ]
 *     }
 *   ]
 * }
 *
 * `admins/{uid}` entries are DERIVED from the memberships above — every uid
 * listed as a member of a mosque gets that mosque in its admins record — so
 * the two can never drift apart.
 * ---------------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import {
  buildAdminRecords,
  validateProvisionConfig,
  type ProvisionConfig,
} from '../src/domain/provisioning';

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    configPath: get('--config'),
    dryRun: argv.includes('--dry-run'),
  };
}

async function main() {
  const { configPath, dryRun } = parseArgs();
  if (!configPath) {
    console.error('Missing --config <path-to-json>');
    process.exit(1);
  }

  const cfg: ProvisionConfig = JSON.parse(readFileSync(configPath, 'utf8'));
  const errors = validateProvisionConfig(cfg);
  if (errors.length) {
    console.error('❌ Config is invalid:');
    for (const e of errors) console.error('   -', e);
    process.exit(1);
  }

  console.log(dryRun ? '🔍 DRY RUN — nothing will be written\n' : '✍️  Provisioning (live writes)\n');

  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();

  for (const m of cfg.mosques) {
    console.log(`mosques/${m.mosqueId}  "${m.name}"`);
    if (!dryRun) {
      await db
        .collection('mosques')
        .doc(m.mosqueId)
        // merge so re-running never clobbers createdAt or other fields
        .set({ name: m.name, createdAt: Date.now() }, { merge: true });
    }

    for (const mem of m.members) {
      const role = mem.role ?? 'owner';
      console.log(`  members/${mem.uid} → { role: '${role}' }`);
      if (!dryRun) {
        await db
          .collection('mosques')
          .doc(m.mosqueId)
          .collection('members')
          .doc(mem.uid)
          .set({ role }, { merge: true });
      }
    }

    for (const h of m.halaqat) {
      const payload = {
        name: h.name,
        excludedDates: h.excludedDates ?? [],
        attendanceBadgeThreshold: h.attendanceBadgeThreshold ?? 70,
        ...(h.primaryTeacherUid ? { primaryTeacherUid: h.primaryTeacherUid } : {}),
      };
      console.log(`  halaqat/${h.halaqaId} → "${h.name}"${h.primaryTeacherUid ? ` (teacher ${h.primaryTeacherUid})` : ''}`);
      if (!dryRun) {
        // merge is essential: halaqat/{id} may already hold niyyat and other
        // in-app settings, and students/records live underneath it.
        await db
          .collection('mosques')
          .doc(m.mosqueId)
          .collection('halaqat')
          .doc(h.halaqaId)
          .set(payload, { merge: true });
      }
    }
  }

  console.log('\nadmins/ lookup records:');
  for (const [uid, mosques] of buildAdminRecords(cfg)) {
    console.log(`  admins/${uid} → ${mosques.map((x) => x.mosqueId).join(', ')}`);
    if (!dryRun) {
      await db.collection('admins').doc(uid).set({ mosques }, { merge: true });
    }
  }

  console.log(dryRun ? '\n🔍 Dry run complete — no writes performed.' : '\n✅ Provisioning complete.');
}

main().catch((err) => {
  console.error('Provisioning failed:', err);
  process.exit(1);
});
