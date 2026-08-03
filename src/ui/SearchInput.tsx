import { useRef } from 'preact/hooks';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Announced to screen readers, which never see the placeholder as a name. */
  label: string;
  /** Slightly smaller padding/icon, for search boxes that sit inside a card
   * rather than at the top of a screen. */
  compact?: boolean;
  class?: string;
}

/**
 * The app's search box: magnifier while empty, a clear (✕) button once there's
 * something to clear.
 *
 * Clearing a filter on a phone otherwise means holding backspace through a
 * whole name, and the log's search is the worst case — every keystroke there
 * re-queries Firestore, so backspacing out of "محمد" fires four more searches
 * on the way. The ✕ is one tap and a single state change.
 *
 * Focus returns to the field after clearing so the keyboard doesn't collapse
 * mid-thought when the teacher is about to type a different name.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  compact = false,
  class: className = '',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const iconSize = compact ? 15 : 17;

  return (
    <div class={'relative ' + className}>
      <input
        ref={inputRef}
        type="text"
        aria-label={label}
        class={
          'w-full border border-hairline rounded-xl text-sm text-ink-dark bg-white px-3.5 ' +
          (compact ? 'py-2.5 pr-9' : 'py-3 pr-10')
        }
        placeholder={placeholder}
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      />
      {value ? (
        <button
          type="button"
          aria-label="مسح البحث"
          class={
            'absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-taupe text-sm flex items-center justify-center ' +
            (compact ? 'right-2' : 'right-2.5')
          }
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
        >
          ✕
        </button>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width={iconSize}
          height={iconSize}
          fill="none"
          stroke="#8A8372"
          stroke-width="2"
          class={
            'absolute top-1/2 -translate-y-1/2 pointer-events-none ' +
            (compact ? 'right-3' : 'right-3.5')
          }
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      )}
    </div>
  );
}
