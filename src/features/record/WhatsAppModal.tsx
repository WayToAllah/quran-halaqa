import { useToast } from '../../ui/ToastProvider';

interface Props {
  message: string;
  phone: string; // already normalized; '' = no known number
  busy: boolean; // a save is in flight
  isEditing: boolean;
  /** Go back and keep editing — nothing is saved. */
  onBack: () => void;
  /** Commit the session without opening WhatsApp. */
  onSaveOnly: () => void;
  /** Commit the session, then open WhatsApp to the parent. */
  onSaveAndSend: () => void;
}

/**
 * Preview-before-save confirmation. Shows the exact summary the parent will
 * receive so the teacher reviews the whole session before it's written — the
 * review IS the confirmation. Nothing has been saved while this is open:
 *  - "رجوع للتعديل" -> close, keep editing (no write);
 *  - "احفظ فقط" -> commit without messaging;
 *  - "احفظ وأرسل" -> commit, then open WhatsApp.
 */
export function WhatsAppModal({
  message,
  phone,
  busy,
  isEditing,
  onBack,
  onSaveOnly,
  onSaveAndSend,
}: Props) {
  const { showToast } = useToast();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      showToast('✓ تم نسخ الرسالة');
    } catch {
      showToast('⚠️ تعذر النسخ', true);
    }
  }

  return (
    <div
      class="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={busy ? undefined : onBack}
    >
      <div
        class="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div class="px-5 py-4 border-b border-hairline">
          <div class="font-bold text-ink-dark">مراجعة قبل الحفظ</div>
          <div class="text-[11px] text-taupe mt-0.5">
            راجع ملخص الجلسة زيّ ما ولي الأمر هيشوفه. لسه مفيش حاجة اتحفظت.
          </div>
        </div>

        <div class="p-5 overflow-y-auto flex-1">
          <div class="bg-parchment rounded-lg p-3.5 text-[13px] leading-relaxed whitespace-pre-wrap">
            {message}
          </div>
          <button
            class="mt-3 text-[12px] font-semibold text-taupe flex items-center gap-1"
            onClick={handleCopy}
          >
            📋 نسخ النص
          </button>
        </div>

        <div class="border-t border-hairline p-5 space-y-2">
          <button
            class="w-full py-3 rounded-xl text-white font-bold text-[15px] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: phone ? '#25D366' : '#0F3D2E' }}
            disabled={busy}
            onClick={phone ? onSaveAndSend : onSaveOnly}
          >
            {busy
              ? '⏳ جاري الحفظ…'
              : phone
                ? isEditing
                  ? '📲 حدّث وأرسل واتساب'
                  : '📲 احفظ وأرسل واتساب'
                : isEditing
                  ? '✓ حدّث الجلسة'
                  : '✓ احفظ الجلسة'}
          </button>

          {phone && (
            <button
              class="w-full py-2.5 rounded-xl border border-hairline text-[#5B5646] text-sm font-semibold disabled:opacity-60"
              disabled={busy}
              onClick={onSaveOnly}
            >
              {isEditing ? 'حدّث بدون إرسال' : 'احفظ بدون إرسال'}
            </button>
          )}

          <button
            class="w-full py-2.5 rounded-xl text-taupe text-sm font-semibold disabled:opacity-60"
            disabled={busy}
            onClick={onBack}
          >
            ← رجوع للتعديل
          </button>
        </div>
      </div>
    </div>
  );
}
