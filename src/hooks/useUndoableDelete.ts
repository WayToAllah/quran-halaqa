import { useRef, useState } from 'preact/hooks';
import { useToast } from '../ui/ToastProvider';

/**
 * Delete with a five-second "تراجع" window.
 *
 * The delete is committed IMMEDIATELY and undo re-writes the item, rather than
 * the item merely vanishing from the list while a timer counts down to the
 * real delete. The timer version lost deletes outright: teachers work on a
 * phone that sleeps the moment they put it down, and closing the app (or
 * losing the process) inside those five seconds meant the timer never fired —
 * the row the teacher had deleted was simply back on the next open, with
 * nothing to indicate the delete hadn't taken.
 *
 * Restoring writes the same document id back, so an undone delete is
 * indistinguishable from never having deleted: parent tracking links, the
 * record's place in the session chain and every id reference survive.
 */
export function useUndoableDelete() {
  const { showUndoToast, showToast } = useToast();
  /** Ids hidden from the list. Kept so the row disappears on the same frame as
   * the tap, without waiting for the round trip to Firestore. */
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  /** Undo already run for this id — guards a double tap on the toast. */
  const undoneRef = useRef<Set<string>>(new Set());

  function hide(id: string) {
    setPendingIds((prev) => new Set(prev).add(id));
  }
  function unhide(id: string) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  /**
   * @param performDelete commits the delete.
   * @param restore puts the item back, byte-identical, under the same id.
   */
  function requestDelete(
    id: string,
    label: string,
    performDelete: (id: string) => Promise<void>,
    restore?: () => Promise<void>,
  ) {
    hide(id);
    undoneRef.current.delete(id);

    void (async () => {
      try {
        await performDelete(id);
      } catch (err) {
        console.error('delete failed:', err);
        // Nothing was deleted, so the row must come back rather than sit
        // hidden behind a success toast that lied.
        unhide(id);
        showToast('⚠️ فشل الحذف — تأكد من الإنترنت وحاول تاني', true);
        return;
      }

      showUndoToast(label, () => {
        if (!restore || undoneRef.current.has(id)) return;
        undoneRef.current.add(id);
        // Show it again straight away; a failed restore re-hides it below.
        unhide(id);
        void restore().catch((err) => {
          console.error('restore failed:', err);
          hide(id);
          showToast('⚠️ فشل التراجع — الحذف اتم فعلاً', true);
        });
      });
    })();
  }

  return { pendingIds, requestDelete };
}
