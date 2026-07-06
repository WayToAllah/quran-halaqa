import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { studentConverter } from './converters';
import type { Student } from '../types';

/**
 * Every student read/write for a given halaqa goes through this module —
 * no other file should call `doc()`/`collection()` on the students path
 * directly. This is what makes it possible to, e.g., swap the underlying
 * storage or add caching later without touching feature code.
 */
function studentsCollection(mosqueId: string, halaqaId: string) {
  return collection(db, 'mosques', mosqueId, 'halaqat', halaqaId, 'students').withConverter(studentConverter);
}

export function studentDocRef(mosqueId: string, halaqaId: string, studentId: string) {
  return doc(db, 'mosques', mosqueId, 'halaqat', halaqaId, 'students', studentId).withConverter(studentConverter);
}

/** Live-subscribes to the full student list for a halaqa (typically ≤50 rows —
 * see PROJECT_CONTEXT.md §10 — so loading the whole collection is intentional,
 * unlike `records`, which is paginated/queried instead). */
export function subscribeStudents(
  mosqueId: string,
  halaqaId: string,
  onChange: (students: Student[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    studentsCollection(mosqueId, halaqaId),
    (snap) => onChange(snap.docs.map((d) => d.data())),
    onError,
  );
}

export function saveStudent(mosqueId: string, halaqaId: string, student: Student): Promise<void> {
  return setDoc(studentDocRef(mosqueId, halaqaId, student.id), student);
}

export function updateStudent(
  mosqueId: string,
  halaqaId: string,
  studentId: string,
  patch: Partial<Student>,
): Promise<void> {
  return updateDoc(studentDocRef(mosqueId, halaqaId, studentId), patch);
}

export function deleteStudent(mosqueId: string, halaqaId: string, studentId: string): Promise<void> {
  return deleteDoc(studentDocRef(mosqueId, halaqaId, studentId));
}
