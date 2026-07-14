import { useEffect, useState } from 'preact/hooks';
import { subscribeAllRecordsCached } from '../data/halaqaCache';
import type { SessionRecord } from '../types';

/**
 * Live full records set. Backed by the shared halaqaCache: screens share ONE
 * onSnapshot, and the same warm snapshot serves republishPublicStatsFor so a
 * save/delete recomputes the projection without a fresh full re-read.
 */
export function useAllRecords(mosqueId: string, halaqaId: string) {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    return subscribeAllRecordsCached(
      mosqueId,
      halaqaId,
      (list) => {
        setRecords(list);
        setLoaded(true);
      },
      (err) => console.error('subscribeAllRecords failed:', err),
    );
  }, [mosqueId, halaqaId]);

  return { records, loaded };
}
