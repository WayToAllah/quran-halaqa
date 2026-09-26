import { LINE_FIRST_AYAH, LINE_LAST_AYAH, TOTAL_LINES } from './lineTable';
import { globalAtPathPosition, type MemorizationDirection } from './pages';

/** Whole lines lying inside a memorization span, counted the same way
 * pagesInPathSpan counts pages — one level finer.
 *
 * The span model treats memorization as the DISTANCE a student has travelled
 * along his path, not the sum of the assignments on record. That is deliberate:
 * a week nobody wrote down would otherwise punch a permanent hole in his total,
 * and an assignment sent back as إعادة would void ground he is standing on and
 * that no later session will ever re-assign. Both leaderboards use this model,
 * so they can never tell different stories about the same boy.
 */
export function linesInPathSpan(
  startPos: number,
  endPos: number,
  direction: MemorizationDirection,
): number {
  if (!startPos || !endPos || endPos < startPos) return 0;
  const covered = new Set<number>();
  for (let p = startPos; p <= endPos; p++) covered.add(globalAtPathPosition(p, direction));

  let lo = Infinity;
  let hi = -Infinity;
  for (const g of covered) {
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }

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
