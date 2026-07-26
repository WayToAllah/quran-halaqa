interface Props {
  /** Accessible name — the button shows only a glyph, so this is the only
   * thing a screen reader (or a long-press tooltip) has to go on. */
  label: string;
  onClick: () => void;
}

/**
 * A circular "add" FAB pinned above the bottom nav.
 *
 * The students list runs to ~50 rows; with the add control at the END of that
 * list, adding someone meant scrolling the whole roster first. This stays put
 * at every scroll position, on the same left/bottom anchor as the record
 * screen's save FAB so the "primary action lives here" spot is consistent
 * across the app (left edge, thumb-reachable, clear of the fixed nav).
 *
 * Icon-only is acceptable here where it is not for saving: adding opens a form
 * that can be abandoned, so a mis-tap costs nothing.
 */
export function FloatingAddButton({ label, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      class="fixed z-30 left-4 w-14 h-14 rounded-full bg-forest text-parchment flex items-center justify-center shadow-[0_10px_28px_rgba(15,61,46,0.4)] active:scale-95 transition-transform motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mustard focus-visible:ring-offset-2"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
    >
      <svg
        viewBox="0 0 24 24"
        width="26"
        height="26"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
