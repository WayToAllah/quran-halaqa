import { useEffect, useState } from 'preact/hooks';
import { subscribeAllRecords } from '../data/records.repo';
import type { SessionRecord } from '../types';

export function useAllRecords(mosqueId: string, halaqaId: string) {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    return subscribeAllRecords(
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
