import type { MistakeTally } from '../types';

/**
 * Mistake-counter logic, ported verbatim from the live index.html.
 *
 * The counter is a running list of individual mistakes the teacher taps while
 * a student recites. Two kinds:
 *   - 'full'    — a full mistake,     −1 point
 *   - 'tajweed' — a tajweed mistake,  −0.5 point
 *
 * The teacher taps buttons (each appends one entry), can undo the last one, or
 * reset. The live score starts at 100 and drops as mistakes accumulate. On
 * "save" the final score is committed into the loh/madi score field.
 *
 * Kept as an ordered history (not just two counters) so "undo last mistake"
 * removes the most recent tap regardless of kind — matching the live app,
 * where undoLastMistake() is a plain `.pop()` on the history array.
 */
export type MistakeKind = 'full' | 'tajweed';

/**
 * Live, un-rounded score shown *inside* the counter while tapping.
 * `Math.max(0, 100 - full - tajweed*0.5)` — identical to renderMistakeCounter().
 * A single tajweed mistake shows as e.g. 99.5; the display keeps the .5.
 */
export function liveMistakeScore(history: readonly MistakeKind[]): number {
  const full = history.filter((k) => k === 'full').length;
  const tajweed = history.filter((k) => k === 'tajweed').length;
  return Math.max(0, 100 - full - tajweed * 0.5);
}

/**
 * The score actually committed to the field on save. The live app rounds to
 * the nearest integer here (closeMistakeCounter): the rest of the app's scores
 * are whole numbers (parseInt truncates everywhere else), so a stray ".5" is
 * not left in the field. One lone tajweed mistake rounds back to the nearest
 * integer; two of them (−1 total) actually move the score.
 */
export function committedMistakeScore(history: readonly MistakeKind[]): number {
  return Math.round(liveMistakeScore(history));
}

/** Tally the history into {full, tajweed} counts, or null if no mistakes were
 * recorded at all — mirrors mistakesSummary(), which returns null for an empty
 * history so the record is saved WITHOUT a `mistakes` field. */
export function summarizeMistakes(history: readonly MistakeKind[]): MistakeTally | null {
  if (!history.length) return null;
  return {
    full: history.filter((k) => k === 'full').length,
    tajweed: history.filter((k) => k === 'tajweed').length,
  };
}

/** Rebuild an ordered history array from a saved {full, tajweed} tally so the
 * counter can reopen on an edited record showing the same counts. Order within
 * a kind is irrelevant (the tally has no per-tap order); full entries first,
 * then tajweed — same as the live rebuildMistakeHistory(). */
export function rebuildMistakeHistory(mistakes: MistakeTally | null | undefined): MistakeKind[] {
  if (!mistakes) return [];
  const h: MistakeKind[] = [];
  for (let i = 0; i < (mistakes.full || 0); i++) h.push('full');
  for (let i = 0; i < (mistakes.tajweed || 0); i++) h.push('tajweed');
  return h;
}

/** Color for the live score readout — same thresholds as mistakeScoreColor(). */
export function mistakeScoreColor(s: number): string {
  if (s >= 85) return '#15613a';
  if (s >= 75) return '#3a8a5c';
  if (s >= 65) return '#b8720a';
  if (s >= 50) return '#c98a1f';
  return '#c0392b';
}
