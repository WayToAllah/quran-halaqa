import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Halaqa, UserMosqueLink } from '../../types';
import { MOSQUE_ID, HALAQA_ID } from '../../config';

/**
 * The active mosque/halaqa for the whole admin app. Replaces importing the
 * hardcoded MOSQUE_ID/HALAQA_ID constants directly in every screen and hook:
 * screens call useMosque() and get whichever tenant the signed-in admin is
 * currently working on. The provider is fed by useAuth's `active` state.
 *
 * The default value is the single-tenant fallback so any component rendered
 * outside a provider (e.g. isolated in a test that doesn't need mosque
 * context) still gets the historical altayseer/main behavior.
 */
export interface MosqueContextValue {
  mosqueId: string;
  halaqaId: string;
  /** Every mosque the current admin belongs to (for the switcher). One entry
   * in the common single-mosque case. */
  mosques: UserMosqueLink[];
  /** Every halaqa inside the ACTIVE mosque. All of them are usable by any
   * mosque member — that's what lets a substitute cover another teacher's
   * circle. */
  halaqat: Halaqa[];
  /** Switch the active mosque by id; no-op if the id isn't in `mosques`. */
  switchMosque: (mosqueId: string) => void;
  /** Switch the active halaqa by id; no-op if the id isn't in `halaqat`. */
  switchHalaqa: (halaqaId: string) => void;
}

const FALLBACK: MosqueContextValue = {
  mosqueId: MOSQUE_ID,
  halaqaId: HALAQA_ID,
  mosques: [{ mosqueId: MOSQUE_ID, label: 'مسجد التيسير' }],
  halaqat: [
    { id: HALAQA_ID, name: 'الحلقة الرئيسية', excludedDates: [], attendanceBadgeThreshold: 70 },
  ],
  switchMosque: () => {},
  switchHalaqa: () => {},
};

const MosqueContext = createContext<MosqueContextValue>(FALLBACK);

export function MosqueProvider({
  value,
  children,
}: {
  value: MosqueContextValue;
  children: ComponentChildren;
}) {
  return <MosqueContext.Provider value={value}>{children}</MosqueContext.Provider>;
}

/** Read the active mosque/halaqa. Use this instead of importing MOSQUE_ID. */
export function useMosque(): MosqueContextValue {
  return useContext(MosqueContext);
}
