import type { Student, SessionRecord } from '../types';
import { ayahAtLohPosition, globalAyahToSuraAyah, globalAyahIndex } from './pages';
import { computeLohSpan } from './statsScreen';
import { getStudentName } from './students';
import { juzName, juzOfGlobalAyah, TOTAL_JUZ } from './juz';

/**
 * How many students are standing in each juz — "٥ في جزء عمّ، ٢٠ في تبارك،
 * واحد في الجزء الأول".
 *
 * A student is a single point on the halaqa's memorization path, so the juz
 * they are "in" is the one holding that point: the end of the span
 * `computeLohSpan` measures, i.e. the last assignment they have actually stood
 * up and recited. Homework handed out but not yet heard does not move anyone
 * forward — same rule the pages leaderboard uses, so the two cards can never
 * disagree about where a student is.
 */

/**
 * Pseudo-juz for students still on الفاتحة.
 *
 * الفاتحة is memorized FIRST in this halaqa and only then does the order jump
 * to الناس and run backwards. Counting it as الجزء الأول — which is where it
 * sits in the mushaf — would file the newest beginners next to the students
 * who have come all the way round to البقرة, i.e. show a beginner as nearly
 * finished. It gets a row of its own at the head of the path instead.
 */
export const FATIHA_JUZ = 0;

export interface JuzDistributionStudent {
  /** Stable id — names collide and change, so this is the render key. */
  id: string;
  name: string;
}

export interface JuzDistributionRow {
  /** 1..30, or FATIHA_JUZ. */
  juz: number;
  /** 'عمّ', 'تبارك', 'الفاتحة' — what the row is called out loud. */
  name: string;
  count: number;
  /** Share of the PLACED students, rounded. Students who have not started are
   * not in the denominator: they are not anywhere on the path yet, and folding
   * them in would quietly shrink every juz's share. */
  pct: number;
  /** Who is in this juz, ordered by name. Printed on the card so a student
   * sitting in the wrong juz is visible rather than just a wrong number. */
  students: JuzDistributionStudent[];
}

export interface JuzDistribution {
  /** Only ajzaa that have somebody in them, ordered along the memorization
   * path: الفاتحة, then ٣٠ down to ١. */
  rows: JuzDistributionRow[];
  /** Students placed in some juz. */
  placed: number;
  /** Students with no recited assignment yet — no records at all, or an
   * assignment still waiting to be heard. */
  notStarted: number;
  /** Everyone on the roster: placed + notStarted. */
  total: number;
}

/** The juz holding the end of a student's span, or null if they have none. */
function juzOfStudent(student: Student, allRecords: SessionRecord[]): number | null {
  const span = computeLohSpan(student, allRecords);
  if (!span) return null;
  const at =
    span.direction === 'ascending'
      ? globalAyahToSuraAyah(span.endPos)
      : ayahAtLohPosition(span.endPos);
  if (!at) return null;
  if (at.sura === 1) return FATIHA_JUZ;
  const juz = juzOfGlobalAyah(globalAyahIndex(at.sura, at.ayah));
  return juz || null;
}

/** Path order: الفاتحة first, then ٣٠ downwards — the order the halaqa walks
 * the mushaf in, so the card reads top-to-bottom as beginners to finishers. */
function pathRank(juz: number): number {
  return juz === FATIHA_JUZ ? -1 : TOTAL_JUZ - juz;
}

export function computeJuzDistribution(
  students: Student[],
  allRecords: SessionRecord[],
): JuzDistribution {
  const buckets = new Map<number, JuzDistributionStudent[]>();
  let notStarted = 0;

  students.forEach((s) => {
    const juz = juzOfStudent(s, allRecords);
    if (juz === null) {
      notStarted++;
      return;
    }
    const list = buckets.get(juz) ?? [];
    list.push({ id: s.id, name: getStudentName(s) });
    buckets.set(juz, list);
  });

  const placed = students.length - notStarted;

  const rows: JuzDistributionRow[] = [...buckets.entries()]
    .map(([juz, list]) => ({
      juz,
      name: juz === FATIHA_JUZ ? 'الفاتحة' : juzName(juz),
      count: list.length,
      pct: placed ? Math.round((list.length / placed) * 100) : 0,
      students: [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    }))
    .sort((a, b) => pathRank(a.juz) - pathRank(b.juz));

  return { rows, placed, notStarted, total: students.length };
}
