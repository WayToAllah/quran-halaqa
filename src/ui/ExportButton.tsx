import { useState } from 'preact/hooks';
import { useToast } from './ToastProvider';

/** Small «Excel» pill for a screen header. `onExport` builds and downloads the
 * file; the button only owns the busy state and the failure message. */
export function ExportButton({
  onExport,
  disabled,
  label,
}: {
  onExport: () => Promise<void>;
  disabled?: boolean;
  /** Accessible name — says WHAT is exported. */
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled || busy}
      class="text-xs font-bold text-forest bg-white border-[1.5px] border-forest/25 px-3 py-1 rounded-full flex items-center gap-1 disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        try {
          await onExport();
        } catch (err) {
          console.error('excel export failed:', err);
          showToast('تعذّر تصدير الملف، جرّب تاني', true);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? '…' : '⬇️'} Excel
    </button>
  );
}
