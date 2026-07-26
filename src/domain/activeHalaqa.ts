import type { Halaqa } from '../types';

/**
 * Picks which halaqa is "active" inside the current mosque. Every mosque
 * member can open every halaqa (so substitutes can cover), so this is purely
 * about choosing a sensible default and honoring the teacher's last choice —
 * it is NOT an access check.
 *
 * Priority:
 *  1. the remembered halaqa, if it still exists (last thing the teacher used)
 *  2. the halaqa this teacher is the primary teacher of (their own circle)
 *  3. the first halaqa in the mosque
 *  4. null when the mosque has no halaqat at all
 */
export function pickActiveHalaqa(
  halaqat: readonly Halaqa[],
  rememberedHalaqaId: string | null,
  currentUid: string | null,
): Halaqa | null {
  if (halaqat.length === 0) return null;

  if (rememberedHalaqaId) {
    const remembered = halaqat.find((h) => h.id === rememberedHalaqaId);
    if (remembered) return remembered;
  }

  if (currentUid) {
    const own = halaqat.find((h) => h.primaryTeacherUid === currentUid);
    if (own) return own;
  }

  return halaqat[0];
}
