import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { parseUserIndex } from '../domain/memberships';

/**
 * `users/{uid}` is the lookup index described in domain/memberships.ts: a plain
 * list of mosque ids, because Firestore cannot answer "which mosques is this
 * uid a member of" without one.
 *
 * Deliberately unconverted and defensively parsed. The document is written by
 * the client (a teacher creating their own mosque adds their own entry), so it
 * is untrusted input — parseUserIndex validates, de-duplicates and caps it, and
 * the rules still decide which of those mosques can actually be read.
 */
export async function getUserMosqueIds(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'users', uid));
  return parseUserIndex(snap.exists() ? snap.data() : null);
}
