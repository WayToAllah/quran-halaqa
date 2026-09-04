import { parseTenant, serializeTenant, type Tenant } from '../domain/tenant';
import type { StorageLike } from './membershipCache';

/**
 * Remembers which mosque/halaqa this device was last pointed at, so a teacher
 * who belongs to more than one doesn't re-pick on every launch.
 *
 * This is NOT a security boundary, exactly like membershipCache: Firestore's
 * rules decide what this account can actually read or write, on the server,
 * every time. A tampered value buys nothing but a screen of failed reads —
 * and `parseTenant` rejects malformed entries anyway, so the app falls back to
 * the default mosque rather than trusting them.
 *
 * A single key, deliberately: one selection per device, overwritten in place,
 * so nothing accumulates and there is no stale second entry to disagree with.
 */
export const TENANT_STORAGE_KEY = 'halaqa:tenant';

/** Storage access throws outright in some privacy modes, so every call is guarded. */
function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function rememberTenant(
  tenant: Tenant,
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    storage?.setItem(TENANT_STORAGE_KEY, serializeTenant(tenant));
  } catch {
    // A full or unavailable store just means the selection doesn't survive a
    // reload; the app still works against whatever is picked this session.
  }
}

export function recallTenant(storage: StorageLike | null = defaultStorage()): Tenant | null {
  try {
    return parseTenant(storage?.getItem(TENANT_STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
}

export function forgetTenant(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(TENANT_STORAGE_KEY);
  } catch {
    // The value is advisory only; failing to clear it is not fatal.
  }
}
