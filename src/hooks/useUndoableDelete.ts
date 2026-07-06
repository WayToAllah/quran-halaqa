import { useRef, useState } from 'preact/hooks';
import { useToast } from '../ui/ToastProvider';

/**
 * Same "soft delete" pattern used throughout the live app: the item
 * disappears from the list immediately, a toast with "تراجع" appears, and
 * the actual delete only fires after a 5s window if the user doesn't
 * cancel it. Extracted here because both the Students and Log screens need
 * exactly this behavior — see scheduleUndoableDelete in the live index.html
 * for the original single-file version this replaces.
 */
export function useUndoableDelete() {
  const { showUndoToast, showToast } = useToast();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function requestDelete(id: string, label: string, performDelete: (id: string) => Promise<void>) {
    setPendingIds((prev) => new Set(prev).add(id));

    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      timers.current.delete(id);
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      try {
        await performDelete(id);
      } catch (err) {
        console.error('delete failed:', err);
        showToast('⚠️ فشل الحذف — تأكد من الإنترنت وحاول تاني', true);
      }
    }, 5000);
    timers.current.set(id, timer);

    showUndoToast(label, () => {
      const t = timers.current.get(id);
      if (t) {
        clearTimeout(t);
        timers.current.delete(id);
      }
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  return { pendingIds, requestDelete };
}
