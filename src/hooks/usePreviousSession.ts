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
  const [prev, setPrev] = useState<SessionRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!student) {
      setPrev(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAllRecordsForStudent(mosqueId, halaqaId, student.id)
      .then((records) => {
        if (cancelled) return;
        setPrev(findPreviousSession(student, records, excludeRecordId));
      })
      .catch((err) => console.error('usePreviousSession failed:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mosqueId, halaqaId, student?.id, excludeRecordId]);

  return { prev, loading };
}
