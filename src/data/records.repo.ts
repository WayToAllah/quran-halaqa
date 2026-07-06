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
  onChange: (records: SessionRecord[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  const q = query(recordsCollection(mosqueId, halaqaId), orderBy('date', 'desc'), limit(pageSize));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => d.data())), onError);
}

/** One-time (non-live) page of older records, for "تحميل المزيد" in the log screen. */
export async function loadMoreRecords(
  mosqueId: string,
  halaqaId: string,
  pageSize: number,
  afterDoc: QueryDocumentSnapshot,
): Promise<SessionRecord[]> {
  const q = query(
    recordsCollection(mosqueId, halaqaId),
    orderBy('date', 'desc'),
    startAfter(afterDoc),
    limit(pageSize),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
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
