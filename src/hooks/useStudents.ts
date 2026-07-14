import { useEffect, useState } from 'preact/hooks';
import { subscribeStudentsCached } from '../data/halaqaCache';
import type { Student } from '../types';

/**
 * Live student list. Backed by the shared halaqaCache: every screen calling
 * this shares ONE underlying onSnapshot rather than each opening its own, so
 * mounting several screens no longer multiplies full-collection reads.
 */
export function useStudents(mosqueId: string, halaqaId: string) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    return subscribeStudentsCached(
      mosqueId,
      halaqaId,
      (list) => {
        setStudents(list);
        setLoaded(true);
      },
      (err) => console.error('subscribeStudents failed:', err),
    );
  }, [mosqueId, halaqaId]);

  return { students, loaded };
}
