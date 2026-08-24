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
    new Set(
      allRecords
        .map((r) => r.date)
        .filter((d): d is string => !!d && !EXCLUDED_HALAQA_DATES.includes(d)),
    ),
  ).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

/**
 * Counts backward from the most recent halaqa day: how many in a row this
 * student has an attendance record for, stopping at the first gap.
 */
export function computeAttendanceStreak(
  studentDatesSet: Set<string>,
  halaqaDatesDesc: string[],
): number {
  let streak = 0;
  for (const d of halaqaDatesDesc) {
    if (studentDatesSet.has(d)) streak++;
    else break;
  }
  return streak;
}

/**
 * The student's own start date: the earliest date on any of their records
 * (a plain attendance mark counts — it means the student was in the halaqa
 * that day). Returns null when the student has no dated record at all.
 *
 * Dates are 'YYYY-MM-DD', so lexicographic `<` is chronological.
 */
/**
 * Mirror of computeAttendanceStreak: how many of the most recent halaqa days
 * in a row the student missed. Counting stops at the first day they attended,
 * so this measures a *current* lapse, not lifetime absences.
 *
 * A student who never attended returns the full day count — the caller is
 * expected to distinguish that case, since a brand-new enrollee and a student
 * who drifted away produce the same number but need very different follow-up.
 */
export function computeAbsenceStreak(
  studentDatesSet: Set<string>,
  halaqaDatesDesc: string[],
): number {
  let streak = 0;
  for (const d of halaqaDatesDesc) {
    if (studentDatesSet.has(d)) break;
    streak++;
  }
  return streak;
}

export function firstRecordDate(studentRecords: SessionRecord[]): string | null {
  let earliest: string | null = null;
  for (const r of studentRecords) {
    const d = r.date;
    if (!d) continue;
    if (earliest === null || d < earliest) earliest = d;
  }
  return earliest;
}

/**
 * The halaqa days that a given student was actually enrolled for: every halaqa
 * date from their first recorded day onward. A student who joined in July must
 * not be measured against June days he was never expected to attend.
 *
 * This is the denominator for the PARENT-facing attendance % only. The admin
 * ranking (getAttendanceRanking) deliberately keeps the halaqa-wide
 * denominator so every student on the leaderboard is measured on the same
 * scale — see PROJECT_CONTEXT.md §5.
 *
 * `halaqaDates` is expected to already have EXCLUDED_HALAQA_DATES removed
 * (i.e. the output of sortedHalaqaDatesDesc); order is preserved.
 */
export function enrolledHalaqaDates(
  studentRecords: SessionRecord[],
  halaqaDates: string[],
): string[] {
  const first = firstRecordDate(studentRecords);
  if (first === null) return [];
  const seen = new Set<string>();
  return halaqaDates.filter((d) => {
    if (d < first || seen.has(d)) return false;
    seen.add(d);
    return true;
  });
}

export interface PersonalAttendanceRankEntry {
  id: string;
  name: string;
  /** Enrolled halaqa days the student actually turned up for. */
  attendedDays: number;
  /** Halaqa days inside the window from the student's join date onward. */
  enrolledDays: number;
  attendPct: number;
  rank: number;
}

/**
 * Attendance % measured against each student's OWN enrolment window — the same
 * basis the parent page uses (see buildStats in stats.ts) — as opposed to
 * getAttendanceRanking, which measures everyone against every halaqa day so
 * the admin leaderboard stays a single comparable scale.
 *
 * `windowRecords` is the period-filtered set (what the month chips produce);
 * `allRecords` is the UNFILTERED history and is used for one thing only:
 * finding when each student joined. Deriving the join date from the filtered
 * set would restart every long-standing student's window at their first
 * attendance inside the selected month and hand them a free 100%.
 *
 * Population matches getAttendanceRanking: a student with no record at all
 * inside the window is left out rather than shown at 0%, so toggling between
 * the two views changes the percentages, not the names.
 */
export function getPersonalAttendanceRanking(
  students: Student[],
  windowRecords: SessionRecord[],
  allRecords: SessionRecord[],
): { list: PersonalAttendanceRankEntry[] } {
  const windowDates = sortedHalaqaDatesDesc(windowRecords);

  const per = students
    .map((s) => {
      const recs = recordsForStudent(s, windowRecords);
      if (!recs.length) return null;
      const enrolled = enrolledHalaqaDates(recordsForStudent(s, allRecords), windowDates);
      const enrolledDays = enrolled.length;
      const studentDates = new Set(recs.map((r) => r.date));
      const attendedDays = enrolled.filter((d) => studentDates.has(d)).length;
      const attendPct =
        enrolledDays > 0 ? Math.min(100, Math.round((attendedDays / enrolledDays) * 100)) : 0;
      return { id: s.id, name: getStudentName(s), attendedDays, enrolledDays, attendPct };
    })
    .filter((x): x is Omit<PersonalAttendanceRankEntry, 'rank'> => x !== null);

  // الأيام المحضورة معيار ثانوي للعرض فقط: نسبة ١٠٠٪ على ٢٠ يوم تسبق ١٠٠٪ على
  // يومين، من غير ما تفرق في رقم المركز.
  per.sort(
    (a, b) =>
      b.attendPct - a.attendPct ||
      b.attendedDays - a.attendedDays ||
      a.name.localeCompare(b.name, 'ar'),
  );

  const uniquePcts = [...new Set(per.map((x) => x.attendPct))].sort((a, b) => b - a);
  const rankByPct: Record<number, number> = {};
  uniquePcts.forEach((pct, i) => {
    rankByPct[pct] = i + 1;
  });

  return { list: per.map((x) => ({ ...x, rank: rankByPct[x.attendPct] })) };
}

export interface AttendanceRankEntry {
  /** Stable student id — the correct key for any rank lookup (names can
   * collide or change; see studentMatch() in students.ts for the principle). */
  id: string;
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
    recordsFilter
      .map((r) => r.date)
      .filter((d): d is string => !!d && !EXCLUDED_HALAQA_DATES.includes(d)),
  ).size;

  const per = students
    .map((s) => {
      const name = getStudentName(s);
      const recs = recordsForStudent(s, recordsFilter);
      if (!recs.length) return null;
      const uniqueDays = new Set(recs.map((r) => r.date)).size;
      const attendPct =
        totalHalaqaDays > 0 ? Math.min(100, Math.round((uniqueDays / totalHalaqaDays) * 100)) : 0;
      return { id: s.id, name, uniqueDays, attendPct };
    })
    .filter(
      (x): x is { id: string; name: string; uniqueDays: number; attendPct: number } => x !== null,
    );

  // ترتيب تنازلي؛ الأيام الفريدة والاسم معيار ثانوي للترتيب البصري فقط (مش للمركز)
  per.sort(
    (a, b) =>
      b.attendPct - a.attendPct ||
      b.uniqueDays - a.uniqueDays ||
      a.name.localeCompare(b.name, 'ar'),
  );

  const uniquePcts = [...new Set(per.map((x) => x.attendPct))].sort((a, b) => b - a);
  const rankByPct: Record<number, number> = {};
  uniquePcts.forEach((pct, i) => {
    rankByPct[pct] = i + 1;
  });

  const ranked: AttendanceRankEntry[] = per.map((x) => ({ ...x, rank: rankByPct[x.attendPct] }));
  const list = minPct != null ? ranked.filter((x) => x.attendPct >= minPct) : ranked;
  return { totalHalaqaDays, list };
}
