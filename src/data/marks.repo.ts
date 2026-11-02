import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { genMarksCode } from '../domain/shortMarks';

/**
 * Saves one set of red-marked words under a fresh short code and resolves with
 * the code once the SERVER has accepted it — only then is a link to it safe to
 * hand a parent. Rejects if the rules refuse it (e.g. not yet deployed); the
 * caller keeps the full link in that case.
 */
export async function createShortMarks(mosqueId: string, q: string): Promise<string> {
  const code = genMarksCode();
  await setDoc(doc(db, 'marks', code), { q, mosqueId, createdAt: serverTimestamp() });
  return code;
}
