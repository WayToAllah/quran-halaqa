import { useEffect, useMemo, useState } from 'preact/hooks';
import { getRecordsByDate, saveRecord } from '../data/records.repo';
import { republishPublicStatsFor } from '../data/publishStats';
import { getStudentName, studentHasRecordOnDate } from '../domain/students';
import { genId } from '../domain/ids';
import { MOSQUE_ID, HALAQA_ID } from '../config';
import type { SessionRecord, Student } from '../types';

/**
 * Group (checklist) attendance logic, shared between the record screen's
 * "حضور جماعي" tab. Takes `date` from the caller rather than managing its
 * own — the record screen has a single date picker shared by both individual
 * and group modes (matches the approved design: one date control at the top
 * of the screen, not a per-mode one).
 */
export function useGroupAttendance(date: string, students: Student[]) {
  const [dayRecords, setDayRecords] = useState<SessionRecord[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setDayRecords(null);
    setChecked(new Set());
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

  /** Returns true on success. Errors/empty-selection are reported via the
   * caller-supplied showToast so this hook stays UI-framework-agnostic about
   * *how* messages are shown, just not *whether* to show one. */
  async function handleSave(showToast: (msg: string, isError?: boolean) => void): Promise<boolean> {
    if (!date) {
      showToast('اختر التاريخ أولاً', true);
      return false;
    }
    const toSave = eligible.filter((s) => checked.has(s.id));
    if (!toSave.length) {
      showToast('اختر طالباً واحداً على الأقل', true);
      return false;
    }
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
      void republishPublicStatsFor(toSave.map((s) => s.id));
      // Refresh day coverage so the just-saved students immediately show as
      // "مسجّل بالفعل" instead of staying checkable until the next date change.
      const fresh = await getRecordsByDate(MOSQUE_ID, HALAQA_ID, date);
      setDayRecords(fresh);
      setChecked(new Set());
      return true;
    } catch (err) {
      console.error('saveGroupAttendance failed:', err);
      showToast('⚠️ فشل حفظ بعض السجلات — تأكد من الإنترنت', true);
      return false;
    }
  }

  return { dayRecords, sorted, eligible, checked, toggle, toggleAll, handleSave };
}
