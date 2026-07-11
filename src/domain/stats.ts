import type { Badge, PublicStats, SessionRecord, Student } from '../types';
import { byNewest } from './dates';
import { hasScore } from './scoring';
import { countAyat } from './suras';
import { getStudentName, recordsForStudent } from './students';
import { computeAttendanceStreak } from './attendance';

export const AYAT_MILESTONES: ReadonlyArray<{ key: string; threshold: number; icon: string; label: string }> = [
  { key: 'ayat100', threshold: 100, icon: '📖', label: 'حافظ ١٠٠ آية' },
  { key: 'ayat200', threshold: 200, icon: '📗', label: 'حافظ ٢٠٠ آية' },
  { key: 'ayat500', threshold: 500, icon: '📘', label: 'حافظ ٥٠٠ آية' },
];

/** Consecutive halaqa days attended to earn the "استمرارية" badge. */
export const ATTENDANCE_STREAK_THRESHOLD = 12;

/** avg(loh, madi) >= this earns the "التميّز" badge. */
export const EXCELLENCE_SCORE_THRESHOLD = 85;

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
  const { attendPct, allRecs, realRecsNewestFirst, totalAyat, avgLoh, avgMadi, halaqaDatesDesc } = opts;
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

  return badges;
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

  let totalAyat = 0;
  realRecs.forEach((r) => {
    (r.newLoh ?? []).forEach((l) => {
      if (l?.sura) totalAyat += countAyat(l.from, l.to);
    });
    (r.newMadi ?? []).forEach((m) => {
      if (m?.sura) totalAyat += countAyat(m.from, m.to);
    });
  });

  const uniqueDays = new Set(allRecs.map((r) => r.date)).size;
  const attendPct = totalHalaqaDays > 0 ? Math.min(100, Math.round((uniqueDays / totalHalaqaDays) * 100)) : 0;

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
    loh: hasScore(r.loh) ? { score: r.loh!.score!, ...(r.loh!.mistakes ? { mistakes: r.loh!.mistakes } : {}) } : null,
    madi: hasScore(r.madi)
      ? { score: r.madi!.score!, ...(r.madi!.mistakes ? { mistakes: r.madi!.mistakes } : {}) }
      : null,
    newLoh: (r.newLoh ?? []).filter((l) => l?.sura),
    newMadi: (r.newMadi ?? []).filter((m) => m?.sura),
    tajweed: r.tajweed?.sura ? { sura: r.tajweed.sura, from: r.tajweed.from || '', to: r.tajweed.to || '' } : null,
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
  const allMonths = new Set<string>([
    ...allRecs.map((r) => r.date?.slice(0, 7)).filter((m): m is string => !!m),
    ...halaqaDatesDesc.map((d) => d.slice(0, 7)),
  ]);
  allMonths.forEach((month) => {
    const monthHalaqaDays = halaqaDatesDesc.filter((d) => d.slice(0, 7) === month).length;
    const monthAllRecs = allRecs.filter((r) => r.date?.slice(0, 7) === month);
    const monthRealRecs = realRecs.filter((r) => r.date?.slice(0, 7) === month);
    const monthUniqueDays = new Set(monthAllRecs.map((r) => r.date)).size;
    const monthAttendPct = monthHalaqaDays > 0 ? Math.min(100, Math.round((monthUniqueDays / monthHalaqaDays) * 100)) : 0;
    const monthScoredLoh = monthRealRecs.filter((r) => hasScore(r.loh));
    const monthAvgLoh = monthScoredLoh.length
      ? Math.round(monthScoredLoh.reduce((a, r) => a + r.loh!.score!, 0) / monthScoredLoh.length)
      : null;
    let monthAyat = 0;
    monthRealRecs.forEach((r) => {
      (r.newLoh ?? []).forEach((l) => {
        if (l?.sura) monthAyat += countAyat(l.from, l.to);
      });
      (r.newMadi ?? []).forEach((m) => {
        if (m?.sura) monthAyat += countAyat(m.from, m.to);
      });
    });
    monthlyStats[month] = {
      attendPct: monthAttendPct,
      sessionsCount: monthAllRecs.length,
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
    uniqueDays,
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
