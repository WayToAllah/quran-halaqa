import { useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';

/**
 * The app bar's height, shared with everything pinned under it (the offline
 * banner, the stats card headers, the mosque list). It used to be a fixed 69px
 * typed into each of them, which broke as soon as the bar grew a second line;
 * now the bar measures itself into `--app-bar-h` and they read that, with 69px
 * as the fallback before the first measurement (and in tests).
 */
export const APP_BAR_FALLBACK = 69;
const VAR = '--app-bar-h';

/** Current bar height in px, for code that scrolls rather than styles. */
export function appBarHeight(): number {
  if (typeof document === 'undefined') return APP_BAR_FALLBACK;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(VAR));
  return Number.isFinite(v) && v > 0 ? v : APP_BAR_FALLBACK;
}

/** Keeps `--app-bar-h` equal to the element's rendered height. */
export function useAppBarHeight(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () =>
      root.style.setProperty(VAR, `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}
