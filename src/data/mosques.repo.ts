import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { halaqaConverter, mosqueConverter } from './converters';
import type { Halaqa, Mosque, MosqueMember, UserMosques } from '../types';

/**
 * Reads the `admins/{uid}` doc listing every mosque a signed-in admin can work
 * on. This is the denormalized lookup the old getMembership() comment
 * anticipated — one read at login resolves the user's tenant(s) without
 * probing each mosque's members subcollection. Returns null when the user has
 * no admin record at all (i.e. not provisioned for any mosque yet).
 *
 * Security note: this doc only NAMES the mosques; it grants nothing. Actual
 * access is still enforced by the per-mosque `members/{uid}` doc and the
 * Firestore rules — a tampered admins doc can't read data the rules don't
 * already allow.
 */
export async function getUserMosques(uid: string): Promise<UserMosques | null> {
  const snap = await getDoc(doc(db, 'admins', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<UserMosques>;
  const mosques = Array.isArray(data.mosques) ? data.mosques.filter((m) => m?.mosqueId) : [];
  return { mosques };
}

/**
 * Finds which mosque(s) a signed-in admin belongs to, by checking each
 * candidate mosque's `members/{uid}` doc. There's no top-level "list all
 * mosques a user belongs to" query in Firestore without a denormalized
 * lookup collection — for the single-mosque case (مسجد التيسير, today's
 * only tenant) this is called with just that one mosqueId. A denormalized
 * `userMosques/{uid}` collection is the natural next step once there's a
 * second mosque to look up.
 */
export async function getMembership(mosqueId: string, uid: string): Promise<MosqueMember | null> {
  const snap = await getDoc(doc(db, 'mosques', mosqueId, 'members', uid));
  return snap.exists() ? (snap.data() as MosqueMember) : null;
}

export async function getMosque(mosqueId: string): Promise<Mosque | null> {
  const snap = await getDoc(doc(db, 'mosques', mosqueId).withConverter(mosqueConverter));
  return snap.exists() ? snap.data() : null;
}

export async function getHalaqa(mosqueId: string, halaqaId: string): Promise<Halaqa | null> {
  const snap = await getDoc(doc(db, 'mosques', mosqueId, 'halaqat', halaqaId).withConverter(halaqaConverter));
  return snap.exists() ? snap.data() : null;
}

export async function listHalaqat(mosqueId: string): Promise<Halaqa[]> {
  const snap = await getDocs(collection(db, 'mosques', mosqueId, 'halaqat').withConverter(halaqaConverter));
  return snap.docs.map((d) => d.data());
}
