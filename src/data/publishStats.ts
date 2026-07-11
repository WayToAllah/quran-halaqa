import type { SessionRecord, Student } from '../types';
import { buildStudentPublicStats } from '../domain/stats';
import { getAttendanceRanking, ATTENDANCE_BADGE_THRESHOLD, sortedHalaqaDatesDesc } from '../domain/attendance';
import { getStudentName } from '../domain/students';
import { setPublicStats } from './publicStats.repo';
import { getAllRecords } from './records.repo';
import { getAllStudents } from './students.repo';
import { MOSQUE_ID, HALAQA_ID } from '../config';

/**
 * Recompute the shared, halaqa-wide inputs (total halaqa days, dense rank by
 * name, the descending halaqa-date list) that buildStudentPublicStats needs,
 * once, from the full students+records set. Returned so a caller pushing many
 * students at once (bulk attendance) computes them a single time.
 */
export function computeSharedStatsInputs(students: Student[], records: SessionRecord[]) {
  const { totalHalaqaDays, list } = getAttendanceRanking(students, records, ATTENDANCE_BADGE_THRESHOLD);
  const rankByName: Record<string, number> = {};
  list.forEach((x) => {
    rankByName[x.name] = x.rank;
  });
  const halaqaDatesDesc = sortedHalaqaDatesDesc(records);
  return { totalHalaqaDays, rankByName, halaqaDatesDesc };
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
    const { totalHalaqaDays, rankByName, halaqaDatesDesc } = computeSharedStatsInputs(allStudents, allRecords);
    const rank = rankByName[getStudentName(student)] ?? null;
    const stats = buildStudentPublicStats(student, allRecords, totalHalaqaDays, rank, halaqaDatesDesc);
    await setPublicStats(student.parentToken, stats);
  } catch (err) {
    console.warn('publishStudentPublicStats failed for', student.id, err);
  }
}

/**
 * Fetch the whole halaqa once and republish publicStats for the given student
 * ids. Call this after a save/delete/bulk-attendance write so the parent page
 * reflects the change. Fetching all records+students each time keeps the rank
 * and halaqa-day counts exact (matching the live app); saves are infrequent
 * enough that the extra reads are acceptable. Fire-and-forget: never awaited by
 * the UI in a way that blocks the user, and failures only warn.
 */
export async function republishPublicStatsFor(studentIds: string[]): Promise<void> {
  if (!studentIds.length) return;
  try {
    const [allStudents, allRecords] = await Promise.all([
      getAllStudents(MOSQUE_ID, HALAQA_ID),
      getAllRecords(MOSQUE_ID, HALAQA_ID),
    ]);
    const inputs = computeSharedStatsInputs(allStudents, allRecords);
    await Promise.all(
      studentIds.map(async (id) => {
        const student = allStudents.find((s) => s.id === id);
        if (!student?.parentToken) return;
        try {
          const rank = inputs.rankByName[getStudentName(student)] ?? null;
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
