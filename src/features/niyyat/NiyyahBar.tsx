import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { displayNiyyat } from '../../domain/niyyat';

interface Props {
  /** Raw niyyat from Firestore (may be empty → default verse shown). */
  niyyat: string[];
  /** Opens the management modal (the ✏️ icon). */
  onEdit: () => void;
  /** Seconds each niyyah stays before fading to the next. Default 4. */
  intervalSec?: number;
}

const FADE_MS = 450;

/**
 * The header's rotating intentions bar. Cycles through the niyyat list,
 * showing each for `intervalSec` seconds with a short cross-fade. Falls back to
 * the default verse when the list is empty. A single niyyah never animates
 * (nothing to rotate to). Honors `prefers-reduced-motion` by cutting instantly
 * instead of fading.
 */
export function NiyyahBar({ niyyat, onEdit, intervalSec = 4 }: Props) {
  const list = useMemo(() => displayNiyyat(niyyat), [niyyat]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Reset to the first niyyah whenever the underlying list changes (e.g. the
  // teacher saved edits), so we never index past the end of a shorter list.
  useEffect(() => {
    setIndex(0);
    setVisible(true);
  }, [list]);

  useEffect(() => {
    if (list.length <= 1) return; // nothing to rotate
    const holdMs = Math.max(1000, intervalSec * 1000);
    const tick = setInterval(() => {
      if (reduceMotion.current) {
        setIndex((i) => (i + 1) % list.length);
        return;
      }
      // fade out, swap, fade in
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % list.length);
        setVisible(true);
      }, FADE_MS);
    }, holdMs);
    return () => clearInterval(tick);
  }, [list, intervalSec]);

  const current = list[Math.min(index, list.length - 1)];

  return (
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <div class="min-w-0 flex-1 overflow-hidden">
        <div
          class="text-[14px] font-extrabold text-ink-dark leading-snug truncate transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
          title={current}
          aria-live="polite"
        >
          {current}
        </div>
      </div>
      <button
        type="button"
        class="w-7 h-7 shrink-0 rounded-full border border-hairline bg-white flex items-center justify-center text-[13px] text-taupe hover:text-forest hover:border-forest transition-colors"
        aria-label="تعديل النوايا"
        onClick={onEdit}
      >
        ✏️
      </button>
    </div>
  );
}
