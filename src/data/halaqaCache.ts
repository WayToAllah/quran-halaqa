/**
 * Session-level shared cache for the two "load the whole collection" reads:
 * the full student list and the full records set. Both back several screens at
 * once (تسجيل/الطلاب/السجل/الإحصاءات) and the publicStats republish path.
 *
 * WHY THIS EXISTS — read cost. Firestore bills per document read. Before this
 * module:
 *   - every screen that called useStudents/useAllRecords opened its OWN
 *     onSnapshot, so N mounted screens = N full-collection reads on load; and
 *   - republishPublicStatsFor did a fresh one-shot getAllStudents+getAllRecords
 *     on EVERY save/delete. With ~3000 records, one individual save ≈ 3000+
 *     reads; a normal halaqa day of ~30 individual entries ≈ 90k reads —
 *     past the 50k/day free tier on saves alone.
 *
 * The fix is one onSnapshot per collection, ref-counted and shared. onSnapshot
 * reads the full set once on the first listener, then only changed documents
 * (deltas) afterward — so a save the admin just made costs ~1 read to observe,
 * not a full re-read. republishPublicStatsFor reads the already-in-memory
 * snapshot instead of issuing new getDocs, so it costs 0 extra reads whenever
 * the cache is warm (which it always is while the app UI is mounted).
 *
 * Scope note: this is a per-tab, in-memory cache tied to the app session. It is
 * NOT persistence across reloads (that's a separate concern — persistentLocalCache
 * in firebase.ts). It intentionally keys on a single (mosqueId, halaqaId) pair —
 * the whole app runs against one halaqa at a time (see MOSQUE_ID/HALAQA_ID in
 * config.ts). If that pair ever changes at runtime the cache resets cleanly.
 */
import type { Unsubscribe } from 'firebase/firestore';
import { subscribeAllRecords } from './records.repo';
import { subscribeStudents } from './students.repo';
import type { SessionRecord, Student } from '../types';

type Listener<T> = (value: T) => void;
type ErrListener = (err: unknown) => void;

interface CollectionCache<T> {
  key: string;
  data: T[];
  loaded: boolean;
  refCount: number;
  unsub: Unsubscribe | null;
  listeners: Set<Listener<T[]>>;
  errListeners: Set<ErrListener>;
}

function makeCache<T>(): CollectionCache<T> {
  return { key: '', data: [], loaded: false, refCount: 0, unsub: null, listeners: new Set(), errListeners: new Set() };
}

const studentsCache = makeCache<Student>();
const recordsCache = makeCache<SessionRecord>();

function cacheKey(mosqueId: string, halaqaId: string): string {
  return `${mosqueId}/${halaqaId}`;
}

/**
 * Attach a live subscription to `cache`, starting the underlying onSnapshot on
 * the first subscriber for a given (mosqueId, halaqaId) and tearing it down when
 * the last subscriber leaves. Returns an unsubscribe.
 *
 * If the halaqa key changes (multi-tenant future / halaqa switch), the existing
 * snapshot is torn down and the cache reset so stale data can't leak across
 * halaqat.
 */
function subscribeShared<T>(
  cache: CollectionCache<T>,
  mosqueId: string,
  halaqaId: string,
  start: (onChange: (list: T[]) => void, onError: ErrListener) => Unsubscribe,
  onChange: Listener<T[]>,
  onError?: ErrListener,
): Unsubscribe {
  const key = cacheKey(mosqueId, halaqaId);
  if (cache.key && cache.key !== key) {
    // Halaqa changed under us — reset everything for the new key.
    cache.unsub?.();
    cache.unsub = null;
    cache.data = [];
    cache.loaded = false;
    cache.refCount = 0;
    cache.listeners.clear();
    cache.errListeners.clear();
  }
  cache.key = key;
  cache.listeners.add(onChange);
  if (onError) cache.errListeners.add(onError);
  cache.refCount++;

  // Replay current state immediately so a late subscriber doesn't wait for the
  // next snapshot to render.
  if (cache.loaded) onChange(cache.data);

  if (!cache.unsub) {
    cache.unsub = start(
      (list) => {
        cache.data = list;
        cache.loaded = true;
        cache.listeners.forEach((l) => l(list));
      },
      (err) => {
        cache.errListeners.forEach((l) => l(err));
      },
    );
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    cache.listeners.delete(onChange);
    if (onError) cache.errListeners.delete(onError);
    cache.refCount--;
    if (cache.refCount <= 0) {
      cache.unsub?.();
      cache.unsub = null;
      cache.refCount = 0;
      cache.loaded = false;
      cache.data = [];
      // key is kept so a fresh subscribe with the same key is a clean start
    }
  };
}

export function subscribeStudentsCached(
  mosqueId: string,
  halaqaId: string,
  onChange: Listener<Student[]>,
  onError?: ErrListener,
): Unsubscribe {
  return subscribeShared(
    studentsCache,
    mosqueId,
    halaqaId,
    (oc, oe) => subscribeStudents(mosqueId, halaqaId, oc, oe),
    onChange,
    onError,
  );
}

export function subscribeAllRecordsCached(
  mosqueId: string,
  halaqaId: string,
  onChange: Listener<SessionRecord[]>,
  onError?: ErrListener,
): Unsubscribe {
  return subscribeShared(
    recordsCache,
    mosqueId,
    halaqaId,
    (oc, oe) => subscribeAllRecords(mosqueId, halaqaId, oc, oe),
    onChange,
    onError,
  );
}

/**
 * Synchronous read of the currently-cached full collections, or null if that
 * collection has no live subscriber (cache cold). republishPublicStatsFor uses
 * this to avoid a fresh network read whenever the app UI is mounted — the
 * subscription that renders the screens has already paid for (and keeps warm)
 * exactly the data the projection needs.
 *
 * Returns null (not stale/empty) when cold so callers can fall back to a
 * one-shot getDocs rather than silently computing stats over an empty set.
 */
export function getCachedHalaqaSnapshot(
  mosqueId: string,
  halaqaId: string,
): { students: Student[]; records: SessionRecord[] } | null {
  const key = cacheKey(mosqueId, halaqaId);
  if (
    studentsCache.key === key &&
    studentsCache.loaded &&
    studentsCache.refCount > 0 &&
    recordsCache.key === key &&
    recordsCache.loaded &&
    recordsCache.refCount > 0
  ) {
    return { students: studentsCache.data, records: recordsCache.data };
  }
  return null;
}

/** Test-only: force both caches back to empty/cold between test cases. */
export function __resetHalaqaCacheForTests(): void {
  for (const c of [studentsCache, recordsCache] as CollectionCache<unknown>[]) {
    c.unsub?.();
    c.unsub = null;
    c.key = '';
    c.data = [];
    c.loaded = false;
    c.refCount = 0;
    c.listeners.clear();
    c.errListeners.clear();
  }
}
