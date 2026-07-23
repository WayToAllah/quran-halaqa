import type { SessionRecord } from '../types';
import { recTime } from './ids';

export type GregorianOptions = Intl.DateTimeFormatOptions;

const GREGORIAN_DEFAULT_OPTS: GregorianOptions = { day: 'numeric', month: 'long' };

/** Parse an input the same way `hijri.ts` does: pass a Date through
 * untouched, anchor a bare 'YYYY-MM-DD' at local noon (dodges the
 * timezone-rollover trap for any viewer, matching the noon-anchoring
 * `hijri.ts` already relies on), otherwise defer to `new Date()`. */
function toAnchoredDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(input + 'T12:00:00');
  }
  return new Date(input);
}

/**
 * Formats a date as a spelled-out Arabic Gregorian string, e.g. "٢٣ يوليو" —
 * for any place a stored 'YYYY-MM-DD' should read as a name, not a number.
 * Returns '' for an unparseable input (callers can fall back to the raw
 * string themselves if that's preferable to blank).
 */
export function gregorianStr(input: Date | string, opts: GregorianOptions = GREGORIAN_DEFAULT_OPTS): string {
  try {
    const d = toAnchoredDate(input);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('ar-EG', opts).format(d);
  } catch {
    return '';
  }
}

/** Default form used by the record screen's date card: "٢٣ يوليو" — spelled
 * out, no year, matching the compactness of `hijriShort`. */
export function gregorianLong(input: Date | string): string {
  return gregorianStr(input, { day: 'numeric', month: 'long' });
}

/**
 * Local (not UTC) YYYY-MM-DD. `new Date().toISOString()` reports UTC, which
 * silently rolls a session recorded after midnight (Egypt is UTC+2/+3) back
 * to the previous calendar day — this is the fix for that.
 */
export function localDateStr(d: Date = new Date()): string {
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

/**
 * Sort comparator: newest session first. Compares by date string first
 * (lexicographic sort is chronologically correct for 'YYYY-MM-DD'), then by
 * the creation-time embedded in the record id as a tiebreaker for same-day
 * records.
 */
export function byNewest(
  a: Pick<SessionRecord, 'id' | 'date'>,
  b: Pick<SessionRecord, 'id' | 'date'>,
): number {
  const da = a.date || '';
  const db = b.date || '';
  if (da !== db) return da < db ? 1 : -1;
  return recTime(b) - recTime(a);
}
