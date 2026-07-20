import type { SessionRecord, Student } from '../types';
import { hasScore, scoreName } from './scoring';
import { itemAyat } from './suras';
import { getStudentName, recordsForStudent } from './students';
import { EXCLUDED_HALAQA_DATES } from './attendance';
import { localDateStr } from './dates';

/** Ayat memorized across loh (new assignment, falling back to legacy shape),
 * madi (same), and tajweed for one record. Shared by the summary card and
 * the per-student breakdown so the two totals can never drift apart. */
function ayatInRecord(r: SessionRecord): number {
  let sum = 0;
  const lohArr = r.newLoh?.length ? r.newLoh : r.loh && (r.loh as unknown as { sura?: string }).sura ? [r.loh as never] : [];
  lohArr.forEach((l) => {
    if (l?.sura) sum += itemAyat(l);
  });
  const madiArr = r.newMadi?.length ? r.newMadi : r.madi && (r.madi as unknown as { sura?: string }).sura ? [r.madi as never] : [];
  madiArr.forEach((m) => {
    if (m?.sura) sum += itemAyat(m);
  });
  if (r.tajweed?.sura) sum += itemAyat(r.tajweed);
  return sum;
}

export interface SummaryStats {
  totalSessions: number;
  /** Students with at least one session in the records passed in (legacy
   * "ever recorded" reading — kept for callers that still want it). */
  activeStudents: number;
  totalAyat: number;
  lohAyat: number;
  madiAyat: number;
  avgLoh: number;
  totalHalaqaDays: number;
}

/**
 * Top-level summary cards. `avgLoh` falls back to a stars→percent estimate
 * (stars × 20) when nothing has a real numeric score yet — this is a
 * screen-level display choice (always show *some* number), distinct from
 * stats.ts's buildStudentPublicStats, which correctly returns `null` when
 * unscored since that's data meant for storage/comparison, not display.
 */
export function computeSummaryStats(records: SessionRecord[]): SummaryStats {
  const totalSessions = records.length;
  const activeStudents = new Set(records.map((r) => r.studentId || r.student)).size;

  const scoredLoh = records.filter((r) => hasScore(r.loh));
  const avgLoh = scoredLoh.length
    ? Math.round(scoredLoh.reduce((a, r) => a + r.loh!.score!, 0) / scoredLoh.length)
    : totalSessions
      ? Math.round((records.reduce((a, r) => a + (r.loh?.stars ?? 0), 0) / totalSessions) * 20)
      : 0;

  let lohAyat = 0;
  let madiAyat = 0;
  records.forEach((r) => {
    const lohArr = r.newLoh?.length ? r.newLoh : r.loh && (r.loh as unknown as { sura?: string }).sura ? [r.loh as never] : [];
    lohArr.forEach((l) => {
      if (l?.sura) lohAyat += itemAyat(l);
    });
    const madiArr = r.newMadi?.length ? r.newMadi : r.madi && (r.madi as unknown as { sura?: string }).sura ? [r.madi as never] : [];
    madiArr.forEach((m) => {
      if (m?.sura) madiAyat += itemAyat(m);
    });
  });
  const tajweedAyat = records.reduce((a, r) => a + (r.tajweed?.sura ? itemAyat(r.tajweed) : 0), 0);
  const totalAyat = lohAyat + madiAyat + tajweedAyat;

  const totalHalaqaDays = new Set(
    records.map((r) => r.date).filter((d): d is string => !!d && !EXCLUDED_HALAQA_DATES.includes(d)),
  ).size;

  return { totalSessions, activeStudents, totalAyat, lohAyat, madiAyat, avgLoh, totalHalaqaDays };
}

/**
 * Counts students whose most recent session (across ALL records — not the
 * screen's month filter, since "active" is about real-world recency, not the
 * viewed month) falls within `withinDays` of `today`. This is deliberately a
 * different, stricter notion of "active" than `SummaryStats.activeStudents`
 * (which just means "has ever had a session"): a student who memorized last
 * year but hasn't attended since isn't "active" today even though they have
 * historical records.
 */
export function countRecentlyActiveStudents(
  students: Student[],
  allRecords: SessionRecord[],
  withinDays = 30,
  today: string = localDateStr(),
): number {
  const cutoff = new Date(today + 'T12:00:00');
  cutoff.setDate(cutoff.getDate() - withinDays);
  const cutoffStr = localDateStr(cutoff);

  const lastDateByStudent = new Map<string, string>();
  allRecords.forEach((r) => {
    const key = r.studentId || r.student;
    if (!key || !r.date) return;
    const prev = lastDateByStudent.get(key);
    if (!prev || r.date > prev) lastDateByStudent.set(key, r.date);
  });

  return students.filter((s) => {
    const last = lastDateByStudent.get(s.id);
    return !!last && last >= cutoffStr;
  }).length;
}

/** The halaqa's week runs Saturday→Friday (not the ISO Monday start) — this
 * returns the Saturday on/before the given date, as a local date string. */
export function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const offset = (day + 1) % 7;
  d.setDate(d.getDate() - offset);
  return localDateStr(d);
}

export interface WeeklyBucket {
  weekStart: string;
  count: number;
}

/** Session counts bucketed by halaqa-week, most recent 8 weeks only (matches
 * the live chart's fixed window). */
export function computeWeeklyBuckets(records: SessionRecord[]): WeeklyBucket[] {
  const dated = records.filter((r) => r.date);
  const counts: Record<string, number> = {};
  dated.forEach((r) => {
    const wk = getWeekStart(r.date);
    counts[wk] = (counts[wk] || 0) + 1;
  });
  return Object.keys(counts)
    .sort()
    .slice(-8)
    .map((weekStart) => ({ weekStart, count: counts[weekStart] }));
}

export interface ScoreDistributionRow {
  label: string;
  count: number;
  pct: number;
}

const SCORE_DISTRIBUTION_ORDER = ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'إعادة'];

/** How every recorded loh/madi/tajweed score breaks down across the five
 * performance labels, across ALL evaluations in the given records (a
 * student with 3 scored items contributes 3 counts, not 1). */
export function computeScoreDistribution(records: SessionRecord[]): ScoreDistributionRow[] {
  const buckets: Record<string, number> = Object.fromEntries(SCORE_DISTRIBUTION_ORDER.map((l) => [l, 0]));
  let total = 0;
  records.forEach((r) => {
    [r.loh, r.madi, r.tajweed].forEach((obj) => {
      if (hasScore(obj)) {
        const name = scoreName(obj.score);
        if (name && name in buckets) {
          buckets[name]++;
          total++;
        }
      }
    });
  });
  return SCORE_DISTRIBUTION_ORDER.map((label) => ({
    label,
    count: buckets[label],
    pct: total ? Math.round((buckets[label] / total) * 100) : 0,
  }));
}

export interface TopAyatEntry {
  name: string;
  ayat: number;
  sessionsCount: number;
}

/** Top-N students by total ayat memorized in the given (already
 * period-filtered) records — independent of attendance ranking. */
export function computeTopAyat(students: Student[], records: SessionRecord[], limit = 3): TopAyatEntry[] {
  const per = students
    .map((s) => {
      const recs = recordsForStudent(s, records);
      if (!recs.length) return null;
      const ayat = recs.reduce((sum, r) => sum + ayatInRecord(r), 0);
      return { name: getStudentName(s), ayat, sessionsCount: recs.length };
    })
    .filter((x): x is TopAyatEntry => x !== null);
  return per.sort((a, b) => b.ayat - a.ayat).slice(0, limit);
}

export interface StudentStatsRow {
  name: string;
  sessionsCount: number;
  uniqueDays: number;
  attendPct: number;
  avg: number;
  ayat: number;
}

export type StatsSortKey = 'attend' | 'ayat' | 'avg' | 'name';

/** Per-student breakdown table backing the "تفصيل الطلاب" list — every
 * numeric field always has a value (no nulls), matching the screen's
 * "always show a number" display philosophy (see computeSummaryStats). */
export function computeStudentStatsRows(
  students: Student[],
  records: SessionRecord[],
  totalHalaqaDays: number,
): StudentStatsRow[] {
  return students
    .map((s) => {
      const recs = recordsForStudent(s, records);
      if (!recs.length) return null;
      const scoredLoh = recs.filter((r) => hasScore(r.loh));
      const avg = scoredLoh.length
        ? Math.round(scoredLoh.reduce((a, r) => a + r.loh!.score!, 0) / scoredLoh.length)
        : Math.round((recs.reduce((a, r) => a + (r.loh?.stars ?? 0), 0) / recs.length) * 20);
      const ayat = recs.reduce((sum, r) => sum + ayatInRecord(r), 0);
      const uniqueDays = new Set(recs.map((r) => r.date)).size;
      const attendPct = totalHalaqaDays > 0 ? Math.min(100, Math.round((uniqueDays / totalHalaqaDays) * 100)) : 0;
      return { name: getStudentName(s), sessionsCount: recs.length, uniqueDays, attendPct, avg, ayat };
    })
    .filter((x): x is StudentStatsRow => x !== null);
}

export function sortStudentStatsRows(rows: StudentStatsRow[], key: StatsSortKey): StudentStatsRow[] {
  const sortFns: Record<StatsSortKey, (a: StudentStatsRow, b: StudentStatsRow) => number> = {
    attend: (a, b) => b.attendPct - a.attendPct,
    ayat: (a, b) => b.ayat - a.ayat,
    avg: (a, b) => b.avg - a.avg,
    name: (a, b) => a.name.localeCompare(b.name, 'ar'),
  };
  return [...rows].sort(sortFns[key]);
}
