import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { normalizeSeasons, type Season } from '../domain/seasons';

/**
 * Seasons live as a `seasons` field on the halaqa document
 * (`mosques/{m}/halaqat/{h}`), exactly like niyyat: the security rules already
 * let any mosque member write that doc, so no rules change or deploy is needed.
 *
 * The latest snapshot is also kept in a small in-memory cache so
 * republishPublicStatsFor can stamp the seasons onto the parent projection
 * without an extra read while the app is open.
 */
function halaqaDocRef(mosqueId: string, halaqaId: string) {
  return doc(db, 'mosques', mosqueId, 'halaqat', halaqaId);
}

const cache = new Map<string, Season[]>();
const key = (m: string, h: string) => `${m}/${h}`;

export function getCachedSeasons(mosqueId: string, halaqaId: string): Season[] | undefined {
  return cache.get(key(mosqueId, halaqaId));
}

export function subscribeSeasons(
  mosqueId: string,
  halaqaId: string,
  onChange: (seasons: Season[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    halaqaDocRef(mosqueId, halaqaId),
    (snap) => {
      const seasons = normalizeSeasons(snap.data()?.seasons);
      cache.set(key(mosqueId, halaqaId), seasons);
      onChange(seasons);
    },
    onError,
  );
}

/** One-shot read for contexts with no live subscription (cold cache). */
export async function getSeasons(mosqueId: string, halaqaId: string): Promise<Season[]> {
  const cached = getCachedSeasons(mosqueId, halaqaId);
  if (cached) return cached;
  const snap = await getDoc(halaqaDocRef(mosqueId, halaqaId));
  return normalizeSeasons(snap.data()?.seasons);
}

/** Persists the whole list. merge → only the `seasons` field is touched. */
export function saveSeasons(mosqueId: string, halaqaId: string, seasons: Season[]): Promise<void> {
  const clean = seasons.map(({ id, name, from, daysPerWeek }) =>
    daysPerWeek ? { id, name: name.trim(), from, daysPerWeek } : { id, name: name.trim(), from },
  );
  return setDoc(halaqaDocRef(mosqueId, halaqaId), { seasons: clean }, { merge: true });
}
