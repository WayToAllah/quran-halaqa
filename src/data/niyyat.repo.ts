import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Niyyat are stored as a `niyyat: string[]` field on the halaqa document
 * (`mosques/{m}/halaqat/{h}`), which the security rules already gate behind
 * `isMosqueMember` — so this needs no new Firestore rule. No converter is used
 * because we read/write a single field, not the whole Halaqa shape.
 *
 * All niyyat reads/writes go through this module (Repository pattern): no
 * feature code touches the halaqa doc's niyyat field directly.
 */
function halaqaDocRef(mosqueId: string, halaqaId: string) {
  return doc(db, 'mosques', mosqueId, 'halaqat', halaqaId);
}

/** Live-subscribes to the halaqa's niyyat list. Emits `[]` when the field is
 * absent; the header layer decides the default-verse fallback. */
export function subscribeNiyyat(
  mosqueId: string,
  halaqaId: string,
  onChange: (niyyat: string[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    halaqaDocRef(mosqueId, halaqaId),
    (snap) => {
      const data = snap.data();
      const raw = data && Array.isArray(data.niyyat) ? (data.niyyat as unknown[]) : [];
      onChange(raw.filter((x): x is string => typeof x === 'string'));
    },
    onError,
  );
}

/** Persists the full niyyat list. Uses merge so it only touches the `niyyat`
 * field and never clobbers the rest of the halaqa doc (excludedDates, etc.). */
export function saveNiyyat(mosqueId: string, halaqaId: string, niyyat: string[]): Promise<void> {
  return setDoc(halaqaDocRef(mosqueId, halaqaId), { niyyat }, { merge: true });
}
