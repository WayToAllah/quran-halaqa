import type { SessionRecord, Student } from '../types';

export function getStudentName(s: Student | string): string {
  return typeof s === 'string' ? s : s.name;
}

/**
 * Robust student↔record matching. Records saved by the current build always
 * carry `studentId` (an immutable id), so renaming a student never breaks
 * history. Older records that predate `studentId` fall back to matching by
 * the name string captured at save time.
 */
export function studentMatch(
  rec: Pick<SessionRecord, 'studentId' | 'student'> | null | undefined,
  student: Student | null | undefined,
): boolean {
  if (!rec || !student) return false;
  if (rec.studentId && student.id) return rec.studentId === student.id;
  return rec.student === getStudentName(student);
}

export function recordsForStudent(student: Student, allRecords: SessionRecord[]): SessionRecord[] {
  return allRecords.filter((r) => studentMatch(r, student));
}

/** Whether this student already has ANY record (session or attendance-only)
 * on the given date — used by group attendance to skip already-covered
 * students instead of creating a duplicate entry. */
export function studentHasRecordOnDate(student: Student, dateStr: string, allRecords: SessionRecord[]): boolean {
  return allRecords.some((r) => studentMatch(r, student) && r.date === dateStr);
}

/**
 * Display name for a record: prefer the *current* name of the linked student
 * (so renames show up everywhere instantly), fall back to the name stored on
 * the record itself (covers legacy records and students that were deleted).
 */
export function displayStudentName(
  rec: Pick<SessionRecord, 'studentId' | 'student'>,
  allStudents: Student[],
): string {
  if (rec.studentId) {
    const s = allStudents.find((st) => st.id === rec.studentId);
    if (s) return getStudentName(s);
  }
  return rec.student || '—';
}
