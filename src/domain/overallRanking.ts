import type { ScoreEval, SessionRecord, Student } from '../types';
import { getPersonalAttendanceRanking } from './attendance';
import { linesInPathSpan } from './lines';
import { LINES_PER_FULL_PAGE } from './lineTable';
import { hasScore } from './scoring';
import { computeLohSpan } from './statsScreen';
import { recordsForStudent } from './students';

/**
 * How the three measured things trade off against each other. They sum to 1,
 * so `points` lands on the same 0–100 scale every component uses and can be
 * read as a percentage of a perfect student.
 *
 * Attendance carries the most weight by decision: showing up is the thing the
 * student fully controls, and it is the precondition for the other two. The
 * other two are held equal — grading how well the old assignment was recited
 * and counting how much new ground was covered are two halves of one effort,
 * and neither deserves to outrank the other.
 */
export const OVERALL_WEIGHTS = {
  attendance: 0.4,
  recitation: 0.3,
  lines: 0.3,
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

/**
 * The pace a student is expected to hold: five lines a session, a third of a
 * mushaf page. Hitting it scores the full 100; beating it is capped there.
 *
 * This is a FIXED benchmark, not a comparison against the fastest student in
 * the halaqa. Grading against the fastest meant one boy who attended four
 * times and happened to finish a page set a rate nobody attending regularly
 * could touch — and the more faithfully a student came, the bigger his
 * denominator grew and the lower he scored. A fixed target measures every
 * student against the same expectation instead of against each other.
 */
export const STANDARD_LINES_PER_SESSION = LINES_PER_FULL_PAGE / 3;

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
  /** Lines of the mushaf memorized, cumulative. */
  lines: number;
  /** Lines per attended day. */
  linesRate: number;
  /** 0–100: the rate as a share of STANDARD_LINES_PER_SESSION, capped at 100. */
  linesScore: number;
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

/**
 * One combined leaderboard: attendance + recitation + lines, cumulative over
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
 *  3. **Lines** is a RATE — lines of the mushaf per attended day — scored
 *     against a fixed expectation of five a session, capped at 100. A
 *     cumulative count would rank by seniority: a student of two years is
 *     unreachable no matter how hard a newcomer works. A share of the fastest
 *     student was worse still — see STANDARD_LINES_PER_SESSION.
 *     Attendance is already its own component, so dividing by days is
 *     deliberate, not an oversight — it stops turning up being paid twice.
 *     Lines rather than pages because a page credits nothing until it is
 *     finished, which left the youngest students on zero for months at a
 *     time; see completedLines().
 *
 * `allRecords` must be the UNFILTERED history — the ranking is cumulative.
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

    // The SAME span the pages leaderboard measures, counted in lines instead
    // of pages. Both cards now answer "how far has he travelled" identically;
    // only the unit differs, so they can never disagree about a student.
    const span = computeLohSpan(student, allRecords, 'all');
    const lines = span ? linesInPathSpan(span.startPos, span.endPos, span.direction) : 0;

    // Attended days, not record count: two records on one day is one session's
    // worth of opportunity, and attendance is counted in days everywhere else.
    const days = a.attendedDays;
    return {
      entry: a,
      recs,
      evalCount,
      recitationScore,
      lines,
      linesRate: days ? lines / days : 0,
    };
  });

  const scored = partial.map((p) => {
    const linesScore = Math.min(100, Math.round((p.linesRate / STANDARD_LINES_PER_SESSION) * 100));
    const raw =
      OVERALL_WEIGHTS.attendance * p.entry.attendPct +
      OVERALL_WEIGHTS.recitation * p.recitationScore +
      OVERALL_WEIGHTS.lines * linesScore;
    return {
      id: p.entry.id,
      name: p.entry.name,
      attendedDays: p.entry.attendedDays,
      enrolledDays: p.entry.enrolledDays,
      attendPct: p.entry.attendPct,
      evalCount: p.evalCount,
      recitationScore: p.recitationScore,
      lines: p.lines,
      linesRate: p.linesRate,
      linesScore,
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
