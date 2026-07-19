import { useState } from 'preact/hooks';
import { cleanNiyyat, DEFAULT_NIYYAH } from '../../domain/niyyat';
import { useToast } from '../../ui/ToastProvider';

interface Props {
  /** Current niyyat (raw from Firestore). */
  niyyat: string[];
  /** Persists the edited list. */
  onSave: (list: string[]) => Promise<void>;
  onClose: () => void;
}

/**
 * Add / edit / remove the rotating niyyat. Each niyyah is its own row so the
 * teacher never has to think about line-based syntax. Saving cleans the list
 * (trims, drops blanks, de-dupes) before persisting; an empty list is allowed
 * and makes the header fall back to the default verse.
 */
export function NiyyatModal({ niyyat, onSave, onClose }: Props) {
  const { showToast } = useToast();
  // Always keep at least one (empty) row so there's a field to type into.
  const [rows, setRows] = useState<string[]>(niyyat.length ? [...niyyat] : ['']);
  const [saving, setSaving] = useState(false);

  function setRow(i: number, val: string) {
    setRows((r) => r.map((x, idx) => (idx === i ? val : x)));
  }
  function addRow() {
    setRows((r) => [...r, '']);
  }
  function removeRow(i: number) {
    setRows((r) => {
      const next = r.filter((_, idx) => idx !== i);
      return next.length ? next : [''];
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(cleanNiyyat(rows));
      showToast('✓ تم حفظ النوايا');
      onClose();
    } catch {
      showToast('⚠️ فشل الحفظ — تأكد من الإنترنت وحاول تاني', true);
    } finally {
      setSaving(false);
    }
  }

  const cleanedCount = cleanNiyyat(rows).length;

  return (
    <div class="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        class="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-hairline sticky top-0 bg-white">
          <div>
            <div class="text-base font-extrabold text-ink-dark">النوايا</div>
            <div class="text-[11px] text-taupe mt-0.5">
              بتظهر بالتناوب فوق. كل سطر نية.
            </div>
          </div>
          <button class="text-taupe text-lg" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <div class="p-5 space-y-2.5">
          {rows.map((row, i) => (
            <div class="flex items-center gap-2" key={i}>
              <input
                type="text"
                dir="rtl"
                placeholder="اكتب نية…"
                class="flex-1 min-w-0 border border-hairline rounded-xl px-3.5 py-2.5 text-sm text-ink-dark"
                value={row}
                onInput={(e) => setRow(i, (e.target as HTMLInputElement).value)}
              />
              <button
                type="button"
                class="w-9 h-9 shrink-0 border border-hairline bg-white rounded-[10px] flex items-center justify-center"
                onClick={() => removeRow(i)}
                aria-label="حذف النية"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#B24A3A" stroke-width="1.8" stroke-linecap="round">
                  <path d="M5 6.5h14M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7M7 6.5l.8 12.7a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.7" />
                </svg>
              </button>
            </div>
          ))}

          <button
            type="button"
            class="w-full py-2.5 rounded-xl border border-dashed border-hairline text-sm font-semibold text-forest"
            onClick={addRow}
          >
            + إضافة نية
          </button>

          {cleanedCount === 0 && (
            <div class="text-[11px] text-taupe bg-parchment rounded-xl px-3 py-2.5 leading-relaxed">
              مفيش نوايا — هيظهر فوق نص افتراضي:
              <div class="font-bold text-ink-dark mt-1">﴿{DEFAULT_NIYYAH}﴾</div>
            </div>
          )}
        </div>

        <div class="flex gap-2 p-5 pt-0">
          <button
            class="flex-1 py-2.5 rounded-xl border border-hairline text-sm font-semibold text-[#5B5646]"
            onClick={onClose}
          >
            إلغاء
          </button>
          <button
            class="flex-1 py-2.5 rounded-xl bg-forest text-parchment text-sm font-bold disabled:opacity-60"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}
