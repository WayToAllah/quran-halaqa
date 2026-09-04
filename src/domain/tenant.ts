/**
 * Which mosque + halaqa the admin app is currently pointed at.
 *
 * Until now this was two build-time constants in `src/config.ts`, imported
 * directly by every screen. That was correct while مسجد التيسير was the only
 * tenant, but it makes "switch to another mosque" a rebuild rather than a
 * state change. This module is the pure half of the move: no Firebase, no
 * Preact, no storage — just the shape, its validation, and its serialisation,
 * so all of it is testable without a DOM.
 *
 * Validation matters more than it looks. Today both ids are hardcoded and
 * trustworthy; the moment a teacher creates their own mosque the id becomes
 * user-influenced, and an id containing `/` would silently re-path a Firestore
 * reference into a different collection. Rejecting bad ids here means the
 * repository layer never has to.
 */
export interface Tenant {
  readonly mosqueId: string;
  readonly halaqaId: string;
}

/** UTF-8 byte length — Firestore's 1500-byte document-id limit counts bytes,
 * and an Arabic id costs two bytes a letter. */
function byteLength(s: string): number {
  try {
    return new TextEncoder().encode(s).length;
  } catch {
    // No TextEncoder (very old environment): characters are a lower bound, so
    // this can only ever be stricter, never more permissive.
    return s.length;
  }
}

/** The subset of Firestore's document-id rules that a tenant id must satisfy. */
export function isValidTenantId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  if (id.length === 0) return false;
  if (id.includes('/')) return false;
  if (id === '.' || id === '..') return false;
  if (/^__.*__$/.test(id)) return false;
  return byteLength(id) <= 1500;
}

export function isTenant(value: unknown): value is Tenant {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return isValidTenantId(v.mosqueId) && isValidTenantId(v.halaqaId);
}

export function serializeTenant(tenant: Tenant): string {
  return JSON.stringify({ mosqueId: tenant.mosqueId, halaqaId: tenant.halaqaId });
}

/**
 * Reads a stored tenant back. The input is user-writable (localStorage), so
 * anything malformed, hostile or simply from an older shape reads as "nothing
 * stored" — the caller then falls back to the default rather than crashing.
 * Unknown fields are dropped instead of carried forward.
 */
export function parseTenant(raw: string | null | undefined): Tenant | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isTenant(parsed)) return null;
    return { mosqueId: parsed.mosqueId, halaqaId: parsed.halaqaId };
  } catch {
    return null;
  }
}

export function sameTenant(a: Tenant, b: Tenant): boolean {
  return a.mosqueId === b.mosqueId && a.halaqaId === b.halaqaId;
}
