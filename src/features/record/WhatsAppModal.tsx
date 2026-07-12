import { useToast } from '../../ui/ToastProvider';

interface Props {
  message: string;
  phone: string; // already normalized via normalizeWhatsAppPhone; '' = no known number
  onClose: () => void;
}

export function WhatsAppModal({ message, phone, onClose }: Props) {
  const { showToast } = useToast();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      showToast('✓ تم نسخ الرسالة');
    } catch {
      showToast('⚠️ تعذر النسخ', true);
    }
  }

  function handleSend() {
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    onClose();
  }

  return (
    <div class="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        class="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div class="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <span class="font-bold text-ink-dark">إرسال ملخص الجلسة</span>
          <button class="text-taupe text-lg" onClick={onClose}>
            ✕
          </button>
        </div>

        <div class="p-5 overflow-y-auto flex-1">
          <div class="bg-parchment rounded-lg p-3.5 text-[13px] leading-relaxed whitespace-pre-wrap">{message}</div>
        </div>

        <div class="flex gap-2 px-5 py-4 border-t border-hairline">
          <button class="flex-1 py-2.5 rounded-lg border border-hairline text-sm font-semibold text-[#5B5646]" onClick={onClose}>
            تخطي
          </button>
          <button class="px-4 py-2.5 rounded-lg border border-hairline text-sm" aria-label="نسخ" onClick={handleCopy}>
            📋
          </button>
          {phone && (
            <button
              class="flex-1 py-2.5 rounded-lg text-white text-sm font-bold"
              style={{ background: '#25D366' }}
              onClick={handleSend}
            >
              📲 إرسال واتساب
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
