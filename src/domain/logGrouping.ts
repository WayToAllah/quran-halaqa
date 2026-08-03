import { byNewest } from './dates';
import { isRepeatGrade } from './record';
import type { SessionRecord } from '../types';

export interface LogDay {
  /** ISO date, 'YYYY-MM-DD'. */
  date: string;
  records: SessionRecord[];
}

/**
 * Splits a newest-first record list into day blocks.
 *
 * A halaqa day produces roughly one record per student, so the log's first
 * page is usually less than a single day's worth of cards — with no separator,
 * there was nothing to tell the teacher where one halaqa ended and the
 * previous one began. Grouping gives that boundary a heading and a count.
 *
 * Order is preserved rather than re-derived: days come out newest-first and
 * each day's records keep their newest-first order within it, matching what
 * the caller already sorted. Records with no date are grouped under '' at the
 * end, so a malformed row is still reachable instead of silently dropped.
 */
export function groupRecordsByDay(records: SessionRecord[]): LogDay[] {
  const days: LogDay[] = [];
  const index = new Map<string, LogDay>();

  for (const r of records) {
    const date = r.date || '';
    let day = index.get(date);
    if (!day) {
      day = { date, records: [] };
      index.set(date, day);
      days.push(day);
    }
    day.records.push(r);
  }

  // Dated days newest-first; undated last.
  days.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
  for (const day of days) day.records.sort(byNewest);
  return days;
}

/** The filters offered above the log list. */
export type LogFilter = 'all' | 'repeat' | 'attendance' | 'tajweed';

/**
 * Does this session belong under the given filter?
 *
 * 'repeat' asks whether the session's OWN marks landed in إعادة — the verdict
 * the teacher gave that day — rather than whether its assignment was later
 * failed, which is a different question answered by assignmentsGradedRepeat().
 */
export function matchesLogFilter(r: SessionRecord, filter: LogFilter): boolean {
  switch (filter) {
    case 'repeat':
      return isRepeatGrade(r.loh) || isRepeatGrade(r.madi);
    case 'attendance':
      return !!r.attendance_only;
    case 'tajweed':
      return !!r.tajweed?.sura;
    case 'all':
    default:
      return true;
  }
}
