import { LINE_FIRST_AYAH, LINE_LAST_AYAH, TOTAL_LINES } from './lineTable';
import { assignmentAyahSpan, type DatedAssignment } from './pages';

/**
 * How many lines of the mushaf the student has actually memorized.
 *
 * The page is too coarse a unit for a young student. A boy taking two ayat of
 * البقرة a week can attend faithfully for two months and still score zero
 * pages, because a page counts for nothing until it is finished end to end.
 * The line moves with him: two ayat is often a whole line, and even when it
 * isn't, the next session finishes one.
 *
 * The line is also fair across the mushaf without any adjustment. A line in
 * البقرة holds a couple of long ayat; a line in جزء عم holds several short
 * ones. Counting lines counts the ground covered, not the ayat handed out, so
 * a student in the long suras is not quietly punished for the ayat being long.
 *
 * A line counts only when every ayah appearing on it is covered — the same
 * all-or-nothing rule completedPages() applies to pages, one level finer. Two
 * assignments with a gap between them credit only their own lines, never the
 * ground skipped in between, and re-assigning the same ayat cannot inflate the
 * total because coverage is a set of ayat, not a running sum.
 */
export function completedLines(assignments: DatedAssignment[]): number {
  const covered = new Set<number>();
  let lo = Infinity;
  let hi = -Infinity;

  for (const { item, date } of assignments) {
    const span = assignmentAyahSpan(item);
    if (!span || !date) continue;
    const [from, to] = span;
    for (let g = from; g <= to; g++) covered.add(g);
    if (from < lo) lo = from;
    if (to > hi) hi = to;
  }
  if (!covered.size) return 0;

  // Only lines overlapping [lo, hi] can qualify, so walk that window instead
  // of all 8,820 lines. Both ends are found by binary search: the first line
  // that reaches lo, and the last line that starts at or before hi.
  let start = 0;
  for (let a = 0, b = TOTAL_LINES - 1; a <= b;) {
    const mid = (a + b) >> 1;
    if (LINE_LAST_AYAH[mid] >= lo) {
      start = mid;
      b = mid - 1;
    } else {
      a = mid + 1;
    }
  }

  let count = 0;
  for (let i = start; i < TOTAL_LINES && LINE_FIRST_AYAH[i] <= hi; i++) {
    let whole = true;
    for (let g = LINE_FIRST_AYAH[i]; g <= LINE_LAST_AYAH[i]; g++) {
      if (!covered.has(g)) {
        whole = false;
        break;
      }
    }
    if (whole) count++;
  }
  return count;
}
