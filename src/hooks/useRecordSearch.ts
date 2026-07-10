import { useEffect, useRef, useState } from 'preact/hooks';
import { getAllRecordsForStudent } from '../data/records.repo';
import { normAr } from '../domain/text';
import { getStudentName } from '../domain/students';
import type { SessionRecord, Student } from '../types';

export interface RecordSearchResult {
  results: SessionRecord[];
  searching: boolean;
  /** True once a non-empty query has been resolved against Firestore. */
  resolved: boolean;
}

/**
 * Full-log search that is NOT limited to the records already paged into memory.
 *
 * The log screen normally shows a paginated slice (40 at a time). Searching
 * only that slice would silently miss older sessions — the exact gap this
 * closes. Instead, when there's a query we:
 *   1. match it against the full student list (≤50, always fully loaded) by
 *      normalized name substring, and
 *   2. fetch every matching student's records straight from Firestore via the
 *      indexed `studentId` query, then merge + sort newest-first.
 *
 * An empty query returns nothing here (the screen falls back to its paginated
 * list). Results are capped generously to mirror the live app's 200-row cap.
 */
const MAX_RESULTS = 200;

export function useRecordSearch(
  mosqueId: string,
  halaqaId: string,
  query: string,
  students: Student[],
): RecordSearchResult {
  const [results, setResults] = useState<SessionRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolved, setResolved] = useState(false);
  // Guards against out-of-order responses: only the latest query's result wins.
  const runIdRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      setResolved(false);
      return;
    }

    const runId = ++runIdRef.current;
    const nq = normAr(q);
    const matchingStudents = students.filter((s) => normAr(getStudentName(s)).includes(nq));

    // No student matches — resolve immediately with an empty set (no fetch).
    if (matchingStudents.length === 0) {
      setResults([]);
      setSearching(false);
      setResolved(true);
      return;
    }

    setSearching(true);
    setResolved(false);

    // Debounce so we don't fire a Firestore query on every keystroke.
    const timer = setTimeout(() => {
      Promise.all(
        matchingStudents.map((s) => getAllRecordsForStudent(mosqueId, halaqaId, s.id).catch(() => [])),
      )
        .then((lists) => {
          if (runId !== runIdRef.current) return; // a newer query superseded this one
          const merged = lists
            .flat()
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .slice(0, MAX_RESULTS);
          setResults(merged);
          setSearching(false);
          setResolved(true);
        })
        .catch(() => {
          if (runId !== runIdRef.current) return;
          setResults([]);
          setSearching(false);
          setResolved(true);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [mosqueId, halaqaId, query, students]);

  return { results, searching, resolved };
}
