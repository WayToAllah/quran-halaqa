import type { FirestoreDataConverter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { Student, SessionRecord, PublicStats, Halaqa, Mosque } from '../types';

/** Generic converter factory: Firestore stores no `id` field on the document
 * body itself (it's the document's key), so every converter re-attaches the
 * doc id on read and strips it before writing. */
function makeConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T): DocumentData {
      const { id: _id, ...rest } = data;
      return rest;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return { id: snapshot.id, ...snapshot.data() } as T;
    },
  };
}

export const studentConverter = makeConverter<Student>();
export const recordConverter = makeConverter<SessionRecord>();
export const halaqaConverter = makeConverter<Halaqa>();
export const mosqueConverter = makeConverter<Mosque>();

// publicStats documents are keyed by parentToken, which isn't part of the
// PublicStats shape itself, so this one is a plain pass-through (no id merge).
export const publicStatsConverter: FirestoreDataConverter<PublicStats> = {
  toFirestore(data: PublicStats): DocumentData {
    return { ...data };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): PublicStats {
    return snapshot.data() as PublicStats;
  },
};
