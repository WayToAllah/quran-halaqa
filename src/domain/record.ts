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

/**
 * Validates a from/to ayah range against the real ayah count of the named
 * sura. Returns an empty object (no errors) when the sura isn't recognized
 * or fields are empty — matches the live app's "only validate once there's
 * something to validate" behavior.
 */
export function validateAyahRange(suraName: string, from: string, to: string): AyahRangeErrors {
  const sura = findSuraByName(suraName);
  if (!sura) return {};
  const max = sura[1];
  const fromNum = parseInt(from);
  const toNum = parseInt(to);
  const errors: AyahRangeErrors = {};

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
