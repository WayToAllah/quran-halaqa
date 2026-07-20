import type { ComponentChildren } from 'preact';

interface Props {
  /** Icon (emoji or node) shown before the label. */
  icon: ComponentChildren;
  /** Short label, e.g. "حفظ الجلسة". */
  label: string;
  /** True while a save is in flight — disables the button and swaps the icon. */
  busy: boolean;
  onClick: () => void;
}

/**
 * A floating "extended FAB" for saving. Stays fixed above the bottom nav so the
 * teacher can save at any scroll position without hunting for a button at the
 * end of a long form. It keeps an explicit label (not a bare icon) because
 * saving is a committing action — a silent icon is too easy to mis-tap and
 * hides whether you're creating vs updating.
 *
 * Positioned bottom-start (right edge in RTL is `start`; we use left via
 * `left-4` so in an RTL doc it sits on the visual left, thumb-reachable) and
 * clear of the fixed nav (`bottom` accounts for the ~64px nav + safe area).
 */
export function FloatingSaveButton({ icon, label, busy, onClick }: Props) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      aria-label={label}
      class="fixed z-30 left-4 flex items-center gap-2 pr-4 pl-5 py-3.5 rounded-full bg-forest text-parchment font-extrabold text-[15px] shadow-[0_10px_28px_rgba(15,61,46,0.4)] disabled:opacity-70 active:scale-95 transition-transform"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
    >
      <span class="text-[17px] leading-none">{busy ? '⏳' : icon}</span>
      <span>{busy ? 'جاري الحفظ…' : label}</span>
    </button>
  );
}
