import { useEffect, useState } from 'preact/hooks';
import { getAllRecordsForStudent } from '../data/records.repo';
import { findPreviousSession } from '../domain/record';
import type { SessionRecord, Student } from '../types';

export function usePreviousSession(mosqueId: string, halaqaId: string, student: Student | null) {
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
        setPrev(findPreviousSession(student, records));
      })
      .catch((err) => console.error('usePreviousSession failed:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mosqueId, halaqaId, student?.id]);

  return { prev, loading };
}
