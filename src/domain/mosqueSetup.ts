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
/** The halaqa a mosque gets when the teacher names none — the same name
 * مسجد التيسير's single halaqa carries. Renamable later from the switcher. */
export const DEFAULT_HALAQA_NAME = 'الحلقة الرئيسية';

/** One rule for every mosque/halaqa name, at creation and on rename.
 * `what` is «المسجد» or «الحلقة». */
export function validatePlaceName(name: string, what: string): string | null {
  const n = clean(name);
  if (!n) return `اكتب اسم ${what}`;
  if (n.length > MAX_NAME_LEN) return `اسم ${what} طويل أوي`;
  return null;
}

export function validateMosqueSetup(input: MosqueSetupInput): string | null {
  const nameProblem = validatePlaceName(input.mosqueName, 'المسجد');
  if (nameProblem) return nameProblem;

  // Halaqa names are optional: blank rows are dropped, and a mosque with none
  // gets DEFAULT_HALAQA_NAME (see buildMosqueSetup).
  const halaqat = input.halaqaNames.map(clean).filter(Boolean);
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
    halaqat: halaqaNamesOrDefault(input.halaqaNames).map((name) => ({
      id: nextId(),
      name,
      attendanceBadgeThreshold: DEFAULT_ATTENDANCE_BADGE_THRESHOLD,
    })),
  };
}

function halaqaNamesOrDefault(names: string[]): string[] {
  const named = names.map(clean).filter(Boolean);
  return named.length ? named : [DEFAULT_HALAQA_NAME];
}
