import type { Badge, PublicStats, SessionRecord, Student } from '../types';
import { byNewest } from './dates';
import { hasScore } from './scoring';
import { itemAyat } from './suras';
import { getStudentName, recordsForStudent } from './students';
import { computeAttendanceStreak, enrolledHalaqaDates } from './attendance';
import { assignmentsGradedRepeat, isRepeatGrade } from './record';
import { visibleBadges } from './badges';

export const AYAT_MILESTONES: ReadonlyArray<{
  key: string;
  threshold: number;
  icon: string;
  label: string;
}> = [
  { key: 'ayat100', threshold: 100, icon: '📖', label: 'حافظ ١٠٠ آية' },
  { key: 'ayat200', threshold: 200, icon: '📗', label: 'حافظ ٢٠٠ آية' },
  { key: 'ayat500', threshold: 500, icon: '📘', label: 'حافظ ٥٠٠ آية' },
];

/** Consecutive halaqa days attended to earn the "استمرارية" badge. */
export const ATTENDANCE_STREAK_THRESHOLD = 12;

/** avg(loh, madi) >= this earns the "التميّز" badge. Tracks the top grade
 * band in scoring.ts (ممتاز) so the badge always means "excellent". */
export const EXCELLENCE_SCORE_THRESHOLD = 90;

/**
 * "Improving": average of the most recent 3 scored sessions is higher than
 * the average of the 3 before that. Needs at least 6 scored sessions so the
 * comparison isn't noise from one or two data points.
 */
export function computeIsImproving(realRecsNewestFirst: SessionRecord[]): boolean {
  const scored = realRecsNewestFirst
    .filter((r) => hasScore(r.loh) || hasScore(r.madi))
    .map((r) => {
      const vals: number[] = [];
      if (hasScore(r.loh)) vals.push(r.loh!.score!);
      if (hasScore(r.madi)) vals.push(r.madi!.score!);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
  if (scored.length < 6) return false;
  const recentAvg = scored.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const priorAvg = scored.slice(3, 6).reduce((a, b) => a + b, 0) / 3;
  return recentAvg > priorAvg;
}

export interface BuildBadgesOptions {
  attendPct: number;
  allRecs: SessionRecord[];
  realRecsNewestFirst: SessionRecord[];
  totalAyat: number;
  avgLoh: number | null;
  avgMadi: number | null;
  halaqaDatesDesc: string[];
}

export function buildStudentBadges(opts: BuildBadgesOptions): Badge[] {
  const { attendPct, allRecs, realRecsNewestFirst, totalAyat, avgLoh, avgMadi, halaqaDatesDesc } =
    opts;
  const badges: Badge[] = [];

  if (attendPct >= 100) badges.push({ key: 'perfectAttendance', icon: '💯', label: 'حضور مثالي' });

  const studentDates = new Set(allRecs.map((r) => r.date));
  const streak = computeAttendanceStreak(studentDates, halaqaDatesDesc);
  if (streak >= ATTENDANCE_STREAK_THRESHOLD) {
    badges.push({ key: 'streak', icon: '🔥', label: 'استمرارية ' + streak + ' يوم' });
  }

  AYAT_MILESTONES.forEach((m) => {
    if (totalAyat >= m.threshold) badges.push({ key: m.key, icon: m.icon, label: m.label });
  });

  const scores = [avgLoh, avgMadi].filter((v): v is number => v != null);
  if (scores.length) {
    const combinedAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (combinedAvg >= EXCELLENCE_SCORE_THRESHOLD) {
      badges.push({ key: 'excellence', icon: '🌟', label: 'التميّز' });
    }
  }

  if (computeIsImproving(realRecsNewestFirst)) {
    badges.push({ key: 'improving', icon: '📈', label: 'الأكثر تحسناً' });
  }

  // Hidden keys are filtered here (rather than at each push site) so the
  // award rules above stay readable and independent of what's on show.
  return visibleBadges(badges);
}

/**
 * Pure per-student stats builder — the exact shape written to the publicly
 * readable `publicStats/{token}` node that child.html reads. No phone
 * numbers here (removed 2026-07 for privacy; see PROJECT_CONTEXT.md §10).
 */
export function buildStudentPublicStats(
  student: Student,
  allRecords: SessionRecord[],
  totalHalaqaDays: number,
  rank: number | null,
  halaqaDatesDesc: string[],
): PublicStats {
  const name = getStudentName(student);
  const allRecs = recordsForStudent(student, allRecords);
  const realRecs = allRecs.filter((r) => !r.attendance_only).sort(byNewest);

  const scoredLohRecs = realRecs.filter((r) => hasScore(r.loh));
  const avgLoh = scoredLohRecs.length
    ? Math.round(scoredLohRecs.reduce((a, r) => a + r.loh!.score!, 0) / scoredLohRecs.length)
    : null;
  const scoredMadiRecs = realRecs.filter((r) => hasScore(r.madi));
  const avgMadi = scoredMadiRecs.length
    ? Math.round(scoredMadiRecs.reduce((a, r) => a + r.madi!.score!, 0) / scoredMadiRecs.length)
    : null;

  // "آية مُسمّعة" counts every recitation, so re-reciting a sura for مراجعة
  // legitimately counts again — the de-duplicated "محفوظة" figure is a
  // separate number, not yet built. What must NOT count is work graded
  // إعادة: the boy stood up and did not pass it. The verdict lives on the
  // NEXT session's record, hence the id map (tajweed carries its own score
  // on the same record, so it needs no lookup).
  const repeatMap = assignmentsGradedRepeat(realRecs);
  let totalAyat = 0;
  realRecs.forEach((r) => {
    const failed = repeatMap.get(r.id);
    if (!failed?.loh) {
      (r.newLoh ?? []).forEach((l) => {
        if (l?.sura) totalAyat += itemAyat(l);
      });
    }
    if (!failed?.madi) {
      (r.newMadi ?? []).forEach((m) => {
        if (m?.sura) totalAyat += itemAyat(m);
      });
    }
    if (r.tajweed?.sura && !isRepeatGrade(r.tajweed)) totalAyat += itemAyat(r.tajweed);
  });

  const studentDates = new Set(allRecs.map((r) => r.date).filter((d): d is string => !!d));
  const uniqueDays = studentDates.size;
  // Parent-facing denominator: halaqa days since THIS student's first recorded
  // day, not since the halaqa's first day. A student who joined mid-year was
  // never absent from the days before he enrolled. `totalHalaqaDays` is still
  // published (halaqa-wide, and the basis of `rank`) so the two numbers stay
  // distinguishable — see enrolledHalaqaDates() for why they differ.
  const enrolledDates = enrolledHalaqaDates(allRecs, halaqaDatesDesc);
  const enrolledDays = enrolledDates.length;
  // The numerator is the INTERSECTION with that same window, not the student's
  // raw date count. Anything the denominator drops — a bonus day in
  // EXCLUDED_HALAQA_DATES, an undated legacy row — must be dropped here too,
  // or the fraction compares two different calendars and reads too high (the
  // old Math.min(100, …) cap existed only to hide exactly that). Attendance
  // marks and full sessions both count, and a day carrying both counts once.
  const attendedDays = enrolledDates.filter((d) => studentDates.has(d)).length;
  const attendPct = enrolledDays > 0 ? Math.round((attendedDays / enrolledDays) * 100) : 0;

  const latest = realRecs[0];
  const currentTask = latest
    ? {
        date: latest.date,
        newLoh: (latest.newLoh ?? []).filter((l) => l?.sura),
        newMadi: (latest.newMadi ?? []).filter((m) => m?.sura),
      }
    : null;

  const recentSessions = realRecs.slice(0, 10).map((r) => ({
    date: r.date || '',
    loh: hasScore(r.loh)
      ? { score: r.loh!.score!, ...(r.loh!.mistakes ? { mistakes: r.loh!.mistakes } : {}) }
      : null,
    madi: hasScore(r.madi)
      ? { score: r.madi!.score!, ...(r.madi!.mistakes ? { mistakes: r.madi!.mistakes } : {}) }
      : null,
    newLoh: (r.newLoh ?? []).filter((l) => l?.sura),
    newMadi: (r.newMadi ?? []).filter((m) => m?.sura),
    // The tajweed assignment is deliberately NOT published. child.html never
    // rendered it, and the projection dropped its score/stars/note anyway, so
    // the published object could only ever have read "التجويد: الفاتحة (١-٧)"
    // with no verdict attached. Its ayat still count toward totalAyat above —
    // this hides a half-fact from parents, it does not erase the boy's work.
    // Re-enabling it means publishing `score` too, not restoring this line.
    note: r.note || '',
  }));

  // Lightweight full-history series for the progress chart — oldest first so
  // the chart reads right-to-left (oldest → newest) in RTL.
  const scoreHistory = [...realRecs]
    .reverse()
    .filter((r) => hasScore(r.loh) || hasScore(r.madi))
    .map((r) => ({
      date: r.date || '',
      loh: hasScore(r.loh) ? r.loh!.score! : null,
      madi: hasScore(r.madi) ? r.madi!.score! : null,
    }));

  // Per-month pre-aggregation for the page's month filter. Every month that
  // appears in the student's records OR in the halaqa calendar gets an entry.
  const monthlyStats: PublicStats['monthlyStats'] = {};
  // Same enrollment window as attendPct above: months entirely before the
  // student joined are not his months, so they never appear here (they would
  // otherwise each show a flat 0%).
  const allMonths = new Set<string>([
    ...allRecs.map((r) => r.date?.slice(0, 7)).filter((m): m is string => !!m),
    ...enrolledDates.map((d) => d.slice(0, 7)),
  ]);
  allMonths.forEach((month) => {
    const monthEnrolledDates = enrolledDates.filter((d) => d.slice(0, 7) === month);
    const monthHalaqaDays = monthEnrolledDates.length;
    const monthRealRecs = realRecs.filter((r) => r.date?.slice(0, 7) === month);
    // Same intersection rule as the all-time figure above.
    const monthAttendedDays = monthEnrolledDates.filter((d) => studentDates.has(d)).length;
    const monthAttendPct =
      monthHalaqaDays > 0 ? Math.round((monthAttendedDays / monthHalaqaDays) * 100) : 0;
    const monthScoredLoh = monthRealRecs.filter((r) => hasScore(r.loh));
    const monthAvgLoh = monthScoredLoh.length
      ? Math.round(monthScoredLoh.reduce((a, r) => a + r.loh!.score!, 0) / monthScoredLoh.length)
      : null;
    let monthAyat = 0;
    monthRealRecs.forEach((r) => {
      // repeatMap comes from the full history on purpose: an assignment given
      // on the last day of a month is graded in the next one.
      const failed = repeatMap.get(r.id);
      if (!failed?.loh) {
        (r.newLoh ?? []).forEach((l) => {
          if (l?.sura) monthAyat += itemAyat(l);
        });
      }
      if (!failed?.madi) {
        (r.newMadi ?? []).forEach((m) => {
          if (m?.sura) monthAyat += itemAyat(m);
        });
      }
      if (r.tajweed?.sura && !isRepeatGrade(r.tajweed)) monthAyat += itemAyat(r.tajweed);
    });
    monthlyStats[month] = {
      attendPct: monthAttendPct,
      attendedDays: monthAttendedDays,
      totalAyat: monthAyat,
      avgLoh: monthAvgLoh,
    };
  });

  const badges = buildStudentBadges({
    attendPct,
    allRecs,
    realRecsNewestFirst: realRecs,
    totalAyat,
    avgLoh,
    avgMadi,
    halaqaDatesDesc,
  });

  return {
    name,
    updatedAt: Date.now(),
    totalHalaqaDays,
    enrolledHalaqaDays: enrolledDays,
    uniqueDays,
    attendedDays,
    attendPct,
    rank,
    sessionsCount: realRecs.length,
    totalAyat,
    avgLoh,
    avgMadi,
    badges,
    currentTask,
    recentSessions,
    scoreHistory,
    monthlyStats,
  };
}
