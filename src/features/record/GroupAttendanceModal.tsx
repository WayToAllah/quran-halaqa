import { useState } from 'preact/hooks';
import { getStudentName } from '../../domain/students';
import type { Student, SessionRecord } from '../../types';

interface Props {
  /** Formatted Hijri/Gregorian text for the session date the checklist covers.
   * The picker itself stays on the record screen — there is deliberately ONE
   * date control for the whole screen (see useGroupAttendance), so this is
   * shown read-only here just so the teacher can see which day they're
   * marking without closing the sheet. */
  dateDisplay: string;
  /** null while the day's existing records are still loading. */
  dayRecords: SessionRecord[] | null;
  sorted: Student[];
  eligible: Student[];
  checked: Set<string>;
  toggle: (id: string, isChecked: boolean) => void;
  toggleAll: () => void;
  /** Resolves true when the save succeeded — the sheet closes itself only
   * then, so a failed save (or an empty selection) leaves the teacher's
   * checklist intact instead of discarding it behind a closed sheet. */
  onSave: () => Promise<boolean>;
  onClose: () => void;
}

export function GroupAttendanceModal({
  dateDisplay,
  dayRecords,
  sorted,
  eligible,
  checked,
  toggle,
  toggleAll,
  onSave,
  onClose,
}: Props) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const ok = await onSave();
    setSaving(false);
    if (ok) onClose();
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
        role="dialog"
        aria-modal="true"
        aria-label="تسجيل حضور جماعي"
      >
        <div class="flex items-start justify-between px-5 py-4 border-b border-hairline">
          <div>
            <div class="font-bold text-ink-dark">✅ تسجيل حضور جماعي</div>
            <div class="text-xs text-taupe mt-0.5">{dateDisplay || '—'}</div>
          </div>
          <button class="text-taupe text-lg" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <div class="flex items-center justify-between px-5 pt-4 pb-2">
          <div class="text-xs text-taupe">{checked.size} محدد</div>
          <button type="button" class="text-xs font-bold text-forest" onClick={toggleAll}>
            تحديد الكل / إلغاء
          </button>
        </div>

        <div class="px-5 pb-2 overflow-y-auto flex-1">
          {dayRecords === null ? (
            <div class="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} class="h-10 rounded-lg bg-[#F1ECDD] animate-pulse" />
              ))}
            </div>
          ) : (
            <div class="divide-y divide-[#F5F1E5]">
              {sorted.map((s) => {
                const already = !eligible.some((e) => e.id === s.id);
                const isChecked = checked.has(s.id);
                return (
                  <label
                    key={s.id}
                    class={'flex items-center gap-3 py-2.5 ' + (already ? 'opacity-50' : '')}
                  >
                    <div class="w-[34px] h-[34px] rounded-full bg-[#F1ECDD] text-forest font-bold flex items-center justify-center text-xs shrink-0">
                      {getStudentName(s)
                        .trim()
                        .split(' ')
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join('')}
                    </div>
                    <span class="flex-1 text-[13.5px] font-semibold text-ink-dark">
                      {getStudentName(s)}
                    </span>
                    {already ? (
                      <span class="text-[11px] text-taupe shrink-0">مسجّل بالفعل</span>
                    ) : (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isChecked}
                        aria-label={getStudentName(s)}
                        class="w-[26px] h-[26px] rounded-lg border-[1.5px] flex items-center justify-center shrink-0"
                        style={
                          isChecked
                            ? { background: '#0F3D2E', borderColor: '#0F3D2E' }
                            : { background: '#FFFFFF', borderColor: '#D8D2C0' }
                        }
                        onClick={() => toggle(s.id, !isChecked)}
                      >
                        {isChecked && (
                          <svg
                            viewBox="0 0 24 24"
                            width="15"
                            height="15"
                            fill="none"
                            stroke="white"
                            stroke-width="3"
                          >
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                        )}
                      </button>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div class="flex gap-2.5 px-5 py-4 border-t border-hairline">
          <button
            type="button"
            class="flex-1 py-3 rounded-xl border border-hairline text-sm font-semibold text-[#5B5646]"
            onClick={onClose}
          >
            إلغاء
          </button>
          <button
            type="button"
            class="flex-1 py-3 rounded-xl bg-forest text-white text-sm font-bold disabled:opacity-60"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '… جاري الحفظ' : '✅ حفظ الحضور'}
          </button>
        </div>
      </div>
    </div>
  );
}
