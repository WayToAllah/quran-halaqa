import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { halaqaConverter, mosqueConverter } from './converters';
import { genId } from '../domain/ids';
import { buildMosqueSetup, type MosqueSetupInput } from '../domain/mosqueSetup';
import type { Tenant } from '../domain/tenant';

/**
 * Stands up a new mosque from the client. Ordered, not batched, and that is
 * deliberate: the rules authorise each write by reading what came before it.
 *
 *   1. the mosque — the one self-authorising write; it names its own owner
 *   2. the owner's membership — authorised by ownerUid on (1)
 *   3. the halaqat — authorised by (2)
 *   4. the user's index entry, so the switcher can find it
 *
 * A failure part-way leaves a real, recoverable state rather than a corrupt
 * one: the mosque exists and its owner is recorded on it, so re-running gets
 * further rather than being locked out. Step 4 is last on purpose — an index
 * entry pointing at a mosque that doesn't exist yet would just be dropped from
 * the picker, but the reverse would strand a finished mosque out of sight.
 */
export async function createMosque(input: MosqueSetupInput, ownerUid: string): Promise<Tenant> {
  const plan = buildMosqueSetup(input, ownerUid, () => genId('m'), Date.now());
  const { id: mosqueId } = plan.mosque;

  await setDoc(doc(db, 'mosques', mosqueId).withConverter(mosqueConverter), plan.mosque);
  await setDoc(doc(db, 'mosques', mosqueId, 'members', ownerUid), plan.member);

  for (const halaqa of plan.halaqat) {
    await setDoc(
      doc(db, 'mosques', mosqueId, 'halaqat', halaqa.id).withConverter(halaqaConverter),
      halaqa,
    );
  }

  // arrayUnion so a second device, or a retry, can't drop mosques already listed.
  await setDoc(doc(db, 'users', ownerUid), { mosqueIds: arrayUnion(mosqueId) }, { merge: true });

  return { mosqueId, halaqaId: plan.halaqat[0].id };
}
