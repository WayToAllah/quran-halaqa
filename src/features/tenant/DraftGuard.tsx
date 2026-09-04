import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

/**
 * Whether any screen is holding work the teacher hasn't saved.
 *
 * All four screens stay mounted at once (see the comment in app.tsx — that is
 * deliberate, so a tab switch never wipes a half-typed session). That makes
 * switching mosque genuinely dangerous: RecordScreen would still be holding a
 * studentId from the mosque you just left, and saving would file that session
 * under the new one. The switcher reads this to warn before it moves.
 */
interface DraftGuardValue {
  hasDraft: boolean;
  report: (id: string, hasDraft: boolean) => void;
}

const DraftGuardCtx = createContext<DraftGuardValue | null>(null);

export function DraftGuardProvider({ children }: { children: ComponentChildren }) {
  // Keyed by reporter so two screens can hold drafts independently and one
  // going clean doesn't clear the other's.
  const [drafts, setDrafts] = useState<Record<string, boolean>>({});

  const report = useCallback((id: string, hasDraft: boolean) => {
    setDrafts((prev) => {
      if (!hasDraft && !(id in prev)) return prev;
      if (prev[id] === hasDraft) return prev;
      if (!hasDraft) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: true };
    });
  }, []);

  const value = useMemo<DraftGuardValue>(
    () => ({ hasDraft: Object.values(drafts).some(Boolean), report }),
    [drafts, report],
  );

  return <DraftGuardCtx.Provider value={value}>{children}</DraftGuardCtx.Provider>;
}

/** Safe to read anywhere: no provider simply means nothing is holding a draft. */
export function useDraftGuard(): { hasDraft: boolean } {
  return { hasDraft: useContext(DraftGuardCtx)?.hasDraft ?? false };
}

/**
 * Reports this screen's unsaved state upward, and withdraws the report when the
 * screen unmounts — otherwise a screen that goes away would block switching
 * forever with nothing left to clear it.
 *
 * Throws without a provider on purpose: a silent no-op would leave a screen
 * believing its unsaved work is protected when nothing is watching.
 */
export function useReportDraft(hasDraft: boolean, id = 'default'): void {
  const ctx = useContext(DraftGuardCtx);
  if (!ctx) throw new Error('useReportDraft must be used inside a DraftGuardProvider');
  const { report } = ctx;

  useEffect(() => {
    report(id, hasDraft);
  }, [report, id, hasDraft]);

  useEffect(() => () => report(id, false), [report, id]);
}
