import { useMemo, useState } from 'preact/hooks';
import { useStudents } from '../../hooks/useStudents';
import { usePreviousSession } from '../../hooks/usePreviousSession';
import { saveRecord } from '../../data/records.repo';
import { normAr } from '../../domain/text';
import { getStudentName } from '../../domain/students';
import { localDateStr, genId } from '../../domain';
import { scoreToStars } from '../../domain/scoring';
import { extractAssignedSuras, validateAyahRange } from '../../domain/record';
import { SuraRow } from './SuraRow';
import { StarPicker } from '../../ui/StarPicker';
import { useToast } from '../../ui/ToastProvider';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
import type { SuraAssignment, SessionRecord, Student } from '../../types';

function fmtSuraInfo(list: SuraAssignment[]): string {
  if (!list.length) return '—';
  return list
    .map((l) => 'سورة ' + l.sura + (l.from && l.to ? ` (${l.from}–${l.to})` : l.from ? ` (من ${l.from})` : ''))
    .join(' + ');
}

/** Empty-string-preserving numeric field: distinguishes "nothing entered"
 * (null score, matching hasScore()'s contract) from a genuine zero. */
function readScoreField(raw: string): number | null {
  if (raw === '') return null;
  return Math.min(100, Math.max(0, parseInt(raw) || 0));
}

const emptyRow = (): SuraAssignment => ({ sura: '', from: '', to: '' });

export function RecordScreen() {
  const { students } = useStudents(MOSQUE_ID, HALAQA_ID);
  const { showToast } = useToast();

  const [date, setDate] = useState(localDateStr());
  const [studentQuery, setStudentQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const { prev: prevSession } = usePreviousSession(MOSQUE_ID, HALAQA_ID, selectedStudent);
  const [prevLohScore, setPrevLohScore] = useState('');
  const [prevMadiScore, setPrevMadiScore] = useState('');

  const [lohRows, setLohRows] = useState<SuraAssignment[]>([emptyRow()]);
  const [madiRows, setMadiRows] = useState<SuraAssignment[]>([emptyRow()]);

  const [tajweedEnabled, setTajweedEnabled] = useState(false);
  const [tajweed, setTajweed] = useState<SuraAssignment>(emptyRow());
  const [tajweedStars, setTajweedStars] = useState(0);
  const [tajweedNote, setTajweedNote] = useState('');

  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const studentMatches = useMemo(() => {
    const q = studentQuery.trim();
    const list = q
      ? students.filter((s) => normAr(getStudentName(s)).includes(normAr(q)))
      : [...students].sort((a, b) => getStudentName(a).localeCompare(getStudentName(b), 'ar'));
    return list.slice(0, 30);
  }, [students, studentQuery]);

  const prevLohInfo = prevSession ? fmtSuraInfo(extractAssignedSuras(prevSession.newLoh, prevSession.loh)) : '—';
  const prevMadiList = prevSession ? extractAssignedSuras(prevSession.newMadi, prevSession.madi) : [];
  const prevMadiInfo = fmtSuraInfo(prevMadiList);

  function selectStudent(s: Student) {
    setSelectedStudent(s);
    setStudentQuery(getStudentName(s));
    setDropdownOpen(false);
    setPrevLohScore('');
    setPrevMadiScore('');
  }

  function resetForm() {
    setSelectedStudent(null);
    setStudentQuery('');
    setPrevLohScore('');
    setPrevMadiScore('');
    setLohRows([emptyRow()]);
    setMadiRows([emptyRow()]);
    setTajweedEnabled(false);
    setTajweed(emptyRow());
    setTajweedStars(0);
    setTajweedNote('');
    setNote('');
    // date is deliberately NOT reset — matches the live app: the admin
    // usually records several students in a row for the same session date.
  }

  async function handleSave() {
    if (saving) return; // guards against a double-tap creating two sessions
    if (!selectedStudent) {
      showToast('اختر طالباً أولاً', true);
      return;
    }

    const activeLohRows = lohRows.filter((r) => r.sura);
    const activeMadiRows = madiRows.filter((r) => r.sura);
    const rowErrors = [...activeLohRows, ...activeMadiRows, ...(tajweedEnabled ? [tajweed] : [])].some((r) => {
      const e = validateAyahRange(r.sura || '', r.from || '', r.to || '');
      return e.fromError || e.toError;
    });
    if (rowErrors) {
      showToast('يوجد خطأ في أرقام الآيات — راجع الحقول الحمراء', true);
      return;
    }

    const lohScore = readScoreField(prevLohScore);
    const madiScore = readScoreField(prevMadiScore);

    const rec: SessionRecord = {
      id: genId('r'),
      studentId: selectedStudent.id,
      student: getStudentName(selectedStudent),
      date,
      loh: { score: lohScore, stars: lohScore == null ? 0 : scoreToStars(lohScore) },
      madi: { score: madiScore, stars: madiScore == null ? 0 : scoreToStars(madiScore) },
      newLoh: activeLohRows,
      newMadi: activeMadiRows,
      note: note.trim(),
    };
    if (tajweedEnabled && tajweed.sura) {
      rec.tajweed = { sura: tajweed.sura, from: tajweed.from, to: tajweed.to, stars: tajweedStars, note: tajweedNote.trim() };
    }

    const hasContent =
      rec.newLoh!.length > 0 || rec.newMadi!.length > 0 || !!rec.tajweed || lohScore != null || madiScore != null || !!rec.note;
    if (!hasContent && !confirm('الجلسة فارغة تماماً (بدون لوح أو ماضي أو تقييم أو ملاحظة). تريد الحفظ برضه؟')) {
      return;
    }

    setSaving(true);
    try {
      await saveRecord(MOSQUE_ID, HALAQA_ID, rec);
      showToast('✓ تم الحفظ بنجاح');
      resetForm();
    } catch (err) {
      console.error('saveRecord failed:', err);
      showToast('⚠️ فشل الحفظ — تأكد من الإنترنت وحاول تاني', true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="p-4 space-y-4 pb-8" dir="rtl">
      <div class="bg-white rounded-2xl border border-neutral-200 p-4">
        <label class="text-xs font-semibold text-neutral-600 block mb-1">📅 تاريخ الجلسة</label>
        <input
          type="date"
          class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm"
          value={date}
          onInput={(e) => setDate((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="bg-white rounded-2xl border border-neutral-200 p-4 relative">
        <label class="text-xs font-semibold text-neutral-600 block mb-1">الطالب</label>
        <input
          type="text"
          class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm"
          placeholder="اكتب اسم الطالب..."
          value={studentQuery}
          onInput={(e) => {
            setStudentQuery((e.target as HTMLInputElement).value);
            setDropdownOpen(true);
            if (selectedStudent) setSelectedStudent(null);
          }}
          onFocus={() => setDropdownOpen(true)}
        />
        {dropdownOpen && (
          <div class="absolute z-10 inset-x-4 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {studentMatches.length === 0 && <div class="p-3 text-xs text-neutral-400">لا يوجد نتائج</div>}
            {studentMatches.map((s) => (
              <button
                key={s.id}
                type="button"
                class="w-full text-right px-3 py-2 text-sm hover:bg-neutral-50"
                onMouseDown={() => selectStudent(s)}
              >
                {getStudentName(s)}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedStudent && prevSession && (
        <div class="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
          <div class="font-bold text-neutral-900">📋 ما سمعناه النهارده</div>
          <div class="text-xs text-neutral-400">
            من جلسة {new Date(prevSession.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}
          </div>

          <div>
            <div class="text-xs font-semibold text-neutral-500 mb-1">اللوح</div>
            <div class="text-sm mb-2">{prevLohInfo}</div>
            <label class="text-xs text-neutral-500">التقييم (من 100)</label>
            <div class="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="مثلاً 90"
                class="w-20 text-center font-bold text-lg border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg py-2"
                value={prevLohScore}
                onInput={(e) => setPrevLohScore((e.target as HTMLInputElement).value)}
              />
              <span class="text-xs text-neutral-400">{prevLohScore === '' ? '—' : `${prevLohScore}/100`}</span>
            </div>
          </div>

          {prevMadiList.length > 0 && (
            <div class="pt-3 border-t border-neutral-100">
              <div class="text-xs font-semibold text-neutral-500 mb-1">الماضي</div>
              <div class="text-sm mb-2">{prevMadiInfo}</div>
              <label class="text-xs text-neutral-500">التقييم (من 100)</label>
              <div class="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="مثلاً 85"
                  class="w-20 text-center font-bold text-lg border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg py-2"
                  value={prevMadiScore}
                  onInput={(e) => setPrevMadiScore((e.target as HTMLInputElement).value)}
                />
                <span class="text-xs text-neutral-400">{prevMadiScore === '' ? '—' : `${prevMadiScore}/100`}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div class="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
        <div class="font-bold text-neutral-900">📝 المهمة الجديدة — اللوح</div>
        {lohRows.map((row, i) => (
          <SuraRow
            key={i}
            label={i === 0 ? 'السورة الأولى' : `سورة ${i + 1}`}
            value={row}
            onChange={(v) => setLohRows((rows) => rows.map((r, idx) => (idx === i ? v : r)))}
            onRemove={i > 0 ? () => setLohRows((rows) => rows.filter((_, idx) => idx !== i)) : undefined}
          />
        ))}
        <button
          type="button"
          class="w-full py-2 rounded-lg border border-dashed border-neutral-300 text-sm text-neutral-500"
          onClick={() => setLohRows((rows) => [...rows, emptyRow()])}
        >
          + إضافة سورة
        </button>
      </div>

      <div class="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
        <div class="font-bold text-neutral-900">📝 المهمة الجديدة — الماضي</div>
        {madiRows.map((row, i) => (
          <SuraRow
            key={i}
            label={i === 0 ? 'السورة الأولى' : `سورة ${i + 1}`}
            value={row}
            onChange={(v) => setMadiRows((rows) => rows.map((r, idx) => (idx === i ? v : r)))}
            onRemove={i > 0 ? () => setMadiRows((rows) => rows.filter((_, idx) => idx !== i)) : undefined}
          />
        ))}
        <button
          type="button"
          class="w-full py-2 rounded-lg border border-dashed border-neutral-300 text-sm text-neutral-500"
          onClick={() => setMadiRows((rows) => [...rows, emptyRow()])}
        >
          + إضافة سورة
        </button>
      </div>

      <div class="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
        <label class="flex items-center justify-between">
          <span class="font-bold text-neutral-900">مراجعة التجويد</span>
          <input
            type="checkbox"
            checked={tajweedEnabled}
            onChange={(e) => setTajweedEnabled((e.target as HTMLInputElement).checked)}
          />
        </label>
        {tajweedEnabled && (
          <div class="space-y-3">
            <SuraRow label="سورة التجويد" value={tajweed} onChange={setTajweed} />
            <div>
              <label class="text-xs text-neutral-500 block mb-1">التقييم</label>
              <StarPicker value={tajweedStars} onChange={setTajweedStars} />
            </div>
            <div>
              <label class="text-xs text-neutral-500 block mb-1">ملاحظة</label>
              <input
                type="text"
                class="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                placeholder="اختيارية"
                value={tajweedNote}
                onInput={(e) => setTajweedNote((e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
        )}
      </div>

      <div class="bg-white rounded-2xl border border-neutral-200 p-4">
        <label class="text-xs font-semibold text-neutral-600 block mb-1">ملاحظة عامة</label>
        <textarea
          class="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
          rows={2}
          placeholder="اختيارية"
          value={note}
          onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
        />
      </div>

      <button
        type="button"
        class="w-full py-3.5 rounded-xl bg-emerald-700 text-white font-bold shadow-lg disabled:opacity-60"
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? '⏳ جاري الحفظ…' : '💾 حفظ الجلسة'}
      </button>
    </div>
  );
}
