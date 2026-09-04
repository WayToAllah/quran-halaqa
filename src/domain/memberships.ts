import { isValidTenantId } from './tenant';
import type { Halaqa, Mosque } from '../types';

/**
 * Which mosques a signed-in teacher can choose between.
 *
 * Firestore has no way to ask "which mosques is this uid a member of" —
 * `members/{uid}` lives under each mosque, and there is no cross-collection
 * query for it without denormalising. So `users/{uid}` holds a plain list of
 * mosque ids as a *lookup index*.
 *
 * It is an index, never a grant. A teacher creating their own mosque writes
 * their own entry, so the document is client-writable and every value in it is
 * untrusted: someone could list a mosque they have no membership in. That buys
 * them nothing, because the rules still gate `mosques/{id}` on an actual
 * `members/{uid}` document — the unreadable mosque simply drops out of the
 * list (see buildTenantOptions). Nothing in the app may ever treat presence in
 * this list as proof of access.
 */

/** Each id costs one mosque read plus one halaqat query, so an oversized (or
 * hostile) document must not fan out into hundreds of reads. */
export const MAX_INDEXED_MOSQUES = 50;

export interface TenantOption {
  mosqueId: string;
  mosqueName: string;
  halaqaId: string;
  halaqaName: string;
}

/** One indexed mosque after fetching: `mosque` is null when the rules refused
 * the read (or it simply doesn't exist). */
export interface MosqueEntry {
  mosqueId: string;
  mosque: Mosque | null;
  halaqat: Halaqa[];
}

export function parseUserIndex(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
  const ids = (raw as Record<string, unknown>).mosqueIds;
  if (!Array.isArray(ids)) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!isValidTenantId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length === MAX_INDEXED_MOSQUES) break;
  }
  return out;
}

/**
 * Flattens fetched mosques into one pickable option per halaqa. Mosque order
 * follows the index (so the teacher's own mosque, listed first, stays first);
 * halaqat are sorted by name within each mosque, because their order in a
 * Firestore query is arbitrary and a list that reshuffles between launches is
 * a list nobody can build muscle memory for.
 */
export function buildTenantOptions(entries: MosqueEntry[]): TenantOption[] {
  const options: TenantOption[] = [];
  for (const { mosqueId, mosque, halaqat } of entries) {
    // Unreadable (rules said no) or empty — nothing to open either way.
    if (!mosque || halaqat.length === 0) continue;
    const mosqueName = mosque.name?.trim() || mosqueId;
    const sorted = [...halaqat].sort((a, b) =>
      (a.name?.trim() || a.id).localeCompare(b.name?.trim() || b.id, 'ar'),
    );
    for (const h of sorted) {
      options.push({
        mosqueId,
        mosqueName,
        halaqaId: h.id,
        halaqaName: h.name?.trim() || h.id,
      });
    }
  }
  return options;
}
