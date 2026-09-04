import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { publicStatsConverter } from './converters';
import type { PublicStats } from '../types';

/**
 * `publicStats` is a top-level (not nested under mosques/halaqat) collection
 * deliberately — child.html reads it by parentToken alone, with no mosque/
 * halaqa context and no sign-in. See /firestore.rules: `get` is public,
 * `list` is denied (so tokens can never be enumerated), `write` is denied to
 * clients entirely — this is written by the admin app for now and by a
 * Cloud Function once Phase 5 lands, never directly by an untrusted client.
 */
function publicStatsDocRef(token: string) {
  return doc(db, 'publicStats', token).withConverter(publicStatsConverter);
}

export async function getPublicStats(token: string): Promise<PublicStats | null> {
  const snap = await getDoc(publicStatsDocRef(token));
  return snap.exists() ? snap.data() : null;
}

/** Admin-only write (enforced by rules, not by this function) — recomputed
 * whenever a student's records change. See stats.ts's buildStudentPublicStats
 * for how the payload itself is computed. */
export function setPublicStats(token: string, stats: PublicStats): Promise<void> {
  return setDoc(publicStatsDocRef(token), stats);
}

/** Removes a family's projection. Called when the student is deleted: their
 * token has already been sent out on WhatsApp, so leaving the document behind
 * keeps an ex-student's name and scores world-readable at a known URL. */
export function deletePublicStats(token: string): Promise<void> {
  return deleteDoc(doc(db, 'publicStats', token));
}
