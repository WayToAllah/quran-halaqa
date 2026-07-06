import { useEffect, useRef, useState } from 'preact/hooks';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { subscribeRecentRecords, loadMoreRecords } from '../data/records.repo';
import type { SessionRecord } from '../types';

const PAGE_SIZE = 40;

export function useRecentRecords(mosqueId: string, halaqaId: string) {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    setLoaded(false);
    setHasMore(true);
    return subscribeRecentRecords(
      mosqueId,
      halaqaId,
      PAGE_SIZE,
      (list, lastDoc) => {
        setRecords(list);
        lastDocRef.current = lastDoc;
        setLoaded(true);
      },
      (err) => console.error('subscribeRecentRecords failed:', err),
    );
  }, [mosqueId, halaqaId]);

  async function loadMore() {
    if (!lastDocRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const { records: more, lastDoc } = await loadMoreRecords(mosqueId, halaqaId, PAGE_SIZE, lastDocRef.current);
      setRecords((prev) => [...prev, ...more]);
      lastDocRef.current = lastDoc;
      if (more.length < PAGE_SIZE) setHasMore(false);
    } catch (err) {
      console.error('loadMoreRecords failed:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  return { records, loaded, loadMore, loadingMore, hasMore };
}
