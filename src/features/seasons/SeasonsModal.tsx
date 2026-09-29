import { useState } from 'preact/hooks';
import {
  makeSeason,
  sortSeasons,
  suggestInitialSeasons,
  validateSeasons,
  type Season,
} from '../../domain/seasons';
import { useToast } from '../../ui/ToastProvider';

interface Props {
  seasons: Season[];
  /** Every record date in the halaqa — seeds the first-time suggestion. */
  recordDates: string[];
  /** 'YYYY-MM-DD', local. */
  today: string;
  onSave: (list: Season[]) => Promise<void>;
  onClose: () => void;
}

/**
 * Open, rename or re-date seasons. Nothing about a record changes: a season
 * is only a start date, so saving here just re-files the history by date.
 *
 * The first time (no seasons yet) the editor opens pre-filled: the history so
 * far as one named season, and a new one starting today — so starting a new
 * season is a single tap on حفظ.
 */
const QUOTA_LABELS: Record<number, string> = {
  1: 'يوم واحد',
  2: 'يومين',
  3: '٣ أيام',
  4: '٤ أيام',
  5: '٥ أيام',
  6: '٦ أيام',
  7: '٧ أيام',
};

export function SeasonsModal({ seasons, recordDates, today, onSave, onClose }: Props) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Season[]>(() =>
    seasons.length ? sortSeasons(seasons) : suggestInitialSeasons(recordDates, today),
  );
  const [saving, setSaving] = useState(false);
  const error = validateSeasons(rows);

  function setRow(i: number, patch: Partial<Season>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function handleSave() {
    if (error) return;
    setSaving(true);
    try {
      await onSave(sortSeasons(rows));
      showToast('✓ تم حفظ المواسم');
      onClose();
    } catch {
      showToast('⚠️ فشل الحفظ — تأكد من الإنترنت وحاول تاني', true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      class="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        class="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="المواسم"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-hairline sticky top-0 bg-white">
          <div>
            <div class="text-base font-extrabold text-ink-dark">المواسم</div>
            <div class="text-[11px] text-taupe mt-0.5 leading-relaxed">
              كل موسم بيبدأ من تاريخه ويخلص لما اللي بعده يبدأ. الأرقام بتبدأ من صفر في كل موسم،
              والبيانات القديمة ما بتتمسحش.
            </div>
          </div>
          <button class="text-taupe text-lg" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <div class="p-5 space-y-2.5">
          {rows.map((row, i) => (
            <div class="space-y-2 pb-2.5 border-b border-hairline last:border-0" key={row.id}>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  dir="rtl"
                  placeholder="اسم الموسم"
                  aria-label="اسم الموسم"
                  class="flex-1 min-w-0 border border-hairline rounded-xl px-3 py-2.5 text-sm text-ink-dark"
                  value={row.name}
                  onInput={(e) => setRow(i, { name: (e.target as HTMLInputElement).value })}
                />
                <input
                  type="date"
                  aria-label="بداية الموسم"
                  class="w-[9.5rem] shrink-0 border border-hairline rounded-xl px-2 py-2.5 text-[13px] text-ink-dark"
                  value={row.from}
                  onInput={(e) => setRow(i, { from: (e.target as HTMLInputElement).value })}
                />
                <button
                  type="button"
                  class="w-9 h-9 shrink-0 border border-hairline bg-white rounded-[10px] flex items-center justify-center"
                  onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                  aria-label="حذف الموسم"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="none"
                    stroke="#B24A3A"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  >
                    <path d="M5 6.5h14M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7M7 6.5l.8 12.7a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.7" />
                  </svg>
                </button>
              </div>
              <label class="flex items-center gap-2 text-[12.5px] text-[#5B5646] font-semibold">
                <span class="shrink-0">الحضور المطلوب:</span>
                <select
                  aria-label="أيام الحضور في الأسبوع"
                  class="flex-1 min-w-0 border border-hairline rounded-xl px-2.5 py-2 text-[13px] text-ink-dark bg-white"
                  value={row.daysPerWeek ? String(row.daysPerWeek) : ''}
                  onChange={(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    setRow(i, { daysPerWeek: v ? Number(v) : undefined });
                  }}
                >
                  <option value="">كل أيام الحلقة</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={String(n)}>
                      {QUOTA_LABELS[n]} في الأسبوع
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}

          <button
            type="button"
            class="w-full py-2.5 rounded-xl border border-dashed border-hairline text-sm font-semibold text-forest"
            onClick={() => setRows((r) => [...r, makeSeason('', today)])}
          >
            + موسم جديد
          </button>

          {rows.length > 0 && (
            <div class="text-[11px] text-taupe bg-parchment rounded-xl px-3 py-2.5 leading-relaxed">
              أول موسم بيشمل كمان أي تسجيل قبل تاريخه.
              <br />
              «يوم في الأسبوع» يعني أي يوم يحضره يحسب، والأيام الزيادة بتظهر جنب النسبة من غير ما
              تعلّيها.
            </div>
          )}
          {error && rows.length > 0 && (
            <div class="text-[12px] font-semibold text-[#B24A3A]" role="alert">
              {error}
            </div>
          )}
        </div>

        <div class="flex gap-2 p-5 pt-0">
          <button
            class="flex-1 py-2.5 rounded-xl border border-hairline text-sm font-semibold text-[#5B5646]"
            onClick={onClose}
          >
            إلغاء
          </button>
          <button
            class="flex-1 py-2.5 rounded-xl bg-forest text-parchment text-sm font-bold disabled:opacity-60"
            onClick={handleSave}
            disabled={saving || !!error}
          >
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}
