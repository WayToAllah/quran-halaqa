import type { SessionRecord, Student, SuraAssignment } from '../types';
import { byNewest } from './dates';
import { recordsForStudent } from './students';
import { findSuraByName } from './suras';

/**
 * Finds the session whose newLoh/newMadi assignment the admin is about to
 * evaluate today — the student's most recent REAL (non attendance-only)
 * session, excluding the one currently being edited.
 *
 * When editing an existing session, "previous" must mean chronologically
 * BEFORE the one being edited, not simply "the most recent session ever" —
 * otherwise editing a student's latest session makes it its own "previous
 * session", and the evaluation card ends up showing the exact same
 * newLoh/newMadi as the new-assignment section right below it. Ported
 * from the live app's onStudentChange().
 */
export function findPreviousSession(
  student: Student,
  allRecords: SessionRecord[],
  excludeRecordId?: string,
): SessionRecord | null {
  let recs = recordsForStudent(student, allRecords).filter((r) => !r.attendance_only);

  if (excludeRecordId) {
    const editingRec = allRecords.find((r) => r.id === excludeRecordId);
    if (editingRec) {
      recs = recs.filter((r) => r.id !== excludeRecordId && byNewest(r, editingRec) > 0);
    }
  }

  if (!recs.length) return null;
  return [...recs].sort(byNewest)[0];
}

/** Reads the "assigned" sura list off a session, preferring the modern
 * newLoh/newMadi array shape and falling back to the legacy single-object
 * shape for pre-migration records. */
export function extractAssignedSuras(field: SuraAssignment[] | undefined, legacy: unknown): SuraAssignment[] {
  if (field?.length) return field.filter((f) => f?.sura);
  const legacyObj = legacy as SuraAssignment | undefined;
  if (legacyObj?.sura) return [legacyObj];
  return [];
}

export interface AyahRangeErrors {
  fromError?: string;
  toError?: string;
}

/** A row counts as filled-in and worth saving when it has a sura, and — if it
 * is in whole-sura range mode — also an end sura. A range row missing its
 * `toSura` is treated as incomplete and dropped on save (mirrors the live
 * app's `.filter(x => x.range ? (x.sura && x.toSura) : x.sura)`). */
export function isRowComplete(row: SuraAssignment): boolean {
  if (!row.sura) return false;
  if (row.range) return !!row.toSura;
  return true;
}

/** Normalizes an entry row into the exact shape persisted to the DB. A range
 * row saves as `{sura, toSura, range:true}` with no ayah numbers; an ordinary
 * row saves as `{sura, from, to}` with no range fields. This prevents a stale
 * `toSura`/`range` (or a leftover `from`/`to`) from a toggled row leaking into
 * the saved record — matching the live index.html save mapping. */
export function cleanAssignmentRow(row: SuraAssignment): SuraAssignment {
  if (row.range && row.toSura) {
    return { sura: row.sura, toSura: row.toSura, range: true };
  }
  const out: SuraAssignment = { sura: row.sura };
  if (row.from) out.from = row.from;
  if (row.to) out.to = row.to;
  return out;
}

/**
 * Validates a from/to ayah range against the real ayah count of the named
 * sura. Returns an empty object (no errors) when the sura isn't recognized
 * or fields are empty — matches the live app's "only validate once there's
 * something to validate" behavior.
 */
export function validateAyahRange(suraName: string, from: string, to: string): AyahRangeErrors {
  const sura = findSuraByName(suraName);
  if (!sura) return {};
  const max = sura.count;
  const fromNum = parseInt(from);
  const toNum = parseInt(to);
  const errors: AyahRangeErrors = {};

  // Paired-field rule: an ayah range needs both ends. One filled without the
  // other is an incomplete range (e.g. "من ٥" with no end). Leaving BOTH empty
  // is allowed — that means "the whole sura", no ayah numbers.
  if (from && !to) {
    errors.toError = 'أكمل نهاية النطاق';
  } else if (to && !from) {
    errors.fromError = 'أكمل بداية النطاق';
  }

  if (from && (fromNum < 1 || fromNum > max)) {
    errors.fromError = `الآية بين ١ و${max}`;
  }
  if (to && (toNum < 1 || toNum > max)) {
    errors.toError = `الآية بين ١ و${max}`;
  } else if (to && from && !errors.fromError && toNum < fromNum) {
    errors.toError = 'يجب أن تكون أكبر من آية البداية';
  }
  return errors;
}
