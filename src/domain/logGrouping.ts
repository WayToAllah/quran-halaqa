import { byNewest } from './dates';
import { isRepeatGrade } from './record';
import type { SessionRecord, SuraAssignment } from '../types';

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

/**
 * What each record's marks were actually given for, keyed by record id.
 *
 * A session is marked on the assignment it was given at the PREVIOUS session,
 * so the sura behind a score lives on a different record than the score does.
 * Without it the log could only say "لوح ٩٠" — a number with nothing attached
 * to it — while the sura sitting on the same card was the NEW assignment, a
 * different thing entirely and an easy misread.
 *
 * Resolved for the whole list in one pass rather than per card, so rendering
 * fifty rows doesn't re-scan the list fifty times. Records whose predecessor
 * isn't loaded yet (the log pages newest-first, so older sessions may still be
 * below the fold) simply get nothing — the card then shows the bare mark
 * rather than a wrong sura.
 */
export function markedAssignments(
  all: SessionRecord[],
): Map<string, { loh: SuraAssignment[]; madi: SuraAssignment[] }> {
  const byStudent = new Map<string, SessionRecord[]>();
  for (const r of all) {
    if (!r.studentId || r.attendance_only) continue;
    const list = byStudent.get(r.studentId);
    if (list) list.push(r);
    else byStudent.set(r.studentId, [r]);
  }

  const out = new Map<string, { loh: SuraAssignment[]; madi: SuraAssignment[] }>();
  for (const sessions of byStudent.values()) {
    // Newest first, so each session's predecessor is the next one along.
    sessions.sort(byNewest);
    for (let i = 0; i < sessions.length - 1; i++) {
      const prev = sessions[i + 1];
      out.set(sessions[i].id, {
        loh: (prev.newLoh ?? []).filter((a) => a?.sura),
        madi: (prev.newMadi ?? []).filter((a) => a?.sura),
      });
    }
  }
  return out;
}
