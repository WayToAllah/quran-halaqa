import type { UserMosqueLink } from '../types';

/**
 * Pure logic for picking which mosque is "active" out of the list a user
 * belongs to, honoring a remembered preference. Kept free of localStorage and
 * Firebase so it's trivially testable; the hook layer supplies the remembered
 * id and persists the result.
 *
 * Rules:
 *  - empty list → null (user provisioned for no mosque; caller shows a "no
 *    mosque" state rather than crashing on a hardcoded id).
 *  - remembered id still present in the list → use it (the teacher's last
 *    choice survives an app restart).
 *  - remembered id gone (revoked, renamed away) or never set → first in list.
 */
export function pickActiveMosque(
  mosques: readonly UserMosqueLink[],
  rememberedMosqueId: string | null,
): UserMosqueLink | null {
  if (mosques.length === 0) return null;
  if (rememberedMosqueId) {
    const remembered = mosques.find((m) => m.mosqueId === rememberedMosqueId);
    if (remembered) return remembered;
  }
  return mosques[0];
}
