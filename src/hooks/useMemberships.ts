import { useEffect, useState } from 'preact/hooks';
import { getUserMosqueIds } from '../data/users.repo';
import { getMosque, listHalaqat } from '../data/mosques.repo';
import { buildTenantOptions, type MosqueEntry, type TenantOption } from '../domain/memberships';
import type { Tenant } from '../domain/tenant';

/**
 * The mosques + halaqat this account can choose between — the input the mosque
 * switcher will render.
 *
 * Two failure modes are handled rather than surfaced, both on purpose:
 *
 *  - A mosque named in the index that the rules refuse to read is dropped, not
 *    an error. The index is a hint, not a permission (domain/memberships.ts),
 *    so a forged or stale entry must degrade to "not offered".
 *  - No index document at all — which is everybody today, since nothing writes
 *    one yet — falls back to the mosque already open. That lets this ship
 *    without creating a single Firestore document first, and means a teacher
 *    never opens the picker to find the halaqa they are standing in missing.
 */
export function useMemberships(uid: string | null, current: Tenant) {
  const [options, setOptions] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) {
      setOptions([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);

    void (async () => {
      let ids: string[] = [];
      try {
        ids = await getUserMosqueIds(uid);
      } catch (err) {
        // Offline, or no index yet. The fallback below still gives the teacher
        // the mosque they are already in.
        console.warn('membership index unavailable:', err);
      }
      if (!ids.includes(current.mosqueId)) ids = [current.mosqueId, ...ids];

      const entries: MosqueEntry[] = await Promise.all(
        ids.map(async (mosqueId) => {
          try {
            const [mosque, halaqat] = await Promise.all([
              getMosque(mosqueId),
              listHalaqat(mosqueId),
            ]);
            return { mosqueId, mosque, halaqat };
          } catch {
            return { mosqueId, mosque: null, halaqat: [] };
          }
        }),
      );

      if (!alive) return;
      setOptions(buildTenantOptions(entries));
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [uid, current.mosqueId]);

  return { options, loading };
}
