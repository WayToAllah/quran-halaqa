import type { Badge } from '../types';

/**
 * Badge keys temporarily withheld from students and parents while the rules
 * behind them are being reworked.
 *
 * Badges are *stored* inside each `publicStats/{token}` document, not computed
 * at read time, so suppressing a badge needs both halves:
 *   1. `buildStudentBadges()` filters before writing → new documents omit it.
 *   2. The parent page filters before rendering → documents already written
 *      (which are only rewritten when that student is republished) stop
 *      showing it immediately.
 *
 * To bring a badge back, delete its key from this list. The underlying
 * thresholds in `AYAT_MILESTONES` are deliberately left untouched so the
 * award logic can be tuned independently of whether it's currently shown.
 */
export const HIDDEN_BADGE_KEYS: ReadonlyArray<string> = ['ayat100', 'ayat200'];

/** Drops any badge whose key is currently hidden. Order is preserved. */
export function visibleBadges(badges: readonly Badge[]): Badge[] {
  return badges.filter((b) => !HIDDEN_BADGE_KEYS.includes(b.key));
}
