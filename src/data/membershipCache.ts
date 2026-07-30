import type { MosqueMember } from '../types';

/**
 * Remembers, on this device, that the server already confirmed this account's
 * membership — so opening the app with no connection doesn't look like a
 * rejection.
 *
 * This is NOT a security boundary and must never be treated as one. Firestore's
 * rules decide what can actually be read or written, on the server, every time.
 * Tampering with this value changes nothing except whether we render the UI or
 * bounce the teacher to the login screen; a forged entry buys an attacker a
 * screen full of failed reads.
 *
 * Deliberately localStorage rather than the Firestore cache: it has to be
 * readable when the Firestore client itself is the thing that failed.
 */
const PREFIX = 'halaqa:member:';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Storage access throws outright in some privacy modes, so every call is guarded. */
function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function keyFor(mosqueId: string, uid: string): string {
  return `${PREFIX}${mosqueId}:${uid}`;
}

export function rememberMembership(
  mosqueId: string,
  uid: string,
  member: MosqueMember,
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    storage?.setItem(keyFor(mosqueId, uid), JSON.stringify(member));
  } catch {
    // A full or unavailable store just means no offline opens; not fatal.
  }
}

export function recallMembership(
  mosqueId: string,
  uid: string,
  storage: StorageLike | null = defaultStorage(),
): MosqueMember | null {
  try {
    const raw = storage?.getItem(keyFor(mosqueId, uid));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Anything that isn't a plausible member object is treated as absent
    // rather than trusted — the value is user-writable.
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as MosqueMember;
  } catch {
    return null;
  }
}

/** Called when the server says this account is NOT a member, so a stale
 * confirmation can never outlive the access it recorded. */
export function forgetMembership(
  mosqueId: string,
  uid: string,
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    storage?.removeItem(keyFor(mosqueId, uid));
  } catch {
    // Nothing to do; the value is advisory only.
  }
}
