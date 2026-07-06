import type { SessionRecord } from '../types';
import { recTime } from './ids';

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
