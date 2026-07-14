import type { SessionRecord, Student } from '../types';
import { buildStudentPublicStats } from '../domain/stats';
import { getAttendanceRanking, ATTENDANCE_BADGE_THRESHOLD, sortedHalaqaDatesDesc } from '../domain/attendance';
import { setPublicStats } from './publicStats.repo';
import { getAllRecords } from './records.repo';
import { getAllStudents } from './students.repo';
import { getCachedHalaqaSnapshot } from './halaqaCache';
import { MOSQUE_ID, HALAQA_ID } from '../config';

/**
 * Recompute the shared, halaqa-wide inputs (total halaqa days, dense rank by
 * name, the descending halaqa-date list) that buildStudentPublicStats needs,
 * once, from the full students+records set. Returned so a caller pushing many
 * students at once (bulk attendance) computes them a single time.
 */
export function computeSharedStatsInputs(students: Student[], records: SessionRecord[]) {
  const { totalHalaqaDays, list } = getAttendanceRanking(students, records, ATTENDANCE_BADGE_THRESHOLD);
  // Keyed by stable student id, NOT display name — two students with the same
  // name must never share/steal a rank (same principle as studentMatch()).
  const rankById: Record<string, number> = {};
  list.forEach((x) => {
    rankById[x.id] = x.rank;
  });
  const halaqaDatesDesc = sortedHalaqaDatesDesc(records);
  return { totalHalaqaDays, rankById, halaqaDatesDesc };
}

/**
 * Build and publish one student's public projection to publicStats/{token}.
 *
 * This is the ONLY write to publicStats from the admin client. The parent page
 * (child) never writes anything. A student with no parentToken is skipped
 * (nothing to publish against). Errors are swallowed with a console warning —
 * a failed stats push must never block the actual record save that triggered
 * it (the projection self-heals on the next successful save).
 */
export async function publishStudentPublicStats(
  student: Student,
  allStudents: Student[],
  allRecords: SessionRecord[],
): Promise<void> {
  if (!student.parentToken) return;
  try {
    const { totalHalaqaDays, rankById, halaqaDatesDesc } = computeSharedStatsInputs(allStudents, allRecords);
    const rank = rankById[student.id] ?? null;
    const stats = buildStudentPublicStats(student, allRecords, totalHalaqaDays, rank, halaqaDatesDesc);
    await setPublicStats(student.parentToken, stats);
  } catch (err) {
    console.warn('publishStudentPublicStats failed for', student.id, err);
  }
}

/**
 * Republish publicStats for the given student ids after a save/delete/bulk
 * write, so the parent page reflects the change.
 *
 * Read source, in order of preference:
 *   1. The shared halaqaCache, when warm (the app UI is mounted, so its live
 *      onSnapshot already holds the full students+records set — including the
 *      write that just triggered this call, thanks to Firestore latency
 *      compensation making a local mutation visible to onSnapshot before the
 *      setDoc/deleteDoc promise even resolves). This costs ZERO extra reads,
 *      which is the whole point: an individual save no longer re-reads the
 *      entire ~3000-doc halaqa.
 *   2. A one-shot getAllStudents+getAllRecords fallback, only when the cache is
 *      cold (e.g. a headless/script context with no mounted UI) — preserving the
 *      exact same behaviour as before this optimisation.
 *
 * Fire-and-forget: never awaited by the UI in a way that blocks the user, and
 * failures only warn (the projection self-heals on the next successful save).
 */
export async function republishPublicStatsFor(studentIds: string[]): Promise<void> {
  if (!studentIds.length) return;
  try {
    const cached = getCachedHalaqaSnapshot(MOSQUE_ID, HALAQA_ID);
    const { students: allStudents, records: allRecords } = cached ?? {
      students: await getAllStudents(MOSQUE_ID, HALAQA_ID),
      records: await getAllRecords(MOSQUE_ID, HALAQA_ID),
    };
    const inputs = computeSharedStatsInputs(allStudents, allRecords);
    await Promise.all(
      studentIds.map(async (id) => {
        const student = allStudents.find((s) => s.id === id);
        if (!student?.parentToken) return;
        try {
          const rank = inputs.rankById[student.id] ?? null;
          const stats = buildStudentPublicStats(student, allRecords, inputs.totalHalaqaDays, rank, inputs.halaqaDatesDesc);
          await setPublicStats(student.parentToken, stats);
        } catch (err) {
          console.warn('republishPublicStatsFor: failed for', id, err);
        }
      }),
    );
  } catch (err) {
    console.warn('republishPublicStatsFor: fetch failed', err);
  }
}
