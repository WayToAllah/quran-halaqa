import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  type Unsubscribe,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { recordConverter } from './converters';
import type { SessionRecord } from '../types';

function recordsCollection(mosqueId: string, halaqaId: string) {
  return collection(db, 'mosques', mosqueId, 'halaqat', halaqaId, 'records').withConverter(recordConverter);
}

export function recordDocRef(mosqueId: string, halaqaId: string, recordId: string) {
  return doc(db, 'mosques', mosqueId, 'halaqat', halaqaId, 'records', recordId).withConverter(recordConverter);
}

/**
 * Live-subscribes to only the most recent `pageSize` records, newest first.
 *
 * This replaces the old `.on('value')` on the whole `records` RTDB tree,
 * which re-downloaded every session ever recorded on every single change —
 * fine at a few thousand records, a real problem an order of magnitude up.
 * The السجل screen calls `loadMore()` (a plain `getDocs` with `startAfter`,
 * not a second live listener) to page further back in history.
 */
export function subscribeRecentRecords(
  mosqueId: string,
  halaqaId: string,
  pageSize: number,
  onChange: (records: SessionRecord[], lastDoc: QueryDocumentSnapshot | null) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  const q = query(recordsCollection(mosqueId, halaqaId), orderBy('date', 'desc'), limit(pageSize));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data()), snap.docs[snap.docs.length - 1] ?? null),
    onError,
  );
}

/** One-time (non-live) page of older records, for "تحميل المزيد" in the log screen.
 * Returns the new records plus the new last-doc cursor for a further page. */
export async function loadMoreRecords(
  mosqueId: string,
  halaqaId: string,
  pageSize: number,
  afterDoc: QueryDocumentSnapshot,
): Promise<{ records: SessionRecord[]; lastDoc: QueryDocumentSnapshot | null }> {
  const q = query(
    recordsCollection(mosqueId, halaqaId),
    orderBy('date', 'desc'),
    startAfter(afterDoc),
    limit(pageSize),
  );
  const snap = await getDocs(q);
  return { records: snap.docs.map((d) => d.data()), lastDoc: snap.docs[snap.docs.length - 1] ?? null };
}

/**
 * Targeted lookup used by شاشة التسجيل to auto-load a student's most recent
 * assignment — a single indexed query instead of loading every record and
 * filtering client-side (requires a composite index on
 * studentId + date desc, see firestore.indexes.json).
 */
export async function getMostRecentRecordForStudent(
  mosqueId: string,
  halaqaId: string,
  studentId: string,
): Promise<SessionRecord | null> {
  const q = query(
    recordsCollection(mosqueId, halaqaId),
    where('studentId', '==', studentId),
    orderBy('date', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
}

/** All records for one student — used for that student's own history/stats,
 * not for the general log screen (which stays paginated). */
export async function getAllRecordsForStudent(
  mosqueId: string,
  halaqaId: string,
  studentId: string,
): Promise<SessionRecord[]> {
  const q = query(recordsCollection(mosqueId, halaqaId), where('studentId', '==', studentId), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

/** All records in a date range (inclusive) — used by the إحصاءات screen's
 * month filter and by the public-stats recompute job. */
export async function getRecordsInDateRange(
  mosqueId: string,
  halaqaId: string,
  fromDate: string,
  toDate: string,
): Promise<SessionRecord[]> {
  const q = query(
    recordsCollection(mosqueId, halaqaId),
    where('date', '>=', fromDate),
    where('date', '<=', toDate),
    orderBy('date', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

/**
 * Live-subscribes to EVERY record in the halaqa, with no limit — the one
 * deliberate exception to this file's "no whole-tree loads" rule. Cross-
 * student aggregates (attendance ranking, badges) are mathematically
 * cross-cutting and can't be computed from a paginated slice; the Log
 * screen and record-lookup functions above all stay paginated/targeted,
 * which is what actually scales badly with history (every session, every
 * change, on every screen). This one scales the same way the original app
 * did — acceptable at "a few thousand records" today, and the real fix is
 * moving ranking into a server-side recompute (Phase 5), not fixing it here.
 */
export function subscribeAllRecords(
  mosqueId: string,
  halaqaId: string,
  onChange: (records: SessionRecord[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(recordsCollection(mosqueId, halaqaId), (snap) => onChange(snap.docs.map((d) => d.data())), onError);
}

/** All records on one specific date — used by group attendance to find
 * students already covered that day, without loading the whole halaqa's
 * history. Single-field equality filter, no composite index needed. */
export async function getRecordsByDate(mosqueId: string, halaqaId: string, dateStr: string): Promise<SessionRecord[]> {
  const q = query(recordsCollection(mosqueId, halaqaId), where('date', '==', dateStr));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export function saveRecord(mosqueId: string, halaqaId: string, record: SessionRecord): Promise<void> {
  return setDoc(recordDocRef(mosqueId, halaqaId, record.id), record);
}

export function updateRecord(
  mosqueId: string,
  halaqaId: string,
  recordId: string,
  patch: Partial<SessionRecord>,
): Promise<void> {
  return updateDoc(recordDocRef(mosqueId, halaqaId, recordId), patch);
}

export function deleteRecord(mosqueId: string, halaqaId: string, recordId: string): Promise<void> {
  return deleteDoc(recordDocRef(mosqueId, halaqaId, recordId));
}
