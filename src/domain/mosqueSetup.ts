import type { Halaqa, Mosque, MosqueMember } from '../types';

/**
 * Everything needed to stand up a new mosque, worked out before a single write
 * leaves the device.
 *
 * The shape here is what makes in-app creation possible without a Cloud
 * Function. The mosque document carries `ownerUid`, so creating it is one
 * self-authorising write — the rules only have to check that the creator named
 * themselves. Every later write (the owner's membership, the halaqat) is then
 * authorised by reading that committed document. Two documents that had to
 * appear together atomically would have needed a server, because rules
 * evaluate each write in a batch independently.
 */

/** Kept in step with the length cap in firestore.rules; a name the rules would
 * reject must fail here first, where the teacher can actually see why. */
export const MAX_NAME_LEN = 80;

export const DEFAULT_ATTENDANCE_BADGE_THRESHOLD = 70;

export interface MosqueSetupInput {
  mosqueName: string;
  halaqaNames: string[];
}

export interface MosqueSetupPlan {
  mosque: Mosque & { ownerUid: string };
  ownerUid: string;
  member: MosqueMember;
  halaqat: Halaqa[];
}

const clean = (s: string) => s.trim();

/** Returns an Arabic message for the first problem, or null when it's fine. */
export function validateMosqueSetup(input: MosqueSetupInput): string | null {
  const name = clean(input.mosqueName);
  if (!name) return 'اكتب اسم المسجد';
  if (name.length > MAX_NAME_LEN) return 'اسم المسجد طويل أوي';

  const halaqat = input.halaqaNames.map(clean).filter(Boolean);
  // A mosque with no halaqa can never be opened — the switcher drops it — so
  // the teacher would create it and then not find it anywhere.
  if (halaqat.length === 0) return 'ضيف حلقة واحدة على الأقل';
  if (halaqat.some((h) => h.length > MAX_NAME_LEN)) return 'اسم الحلقة طويل أوي';
  if (new Set(halaqat).size !== halaqat.length) return 'فيه اسم حلقة مكرر';

  return null;
}

export function buildMosqueSetup(
  input: MosqueSetupInput,
  ownerUid: string,
  nextId: () => string,
  now: number,
): MosqueSetupPlan {
  const problem = validateMosqueSetup(input);
  if (problem) throw new Error(problem);

  return {
    mosque: {
      id: nextId(),
      name: clean(input.mosqueName),
      createdAt: now,
      ownerUid,
    },
    ownerUid,
    member: { role: 'owner' },
    halaqat: input.halaqaNames
      .map(clean)
      .filter(Boolean)
      .map((name) => ({
        id: nextId(),
        name,
        excludedDates: [],
        attendanceBadgeThreshold: DEFAULT_ATTENDANCE_BADGE_THRESHOLD,
      })),
  };
}
