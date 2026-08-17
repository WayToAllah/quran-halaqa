import { useEffect, useRef } from 'preact/hooks';
import { mushafLink, readMushafCount } from '../../domain/mushafLink';
import type { SuraAssignment } from '../../types';

interface Props {
  /** 'اللوح' or 'الماضي' — passed through to the viewer header. */
  label: string;
  /** The ward being recited: what the viewer opens on. */
  list: readonly SuraAssignment[];
  studentName: string;
  /** Distinguishes this open from any earlier one, so a stale message is dropped. */
  token: string;
  /** Number of mistakes the teacher tapped while the viewer was open. */
  onCount: (count: number) => void;
  onClose: () => void;
}

/**
 * The viewer is a standalone page under /mushaf/, not part of this bundle: it
 * carries its own fonts, page data and printed-page coordinates, and none of
 * that belongs in the app's chunk. It is embedded here rather than opened in a
 * tab so the teacher stays inside the session being recorded, and it hands the
 * count back over postMessage.
 */
export function MushafModal({ label, list, studentName, token, onCount, onClose }: Props) {
  const src = mushafLink(list, { name: studentName, ward: label, token });
  const closedRef = useRef(false);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // Only same-origin messages are ours; the viewer is served from this site.
      if (e.origin !== window.location.origin) return;
      const count = readMushafCount(e.data, token);
      if (count === null || closedRef.current) return;
      closedRef.current = true;
      onCount(count);
      onClose();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [token, onCount, onClose]);

  if (!src) return null;

  return (
    <div class="fixed inset-0 z-50 bg-[#FFF9F1] flex flex-col" dir="rtl">
      <div class="flex items-center gap-3 px-4 py-2 border-b border-hairline bg-white">
        <button
          type="button"
          class="text-2xl leading-none text-[#5B5646] px-1"
          aria-label="إغلاق المصحف"
          onClick={onClose}
        >
          &times;
        </button>
        <div class="min-w-0">
          <div class="font-extrabold text-ink-dark text-[13.5px] truncate">{studentName}</div>
          <div class="text-[11px] text-taupe truncate">{label}</div>
        </div>
      </div>
      <iframe title="المصحف" src={src} class="flex-1 w-full border-0" data-testid="mushaf-frame" />
    </div>
  );
}
