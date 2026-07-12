import { useEffect, useMemo, useState } from 'preact/hooks';
import { getRecordsByDate, saveRecord } from '../../data/records.repo';
import { republishPublicStatsFor } from '../../data/publishStats';
import { getStudentName, studentHasRecordOnDate } from '../../domain/students';
import { genId } from '../../domain/ids';
import { useToast } from '../../ui/ToastProvider';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
import type { SessionRecord, Student } from '../../types';

interface Props {
  initialDate: string;
  students: Student[];
  onClose: () => void;
}

export function GroupAttendanceModal({ initialDate, students, onClose }: Props) {
  const { showToast } = useToast();
  const [date, setDate] = useState(initialDate);
  const [dayRecords, setDayRecords] = useState<SessionRecord[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDayRecords(null);
    getRecordsByDate(MOSQUE_ID, HALAQA_ID, date)
      .then((recs) => {
        if (!cancelled) setDayRecords(recs);
      })
      .catch((err) => console.error('getRecordsByDate failed:', err));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const sorted = useMemo(
    () => [...students].sort((a, b) => getStudentName(a).localeCompare(getStudentName(b), 'ar')),
    [students],
  );

  const eligible = useMemo(() => {
    if (!dayRecords) return [];
    return sorted.filter((s) => !studentHasRecordOnDate(s, date, dayRecords));
  }, [sorted, dayRecords, date]);

  function toggle(id: string, isChecked: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (isChecked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll() {
    const allChecked = eligible.length > 0 && eligible.every((s) => checked.has(s.id));
    setChecked(allChecked ? new Set() : new Set(eligible.map((s) => s.id)));
  }

  async function handleSave() {
    if (!date) {
      showToast('اختر التاريخ أولاً', true);
      return;
    }
    const toSave = eligible.filter((s) => checked.has(s.id));
    if (!toSave.length) {
      showToast('اختر طالباً واحداً على الأقل', true);
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        toSave.map((s) =>
          saveRecord(MOSQUE_ID, HALAQA_ID, {
            id: genId('att'),
            studentId: s.id,
            student: getStudentName(s),
            date,
            attendance_only: true,
            note: '',
          }),
        ),
      );
      showToast(`✓ تم تسجيل حضور ${toSave.length} طالب`);
      // One batched recompute for everyone just checked in (fetches the halaqa
      // once, not per-student).
      void republishPublicStatsFor(toSave.map((s) => s.id));
      onClose();
    } catch (err) {
      console.error('saveGroupAttendance failed:', err);
      showToast('⚠️ فشل حفظ بعض السجلات — تأكد من الإنترنت', true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        class="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div class="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <span class="font-bold text-ink-dark">✅ تسجيل حضور جماعي</span>
          <button class="text-taupe text-lg" onClick={onClose}>
            ✕
          </button>
        </div>

        <div class="p-5 space-y-3 overflow-y-auto flex-1">
          <div>
            <label class="text-xs font-semibold text-[#5B5646] block mb-1">📅 التاريخ</label>
            <input
              type="date"
              class="w-full border border-hairline rounded-[11px] px-3 py-2.5 text-sm text-ink-dark"
              value={date}
              onInput={(e) => {
                setDate((e.target as HTMLInputElement).value);
                setChecked(new Set());
              }}
            />
          </div>

          <div class="flex items-center justify-between">
            <span class="text-xs text-taupe">{checked.size} محدد</span>
            <button type="button" class="text-xs font-bold text-forest" onClick={toggleAll}>
              تحديد الكل / إلغاء
            </button>
          </div>

          {dayRecords === null ? (
            <div class="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} class="h-10 rounded-lg bg-[#F1ECDD] animate-pulse" />
              ))}
            </div>
          ) : (
            <div class="max-h-[48vh] overflow-y-auto divide-y divide-hairline">
              {sorted.map((s) => {
                const already = studentHasRecordOnDate(s, date, dayRecords);
                return (
                  <label key={s.id} class={'flex items-center gap-3 py-2.5 ' + (already ? 'opacity-50' : '')}>
                    <input
                      type="checkbox"
                      class="w-5 h-5 shrink-0"
                      checked={checked.has(s.id)}
                      disabled={already}
                      onChange={(e) => toggle(s.id, (e.target as HTMLInputElement).checked)}
                    />
                    <span class="flex-1 text-sm">{getStudentName(s)}</span>
                    {already && <span class="text-[11px] text-taupe">مسجّل بالفعل</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div class="flex gap-3 px-5 py-4 border-t border-hairline">
          <button class="flex-1 py-2.5 rounded-lg border border-hairline text-sm font-semibold text-[#5B5646]" onClick={onClose}>
            إلغاء
          </button>
          <button
            class="flex-1 py-2.5 rounded-lg bg-forest text-parchment text-sm font-bold disabled:opacity-60"
            disabled={saving || dayRecords === null}
            onClick={handleSave}
          >
            {saving ? 'جاري الحفظ…' : '✅ حفظ الحضور'}
          </button>
        </div>
      </div>
    </div>
  );
}
