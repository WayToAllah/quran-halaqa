import { useState } from 'preact/hooks';
import {
  liveMistakeScore,
  committedMistakeScore,
  mistakeScoreColor,
  type MistakeKind,
} from '../../domain/mistakes';
import { scoreName } from '../../domain/scoring';

interface Props {
  /** 'اللوح' or 'الماضي' — shown in the title. */
  label: string;
  /** The sura/ayah line already displayed in "ما سمعناه النهارده", echoed here
   * so the teacher can see it without closing the counter. */
  suraInfo: string;
  /** Starting history — non-empty when reopening the counter on the same
   * evaluation (or editing a saved record) so the previous taps are preserved
   * rather than reset to zero. */
  initialHistory: MistakeKind[];
  /** Called with the committed (rounded) score and the full history when the
   * teacher taps "حفظ الدرجة". */
  onSave: (score: number, history: MistakeKind[]) => void;
  onClose: () => void;
}

export function MistakeCounterModal({ label, suraInfo, initialHistory, onSave, onClose }: Props) {
  const [history, setHistory] = useState<MistakeKind[]>([...initialHistory]);

  const full = history.filter((k) => k === 'full').length;
  const tajweed = history.filter((k) => k === 'tajweed').length;
  const liveScore = liveMistakeScore(history);
  const color = mistakeScoreColor(liveScore);
  const scoreText = liveScore % 1 === 0 ? String(liveScore) : liveScore.toFixed(1);

  function addMistake(kind: MistakeKind) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    setHistory((h) => [...h, kind]);
  }
  function undoLast() {
    setHistory((h) => h.slice(0, -1));
  }
  function resetAll() {
    setHistory([]);
  }
  function handleSave() {
    onSave(committedMistakeScore(history), history);
    onClose();
  }

  return (
    <div
      class="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        class="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div class="flex items-start justify-between px-5 py-4 border-b border-hairline">
          <div>
            <div class="font-bold text-ink-dark">عداد الأخطاء — تقييم {label}</div>
            <div class="text-xs text-taupe mt-0.5">{suraInfo || '—'}</div>
          </div>
          <button class="text-taupe text-lg" onClick={onClose}>
            ✕
          </button>
        </div>

        <div class="p-5 space-y-4 overflow-y-auto flex-1">
          <div class="text-center py-2">
            <div class="text-5xl font-extrabold leading-none tabular-nums" style={{ color }}>
              {scoreText}
            </div>
            <div class="text-sm font-bold mt-1.5" style={{ color }}>
              {scoreName(liveScore) || '—'}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              class="flex flex-col items-center gap-0.5 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold active:scale-95 transition-transform"
              onClick={() => addMistake('full')}
            >
              <span>➖ خطأ</span>
              <span class="text-xs font-medium opacity-70">−1 نقطة</span>
            </button>
            <button
              type="button"
              class="flex flex-col items-center gap-0.5 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-bold active:scale-95 transition-transform"
              onClick={() => addMistake('tajweed')}
            >
              <span>➖ خطأ تجويدي</span>
              <span class="text-xs font-medium opacity-70">−0.5 نقطة</span>
            </button>
          </div>

          <div class="flex items-center justify-center gap-6 text-sm text-[#5B5646]">
            <span>
              خطأ: <b class="text-ink-dark">{full}</b>
            </span>
            <span>
              خطأ تجويدي: <b class="text-ink-dark">{tajweed}</b>
            </span>
          </div>

          <div class="flex gap-2.5">
            <button
              type="button"
              class="flex-1 py-2.5 rounded-lg border border-hairline text-xs font-semibold text-[#5B5646] disabled:opacity-40"
              onClick={undoLast}
              disabled={history.length === 0}
            >
              ↩️ تراجع عن آخر خطأ
            </button>
            <button
              type="button"
              class="flex-1 py-2.5 rounded-lg border border-hairline text-xs font-semibold text-[#5B5646] disabled:opacity-40"
              onClick={resetAll}
              disabled={history.length === 0}
            >
              🔄 إعادة من الصفر
            </button>
          </div>
        </div>

        <div class="px-5 py-4 border-t border-hairline">
          <button
            type="button"
            class="w-full py-3 rounded-xl bg-forest text-parchment font-bold active:scale-[0.99] transition-transform"
            onClick={handleSave}
          >
            ✓ حفظ الدرجة
          </button>
        </div>
      </div>
    </div>
  );
}
