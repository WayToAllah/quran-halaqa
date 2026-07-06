import { useEffect, useState } from 'preact/hooks';
import { subscribeStudents } from '../data/students.repo';
import type { Student } from '../types';

export function useStudents(mosqueId: string, halaqaId: string) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    return subscribeStudents(
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
