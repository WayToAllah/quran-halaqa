import { useEffect, useState } from 'preact/hooks';
import { getAllRecordsForStudent } from '../data/records.repo';
import { findPreviousSession } from '../domain/record';
import type { SessionRecord, Student } from '../types';

/**
 * The student's previous session — the one whose newLoh/newMadi assignment
 * today's evaluation scores are grading.
 *
 * `excludeRecordId` matters when editing: pass the id of the record being
 * edited so "previous" means the session chronologically BEFORE it, not the
 * edited record itself. Without this, editing a session made its own
 * assignment show up in the evaluation card (duplicating the new-assignment
 * section right below it). In new-session mode leave it undefined to get the
 * student's most recent session.
 */
export function usePreviousSession(
  mosqueId: string,
  halaqaId: string,
  student: Student | null,
  excludeRecordId?: string,
) {
  // The answer is kept with the request it answers. Switching students used to
  // leave the LAST student's session in place until the new one's records
  // arrived — long enough for the auto-fill to write that student's next loh
  // into the new student's rows (and the evaluation card, mushaf ward and
  // WhatsApp message to show the wrong assignment). Now a stale answer is
  // simply not returned.
  const key = student ? `${mosqueId}|${halaqaId}|${student.id}|${excludeRecordId ?? ''}` : null;
  const [answer, setAnswer] = useState<{ key: string; prev: SessionRecord | null } | null>(null);

  useEffect(() => {
    if (!student || !key) return;
    let cancelled = false;
    getAllRecordsForStudent(mosqueId, halaqaId, student.id)
      .then((records) => {
        if (cancelled) return;
        setAnswer({ key, prev: findPreviousSession(student, records, excludeRecordId) });
      })
      .catch((err) => {
        console.error('usePreviousSession failed:', err);
        if (!cancelled) setAnswer({ key, prev: null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = key !== null && answer?.key === key;
  return { prev: current ? answer!.prev : null, loading: key !== null && !current };
}
