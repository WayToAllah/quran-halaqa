import type { SessionRecord, Student, SuraAssignment } from '../types';
import { completedPages, type DatedAssignment } from './pages';
import { hasScore, scoreName } from './scoring';
import { itemAyat } from './suras';
import { getStudentName, recordsForStudent } from './students';
import { EXCLUDED_HALAQA_DATES, computeAbsenceStreak, sortedHalaqaDatesDesc } from './attendance';
import { localDateStr } from './dates';
import { assignmentsGradedRepeat, isRepeatGrade } from './record';

/** Ayat memorized across loh (new assignment, falling back to legacy shape),
 * madi (same), and tajweed for one record. Shared by the summary card and
 * the per-student breakdown so the two totals can never drift apart. */
function ayatInRecord(r: SessionRecord): number {
  let sum = 0;
  const lohArr = r.newLoh?.length
    ? r.newLoh
    : r.loh && (r.loh as unknown as { sura?: string }).sura
      ? [r.loh as never]
      : [];
  lohArr.forEach((l) => {
    if (l?.sura) sum += itemAyat(l);
  });
  const madiArr = r.newMadi?.length
    ? r.newMadi
    : r.madi && (r.madi as unknown as { sura?: string }).sura
      ? [r.madi as never]
      : [];
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
  /** Mean number of DISTINCT students present per halaqa day. Unrounded on
   * purpose — the screen decides how to render it. Denominator is exactly
   * `totalHalaqaDays`, so a day whose only record has no student still drags
   * the average down rather than silently vanishing. */
  avgDailyAttendance: number;
}

/**
 * Top-level summary cards. `avgLoh` falls back to a stars→percent estimate
 * (stars × 20) when nothing has a real numeric score yet — this is a
 * screen-level display choice (always show *some* number), distinct from
 * stats.ts's buildStudentPublicStats, which correctly returns `null` when
 * unscored since that's data meant for storage/comparison, not display.
 */
export function computeSummaryStats(
  records: SessionRecord[],
  /** Unfiltered history, used ONLY to work out which assignments were later
   * graded إعادة. When `records` is month-filtered, the session that grades a
   * month-end assignment falls outside it, so the verdict has to be looked up
   * against the full set or that failure goes uncounted. Defaults to
   * `records` for callers with nothing filtered out. */
  allRecords: SessionRecord[] = records,
): SummaryStats {
  const totalSessions = records.length;
  const activeStudents = new Set(records.map((r) => r.studentId || r.student)).size;

  const scoredLoh = records.filter((r) => hasScore(r.loh));
  const avgLoh = scoredLoh.length
    ? Math.round(scoredLoh.reduce((a, r) => a + r.loh!.score!, 0) / scoredLoh.length)
    : totalSessions
      ? Math.round((records.reduce((a, r) => a + (r.loh?.stars ?? 0), 0) / totalSessions) * 20)
      : 0;

  // Work graded إعادة doesn't count as recited. The grade for an assignment
  // sits on the student's NEXT session, so it's resolved through a per-record
  // map built from the unfiltered history. Same rule as the parent page's
  // "آية مُسمّعة" so the two screens can't disagree.
  const repeatMap = assignmentsGradedRepeat(allRecords);
  let lohAyat = 0;
  let madiAyat = 0;
  records.forEach((r) => {
    const failed = repeatMap.get(r.id);
    if (!failed?.loh) {
      const lohArr = r.newLoh?.length
        ? r.newLoh
        : r.loh && (r.loh as unknown as { sura?: string }).sura
          ? [r.loh as never]
          : [];
      lohArr.forEach((l) => {
        if (l?.sura) lohAyat += itemAyat(l);
      });
    }
    if (!failed?.madi) {
      const madiArr = r.newMadi?.length
        ? r.newMadi
        : r.madi && (r.madi as unknown as { sura?: string }).sura
          ? [r.madi as never]
          : [];
      madiArr.forEach((m) => {
        if (m?.sura) madiAyat += itemAyat(m);
      });
    }
  });
  const tajweedAyat = records.reduce(
    (a, r) => a + (r.tajweed?.sura && !isRepeatGrade(r.tajweed) ? itemAyat(r.tajweed) : 0),
    0,
  );
  const totalAyat = lohAyat + madiAyat + tajweedAyat;

  // One pass builds both the halaqa-day set and the per-day attendee sets, so
  // the average can never be divided by a different day count than the one
  // shown as إجمالي أيام الحلقة. Presence is per student per day: two records
  // for the same student on one date (a session plus a group-attendance mark)
  // is still one attendee.
  const presentByDay = new Map<string, Set<string>>();
  records.forEach((r) => {
    const d = r.date;
    if (!d || EXCLUDED_HALAQA_DATES.includes(d)) return;
    let present = presentByDay.get(d);
    if (!present) {
      present = new Set<string>();
      presentByDay.set(d, present);
    }
    const key = r.studentId || r.student;
    if (key) present.add(key);
  });
  const totalHalaqaDays = presentByDay.size;
  const avgDailyAttendance = totalHalaqaDays
    ? Array.from(presentByDay.values()).reduce((a, s) => a + s.size, 0) / totalHalaqaDays
    : 0;

  return {
    totalSessions,
    activeStudents,
    totalAyat,
    lohAyat,
    madiAyat,
    avgLoh,
    totalHalaqaDays,
    avgDailyAttendance,
  };
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
  const buckets: Record<string, number> = Object.fromEntries(
    SCORE_DISTRIBUTION_ORDER.map((l) => [l, 0]),
  );
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
export function computeTopAyat(
  students: Student[],
  records: SessionRecord[],
  limit = 3,
): TopAyatEntry[] {
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

export interface TopPagesEntry {
  /** Stable student id. Names collide and change, so this — not the name — is
   * the correct render key and lookup handle for a leaderboard row. */
  id: string;
  name: string;
  /** Mushaf pages memorized end-to-end. */
  pages: number;
  /** Sessions inside the viewed period (context for the number, not its basis). */
  sessionsCount: number;
}

/**
 * Top-N students by whole mushaf pages memorized.
 *
 * Deliberately different from computeTopAyat on three counts, all requested:
 *  1. **Pages, not ayat, and only whole ones.** A page counts the moment it is
 *     finished; a part-page is worth nothing. Ten short ayat of جزء عم and ten
 *     long ones of البقرة stop looking like the same achievement.
 *  2. **New memorization only** (`newLoh`) — الماضي (`newMadi`) is revision of
 *     ground already held, and counting it would credit the same page twice.
 *     التجويد is likewise recitation practice, not new ground.
 *  3. **إعادة is dropped**, matching the summary card and the parent page: work
 *     the student was told to redo is not memorized yet.
 *
 * Pages are inherently distinct — coverage is tracked per ayah, so re-assigning
 * the same ayat can never raise the count.
 *
 * `allRecords` must be the UNFILTERED history: a page is a cumulative
 * achievement, so which pages are complete has to be worked out over the whole
 * history and only then attributed to the month the finishing session fell in.
 * Computing it from month-filtered records instead would erase every page whose
 * ayat straddle the month boundary.
 */
export function computeTopPages(
  students: Student[],
  allRecords: SessionRecord[],
  /** Pass `Infinity` for the whole ranked list (the screen's عرض الكل view). */
  limit = 3,
  /** 'all', or a 'YYYY-MM' month whose newly-completed pages to count. */
  monthFilter = 'all',
): TopPagesEntry[] {
  const repeatMap = assignmentsGradedRepeat(allRecords);
  const inPeriod = (date: string) => monthFilter === 'all' || date?.slice(0, 7) === monthFilter;

  const per = students
    .map((s) => {
      const recs = recordsForStudent(s, allRecords);
      if (!recs.length) return null;

      const assignments: DatedAssignment[] = [];
      recs.forEach((r) => {
        if (repeatMap.get(r.id)?.loh) return;
        // Legacy records kept the assignment on `loh` itself before newLoh
        // existed; same fallback ayatInRecord uses.
        const lohArr = r.newLoh?.length
          ? r.newLoh
          : r.loh && (r.loh as unknown as { sura?: string }).sura
            ? [r.loh as unknown as SuraAssignment]
            : [];
        lohArr.forEach((item) => {
          if (item?.sura && r.date) assignments.push({ item, date: r.date });
        });
      });

      const pages = completedPages(assignments).filter((p) => inPeriod(p.date)).length;
      if (!pages) return null;
      return {
        id: s.id,
        name: getStudentName(s),
        pages,
        sessionsCount: recs.filter((r) => inPeriod(r.date)).length,
      };
    })
    .filter((x): x is TopPagesEntry => x !== null);

  return per.sort((a, b) => b.pages - a.pages).slice(0, limit);
}

export interface StudentStatsRow {
  /** Stable student id — see TopPagesEntry.id. */
  id: string;
  name: string;
  sessionsCount: number;
  uniqueDays: number;
  attendPct: number;
  /** `null` when the student has no scored session — distinct from a real 0
   * (إعادة). Rendering 0 for an unassessed student reads as a failing grade. */
  avg: number | null;
  ayat: number;
}

export type StatsSortKey = 'attend' | 'ayat' | 'avg' | 'name';

/** Per-student breakdown table backing the "تفصيل الطلاب" list.
 *
 * Every student on the roster gets a row, including those with no records in
 * the period. A student who never turned up is the one a teacher most needs
 * to see, and silently dropping them made the list a roll of the active only. */
export function computeStudentStatsRows(
  students: Student[],
  records: SessionRecord[],
  totalHalaqaDays: number,
): StudentStatsRow[] {
  return students.map((s) => {
    const recs = recordsForStudent(s, records);
    const scoredLoh = recs.filter((r) => hasScore(r.loh));
    const starred = recs.filter((r) => (r.loh?.stars ?? 0) > 0);
    let avg: number | null = null;
    if (scoredLoh.length) {
      avg = Math.round(scoredLoh.reduce((a, r) => a + r.loh!.score!, 0) / scoredLoh.length);
    } else if (starred.length) {
      // Older records carry stars without a numeric score; approximate.
      avg = Math.round(
        (starred.reduce((a, r) => a + (r.loh?.stars ?? 0), 0) / starred.length) * 20,
      );
    }
    const ayat = recs.reduce((sum, r) => sum + ayatInRecord(r), 0);
    const uniqueDays = new Set(recs.map((r) => r.date)).size;
    const attendPct =
      totalHalaqaDays > 0 ? Math.min(100, Math.round((uniqueDays / totalHalaqaDays) * 100)) : 0;
    return {
      id: s.id,
      name: getStudentName(s),
      sessionsCount: recs.length,
      uniqueDays,
      attendPct,
      avg,
      ayat,
    };
  });
}

export function sortStudentStatsRows(
  rows: StudentStatsRow[],
  key: StatsSortKey,
): StudentStatsRow[] {
  const sortFns: Record<StatsSortKey, (a: StudentStatsRow, b: StudentStatsRow) => number> = {
    attend: (a, b) => b.attendPct - a.attendPct,
    ayat: (a, b) => b.ayat - a.ayat,
    // Unset averages sort last in either direction — they are missing data,
    // not a low score.
    avg: (a, b) => (b.avg ?? -1) - (a.avg ?? -1),
    name: (a, b) => a.name.localeCompare(b.name, 'ar'),
  };
  return [...rows].sort(sortFns[key]);
}

export interface FollowUpEntry {
  id: string;
  name: string;
  /** Consecutive most-recent halaqa days missed. */
  absenceStreak: number;
  /** Last halaqa day attended, or null if they never have. */
  lastAttended: string | null;
  neverAttended: boolean;
}

/**
 * Students who have missed the last `minStreak` halaqa days in a row.
 *
 * The counterpart to the leaderboards: those rank who is doing best, this
 * surfaces who has quietly stopped coming. Sorted by longest absence first,
 * so the most urgent name is at the top.
 */
export function computeFollowUpList(
  students: Student[],
  records: SessionRecord[],
  minStreak = 2,
): FollowUpEntry[] {
  const halaqaDatesDesc = sortedHalaqaDatesDesc(records);
  if (!halaqaDatesDesc.length) return [];

  return students
    .map((s) => {
      const dates = new Set(
        recordsForStudent(s, records)
          .map((r) => r.date)
          .filter((d): d is string => !!d),
      );
      const attendedHalaqaDays = halaqaDatesDesc.filter((d) => dates.has(d));
      const absenceStreak = computeAbsenceStreak(dates, halaqaDatesDesc);
      return {
        id: s.id,
        name: getStudentName(s),
        absenceStreak,
        lastAttended: attendedHalaqaDays[0] ?? null,
        neverAttended: attendedHalaqaDays.length === 0,
      };
    })
    .filter((x) => x.absenceStreak >= minStreak)
    .sort((a, b) => b.absenceStreak - a.absenceStreak || a.name.localeCompare(b.name, 'ar'));
}
