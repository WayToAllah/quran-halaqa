import type { ScoreEval } from '../types';

/**
 * Distinguishes a genuine zero grade ("إعادة") from no grade having been
 * entered at all. `if (rec.loh.score)` treats both the same since 0 is
 * falsy in JS — that bug silently hid real zero scores everywhere it was
 * used unguarded. Always check hasScore() before reading `.score`.
 */
export function hasScore(o: ScoreEval | null | undefined): o is ScoreEval & { score: number } {
  return !!o && o.score != null;
}

/** Every 10 points = half a star; 0–5 stars in 0.5 steps. */
export function scoreToHalfStars(score: number | string | null | undefined): number {
  const s = Math.min(100, Math.max(0, parseInt(String(score)) || 0));
  return Math.round(s / 10) * 0.5;
}

export function scoreToStars(score: number | string | null | undefined): number {
  return Math.floor(scoreToHalfStars(score));
}

/**
 * Score → Arabic performance label.
 *
 * Production bug fix (2026-07-06): the original lived as
 *   `if (isNaN(s) || s === 0) return '';`
 * which treated a genuine zero score the same as "no score entered", so a
 * student who scored 0 (should show 'إعادة') displayed nothing at all in
 * the log and the WhatsApp message. Every call site already guards with
 * hasScore() before calling this, so `score` here is never a stand-in for
 * "unset" — only `NaN`/non-numeric input should return ''.
 */
export function scoreName(score: number | string | null | undefined): string {
  const s = parseInt(String(score));
  if (isNaN(s)) return '';
  if (s >= 85) return 'ممتاز';
  if (s >= 75) return 'جيد جداً';
  if (s >= 65) return 'جيد';
  if (s >= 50) return 'مقبول';
  return 'إعادة';
}

export interface ScoreFieldState {
  /** The value that will actually be saved — null means "not evaluated". */
  value: number | null;
  /** The raw text couldn't be parsed as a number at all (e.g. stray
   * letters). Previously this silently saved as a real zero — a false
   * "إعادة" grade from a typo. Now it's treated as not-evaluated, and the
   * caller can surface `invalid` so the teacher notices and retypes it. */
  invalid: boolean;
  /** A valid number was typed but outside 0–100, so it was clamped. Lets the
   * caller show the teacher what actually got saved instead of silently
   * substituting it behind their back. */
  clamped: boolean;
}

/** Parses a free-typed score field into what will actually be saved, without
 * ever silently turning a typo into a misleading real grade. Empty is a
 * legitimate "not evaluated yet" (score: null); everything else must parse
 * as a finite number or it's flagged `invalid` rather than defaulting to 0. */
export function parseScoreField(raw: string): ScoreFieldState {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, invalid: false, clamped: false };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { value: null, invalid: true, clamped: false };
  const clampedValue = Math.min(100, Math.max(0, Math.round(n)));
  return { value: clampedValue, invalid: false, clamped: clampedValue !== n };
}

/** A typed score (0–100) is unambiguously finished once another digit can't
 * change it: two digits that aren't "10" (e.g. "95" — a third digit would
 * exceed 100), or three digits (only "100" is valid). Left open after a
 * single digit ("9" might still become "90") and after exactly "10" (might
 * still become "100"). Used to auto-dismiss the mobile keyboard once typing
 * more would be pointless, without cutting the teacher off from "100". */
export function isScoreEntryComplete(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length >= 3 || (trimmed.length === 2 && trimmed !== '10');
}
