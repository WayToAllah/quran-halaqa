interface Props {
  title: string;
  message: string;
  /** Defaults to "تأكيد". */
  confirmLabel?: string;
  /** Defaults to "إلغاء". */
  cancelLabel?: string;
  /** True renders the confirm button in the red/destructive style instead
   * of the default forest-green — use for actions the teacher should think
   * twice about (e.g. saving an empty session). */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A small yes/no confirmation modal, styled to match the rest of the app's
 * modals (NiyyatModal, WhatsAppModal, MistakeCounterModal). Replaces the
 * browser's native `confirm()`, which looks jarring on mobile and can't be
 * restyled or reasoned about in tests the way a real component can.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        class="w-full sm:max-w-sm bg-white rounded-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div>
          <div class="text-base font-extrabold text-ink-dark">{title}</div>
          <div class="text-[13px] text-taupe mt-1.5 leading-relaxed">{message}</div>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 py-2.5 rounded-xl border border-hairline text-sm font-semibold text-[#5B5646]"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            class={
              'flex-1 py-2.5 rounded-xl text-sm font-bold text-parchment ' +
              (destructive ? 'bg-[#B24A3A]' : 'bg-forest')
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
