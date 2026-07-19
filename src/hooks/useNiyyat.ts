import { useEffect, useState, useCallback } from 'preact/hooks';
import { subscribeNiyyat, saveNiyyat } from '../data/niyyat.repo';

/**
 * Live niyyat list for a halaqa, plus a `save` action. The header's rotating
 * bar reads `niyyat`; the management modal calls `save`. `loaded` lets the bar
 * avoid flashing the default verse before the first snapshot arrives.
 */
export function useNiyyat(mosqueId: string, halaqaId: string, enabled = true) {
  const [niyyat, setNiyyat] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoaded(false);
    return subscribeNiyyat(
      mosqueId,
      halaqaId,
      (list) => {
        setNiyyat(list);
        setLoaded(true);
      },
      (err) => console.error('subscribeNiyyat failed:', err),
    );
  }, [mosqueId, halaqaId, enabled]);

  const save = useCallback(
    (list: string[]) => saveNiyyat(mosqueId, halaqaId, list),
    [mosqueId, halaqaId],
  );

  return { niyyat, loaded, save };
}
