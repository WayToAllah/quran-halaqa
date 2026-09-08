import type { ScoreEval, SessionRecord, Student } from '../types';
import { getPersonalAttendanceRanking } from './attendance';
import { hasScore } from './scoring';
import { computeTopPages } from './statsScreen';
import { recordsForStudent } from './students';

/**
 * How the three measured things trade off against each other. They sum to 1,
 * so `points` lands on the same 0–100 scale every component uses and can be
 * read as a percentage of a perfect student.
 *
 * Attendance carries the most weight by decision: showing up is the thing the
 * student fully controls, and it is the precondition for the other two.
 */
export const OVERALL_WEIGHTS = {
  attendance: 0.5,
  recitation: 0.3,
  pages: 0.2,
} as const;

/**
 * Pseudo-evaluations mixed into every student's recitation average, and the
 * score they carry.
 *
 * Without this, a student graded once at 100 tops the halaqa over one graded
 * twenty times at 95 — an average over a tiny sample is mostly noise. Blending
 * in three neutral 70s pulls a short record toward the middle and gets out of
 * the way as real evaluations accumulate (after twenty sessions the prior moves
 * the average by roughly a point). It is deliberately NOT a minimum-sessions
 * cut-off: a student is never excluded from his own halaqa's leaderboard for
 * having been sick.
 */
export const PRIOR_EVAL_COUNT = 3;
export const PRIOR_EVAL_SCORE = 70;

/** The same idea applied to the pages rate: three sessions' worth of the
 * halaqa's typical pace, so one lucky short-sura week can't crown a student
 * who has attended twice. */
export const PRIOR_SESSION_COUNT = 3;

export interface OverallRankEntry {
  /** Stable student id — the correct render key and lookup handle. */
  id: string;
  name: string;
  /** Enrolled halaqa days the student turned up for. */
  attendedDays: number;
  /** Halaqa days since the student joined. */
  enrolledDays: number;
  /** 0–100, measured against the student's OWN enrolment window. */
  attendPct: number;
  /** Graded evaluations found (loh + madi, both counted separately). */
  evalCount: number;
  /** 0–100 blended average of those evaluations (see PRIOR_EVAL_COUNT). */
  recitationScore: number;
  /** Whole mushaf pages of new memorization completed, cumulative. */
  pages: number;
  /** Pages per attended day, blended (see PRIOR_SESSION_COUNT). */
  pagesRate: number;
  /** 0–100: the student's rate as a share of the halaqa's fastest rate. */
  pagesScore: number;
  /** The weighted total, 0–100, rounded to one decimal. */
  points: number;
  /** Dense rank on `points` — ties share a rank and the next distinct total
   * takes the following integer, exactly like the attendance leaderboard. */
  rank: number;
}

/** Numeric value of one evaluation, or null if it was never graded.
 *
 * A real 0 (إعادة) is a score and must survive; `score: null` is missing data
 * and must not become a zero. Legacy records that carry only stars are
 * approximated the same way computeStudentStatsRows approximates them, so the
 * two averages can't disagree about the same old session. */
function evalScore(o: ScoreEval | null | undefined): number | null {
  if (hasScore(o)) return o.score;
  const stars = o?.stars ?? 0;
  return stars > 0 ? stars * 20 : null;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * One combined leaderboard: attendance + recitation + pages, cumulative over
 * the student's whole history.
 *
 * The three inputs are on incompatible scales — a percentage, a grade, and a
 * running count — so each is first normalised to 0–100 and only then weighted:
 *
 *  1. **Attendance** uses the student's own enrolment window (the parent-page
 *     basis), not the halaqa-wide one. Since the ranking is cumulative, the
 *     halaqa-wide denominator would charge a student who joined last month for
 *     a year of days he was never expected to attend, and attendance is half
 *     the score.
 *  2. **Recitation** averages loh and madi together, blended toward a neutral
 *     prior so a two-session sample can't top the list.
 *  3. **Pages** is a RATE — pages per attended day — measured as a share of
 *     the halaqa's fastest student, not an absolute count. A cumulative count
 *     ranks by seniority: a student of two years is unreachable no matter how
 *     hard a newcomer works, and the component stops rewarding anything. The
 *     rate lets the new and the old compete on effort.
 *     Attendance is already its own component, so dividing pages by days is
 *     deliberate, not an oversight — it stops turning up being paid for twice.
 *
 * Known bias, accepted: a student in جزء عم finishes pages faster than one in
 * البقرة because the suras are short and often partly known already. The 20%
 * weight dampens this; it does not remove it.
 *
 * `allRecords` must be the UNFILTERED history — pages are cumulative and are
 * computed over the whole record (see computeTopPages).
 */
export function computeOverallRanking(
  students: Student[],
  allRecords: SessionRecord[],
): OverallRankEntry[] {
  // Population and attendance both come from the personal-window ranking, so
  // "who appears here" matches the attendance leaderboard exactly: a student
  // with no record at all is left out rather than shown at zero.
  const attendance = getPersonalAttendanceRanking(students, allRecords, allRecords).list;
  if (!attendance.length) return [];

  const pagesById = new Map(
    computeTopPages(students, allRecords, Infinity, 'all').map((e) => [e.id, e.pages]),
  );
  const studentsById = new Map(students.map((s) => [s.id, s]));

  const partial = attendance.map((a) => {
    const student = studentsById.get(a.id)!;
    const recs = recordsForStudent(student, allRecords);

    let evalTotal = 0;
    let evalCount = 0;
    for (const r of recs) {
      for (const value of [evalScore(r.loh), evalScore(r.madi)]) {
        if (value === null) continue;
        evalTotal += value;
        evalCount++;
      }
    }
    const recitationScore =
      (evalTotal + PRIOR_EVAL_COUNT * PRIOR_EVAL_SCORE) / (evalCount + PRIOR_EVAL_COUNT);

    const pages = pagesById.get(a.id) ?? 0;
    // Attended days, not record count: two records on one day is one session's
    // worth of opportunity, and attendance is counted in days everywhere else.
    const days = a.attendedDays;
    return { entry: a, recs, evalCount, recitationScore, pages, rawRate: days ? pages / days : 0 };
  });

  // The prior for the rate is the halaqa's own median pace rather than a fixed
  // number, so the scale re-calibrates itself as the circle's level changes
  // instead of encoding today's pace as a constant.
  const priorRate = median(partial.map((p) => p.rawRate));
  const rated = partial.map((p) => ({
    ...p,
    pagesRate:
      (p.pages + PRIOR_SESSION_COUNT * priorRate) / (p.entry.attendedDays + PRIOR_SESSION_COUNT),
  }));
  const maxRate = Math.max(0, ...rated.map((p) => p.pagesRate));

  const scored = rated.map((p) => {
    // Nobody has finished a page yet: the component is 0 for everyone rather
    // than handing an arbitrary 100 to whoever the prior happens to favour.
    const pagesScore =
      maxRate > 0 && rated.some((x) => x.pages > 0)
        ? Math.min(100, Math.round((p.pagesRate / maxRate) * 100))
        : 0;
    const raw =
      OVERALL_WEIGHTS.attendance * p.entry.attendPct +
      OVERALL_WEIGHTS.recitation * p.recitationScore +
      OVERALL_WEIGHTS.pages * pagesScore;
    return {
      id: p.entry.id,
      name: p.entry.name,
      attendedDays: p.entry.attendedDays,
      enrolledDays: p.entry.enrolledDays,
      attendPct: p.entry.attendPct,
      evalCount: p.evalCount,
      recitationScore: p.recitationScore,
      pages: p.pages,
      pagesRate: p.pagesRate,
      pagesScore,
      points: Math.round(raw * 10) / 10,
    };
  });

  // Attendance then name are display tie-breakers only — they order the rows,
  // they never change the المركز number.
  scored.sort(
    (a, b) =>
      b.points - a.points || b.attendPct - a.attendPct || a.name.localeCompare(b.name, 'ar'),
  );

  const uniquePoints = [...new Set(scored.map((x) => x.points))].sort((a, b) => b - a);
  const rankByPoints = new Map(uniquePoints.map((p, i) => [p, i + 1]));

  return scored.map((x) => ({ ...x, rank: rankByPoints.get(x.points)! }));
}
