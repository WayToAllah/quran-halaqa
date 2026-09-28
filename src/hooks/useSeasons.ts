import { useCallback, useEffect, useState } from 'preact/hooks';
import { saveSeasons, subscribeSeasons } from '../data/seasons.repo';
import type { Season } from '../domain/seasons';

/** Live season list for a halaqa (oldest first), plus a `save` action. */
export function useSeasons(mosqueId: string, halaqaId: string) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    return subscribeSeasons(
      mosqueId,
      halaqaId,
      (list) => {
        setSeasons(list);
        setLoaded(true);
      },
      (err) => {
        console.error('subscribeSeasons failed:', err);
        setLoaded(true);
      },
    );
  }, [mosqueId, halaqaId]);

  const save = useCallback(
    (list: Season[]) => saveSeasons(mosqueId, halaqaId, list),
    [mosqueId, halaqaId],
  );

  return { seasons, loaded, save };
}
