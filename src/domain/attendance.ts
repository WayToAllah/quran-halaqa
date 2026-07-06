import type { SessionRecord, Student } from '../types';
import { getStudentName, recordsForStudent } from './students';

/**
 * Bonus/makeup halaqa days that shouldn't count against attendance
 * percentages. Ported as-is from the live app's hardcoded constant.
 *
 * TODO(phase 2): this becomes a per-halaqa Firestore setting
 * (`halaqat/{id}.excludedDates`) instead of a code constant, so changing it
 * doesn't require a redeploy.
 */
export const EXCLUDED_HALAQA_DATES: readonly string[] = ['2026-06-04'];

/** Minimum attendance % to earn the "نجم الحضور" badge.
 * TODO(phase 2): per-halaqa setting, see EXCLUDED_HALAQA_DATES note above. */
export const ATTENDANCE_BADGE_THRESHOLD = 70;

/**
 * Unique halaqa dates (excluding EXCLUDED_HALAQA_DATES), newest first. Date
 * strings are 'YYYY-MM-DD' so a plain string sort is chronologically correct.
 */
export function sortedHalaqaDatesDesc(allRecords: SessionRecord[]): string[] {
  return Array.from(
    new Set(allRecords.map((r) => r.date).filter((d): d is string => !!d && !EXCLUDED_HALAQA_DATES.includes(d))),
  ).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

/**
 * Counts backward from the most recent halaqa day: how many in a row this
 * student has an attendance record for, stopping at the first gap.
 */
export function computeAttendanceStreak(studentDatesSet: Set<string>, halaqaDatesDesc: string[]): number {
  let streak = 0;
  for (const d of halaqaDatesDesc) {
    if (studentDatesSet.has(d)) streak++;
    else break;
  }
  return streak;
}

export interface AttendanceRankEntry {
  name: string;
  uniqueDays: number;
  attendPct: number;
  rank: number;
}

/** Top-3 ranks get a medal emoji; everyone else just shows their number. */
export function rankBadgeEmoji(rank: number): string {
  if (rank === 1) return '👑';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

/**
 * Attendance % per student + dense ranking (tied students share a rank, no
 * gaps in the sequence — e.g. two students at #1 means the next is #2, not #3).
 */
export function getAttendanceRanking(
  students: Student[],
  recordsFilter: SessionRecord[],
  minPct?: number,
): { totalHalaqaDays: number; list: AttendanceRankEntry[] } {
  const totalHalaqaDays = new Set(
    recordsFilter.map((r) => r.date).filter((d): d is string => !!d && !EXCLUDED_HALAQA_DATES.includes(d)),
  ).size;

  const per = students
    .map((s) => {
      const name = getStudentName(s);
      const recs = recordsForStudent(s, recordsFilter);
      if (!recs.length) return null;
      const uniqueDays = new Set(recs.map((r) => r.date)).size;
      const attendPct = totalHalaqaDays > 0 ? Math.min(100, Math.round((uniqueDays / totalHalaqaDays) * 100)) : 0;
      return { name, uniqueDays, attendPct };
    })
    .filter((x): x is { name: string; uniqueDays: number; attendPct: number } => x !== null);

  // ترتيب تنازلي؛ الأيام الفريدة والاسم معيار ثانوي للترتيب البصري فقط (مش للمركز)
  per.sort((a, b) => b.attendPct - a.attendPct || b.uniqueDays - a.uniqueDays || a.name.localeCompare(b.name, 'ar'));

  const uniquePcts = [...new Set(per.map((x) => x.attendPct))].sort((a, b) => b - a);
  const rankByPct: Record<number, number> = {};
  uniquePcts.forEach((pct, i) => {
    rankByPct[pct] = i + 1;
  });

  const ranked: AttendanceRankEntry[] = per.map((x) => ({ ...x, rank: rankByPct[x.attendPct] }));
  const list = minPct != null ? ranked.filter((x) => x.attendPct >= minPct) : ranked;
  return { totalHalaqaDays, list };
}
