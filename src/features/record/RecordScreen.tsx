import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStudents } from '../../hooks/useStudents';
import { usePreviousSession } from '../../hooks/usePreviousSession';
import { saveRecord } from '../../data/records.repo';
import { normAr } from '../../domain/text';
import { getStudentName } from '../../domain/students';
import { localDateStr, genId } from '../../domain';
import { scoreToStars } from '../../domain/scoring';
import { extractAssignedSuras, validateAyahRange } from '../../domain/record';
import { buildWhatsAppMessage, normalizeWhatsAppPhone } from '../../domain/whatsapp';
import { SuraRow } from './SuraRow';
import { GroupAttendanceModal } from './GroupAttendanceModal';
import { MistakeCounterModal } from './MistakeCounterModal';
import { WhatsAppModal } from './WhatsAppModal';
import { summarizeMistakes, rebuildMistakeHistory, type MistakeKind } from '../../domain/mistakes';
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

interface Props {
  /** When set, the screen opens in edit mode pre-filled with this record and
   * saving overwrites it (same id/studentId) instead of creating a new one. */
  editRecord?: SessionRecord | null;
  /** Called once the incoming editRecord has been consumed (so the parent can
   * clear it and a later tab switch doesn't re-trigger edit mode). */
  onEditConsumed?: () => void;
}

export function RecordScreen({ editRecord = null, onEditConsumed }: Props = {}) {
  const { students } = useStudents(MOSQUE_ID, HALAQA_ID);
  const { showToast } = useToast();

  const [date, setDate] = useState(localDateStr());
  const [studentQuery, setStudentQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  // When set, handleSave overwrites this record id instead of minting a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  // The record currently being edited (kept so the evaluation card can render
  // its loh/madi even when there's no live "previous session" to evaluate).
  const [editingRecordData, setEditingRecordData] = useState<SessionRecord | null>(null);

  const { prev: prevSession } = usePreviousSession(MOSQUE_ID, HALAQA_ID, selectedStudent);
  const [prevLohScore, setPrevLohScore] = useState('');
  const [prevMadiScore, setPrevMadiScore] = useState('');
  // Mistake-counter history per evaluation. Preserved so reopening the counter
  // shows the same taps; committed to the record's loh/madi.mistakes on save.
  const [lohMistakes, setLohMistakes] = useState<MistakeKind[]>([]);
  const [madiMistakes, setMadiMistakes] = useState<MistakeKind[]>([]);
  const [mistakeModal, setMistakeModal] = useState<'loh' | 'madi' | null>(null);

  const [lohRows, setLohRows] = useState<SuraAssignment[]>([emptyRow()]);
  const [madiRows, setMadiRows] = useState<SuraAssignment[]>([emptyRow()]);

  const [tajweedEnabled, setTajweedEnabled] = useState(false);
  const [tajweed, setTajweed] = useState<SuraAssignment>(emptyRow());
  const [tajweedStars, setTajweedStars] = useState(0);
  const [tajweedNote, setTajweedNote] = useState('');

  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showGroupAttendance, setShowGroupAttendance] = useState(false);
  const [whatsAppPreview, setWhatsAppPreview] = useState<{ message: string; phone: string } | null>(null);
  // Guards the edit-prefill effect so it fires once per distinct record id.
  const consumedEditIdRef = useRef<string | null>(null);

  const studentMatches = useMemo(() => {
    const q = studentQuery.trim();
    const list = q
      ? students.filter((s) => normAr(getStudentName(s)).includes(normAr(q)))
      : [...students].sort((a, b) => getStudentName(a).localeCompare(getStudentName(b), 'ar'));
    return list.slice(0, 30);
  }, [students, studentQuery]);

  // The session whose loh/madi assignment is being evaluated. Normally the
  // student's previous session; in edit mode it's the record itself, so the
  // evaluation fields (and their existing scores) still render.
  const evalSource = editingId ? editingRecordData : prevSession;
  const prevLohInfo = evalSource ? fmtSuraInfo(extractAssignedSuras(evalSource.newLoh, evalSource.loh)) : '—';
  const prevMadiList = evalSource ? extractAssignedSuras(evalSource.newMadi, evalSource.madi) : [];
  const prevMadiInfo = fmtSuraInfo(prevMadiList);

  function selectStudent(s: Student) {
    setSelectedStudent(s);
    setStudentQuery(getStudentName(s));
    setDropdownOpen(false);
    setPrevLohScore('');
    setPrevMadiScore('');
    setLohMistakes([]);
    setMadiMistakes([]);
  }

  function resetForm() {
    setSelectedStudent(null);
    setStudentQuery('');
    setEditingId(null);
    setEditingRecordData(null);
    setPrevLohScore('');
    setPrevMadiScore('');
    setLohMistakes([]);
    setMadiMistakes([]);
    setLohRows([emptyRow()]);
    setMadiRows([emptyRow()]);
    setTajweedEnabled(false);
    setTajweed(emptyRow());
    setTajweedStars(0);
    setTajweedNote('');
    setNote('');
    // Allow the same record to be re-opened for edit later (e.g. cancel then
    // tap ✏️ again on the same session).
    consumedEditIdRef.current = null;
    // date is deliberately NOT reset — matches the live app: the admin
    // usually records several students in a row for the same session date.
  }

  // Populate the form when the log screen hands us a record to edit. Guarded by
  // a ref so it runs exactly once per distinct record id — NOT re-run when the
  // students list arrives or changes (which would clobber the user's edits).
  useEffect(() => {
    if (!editRecord) return;
    if (consumedEditIdRef.current === editRecord.id) return;
    consumedEditIdRef.current = editRecord.id;
    const r = editRecord;
    setEditingId(r.id);
    setEditingRecordData(r);
    // Resolve the student via studentId so this stays correct even if the
    // student was renamed after the session was recorded; fall back to the
    // name snapshot on the record. If students haven't loaded yet, a separate
    // effect below fills selectedStudent in once they arrive.
    const student =
      students.find((s) => s.id === r.studentId) ??
      (r.student ? students.find((s) => getStudentName(s) === r.student) : undefined) ??
      null;
    setSelectedStudent(student);
    setStudentQuery(student ? getStudentName(student) : r.student ?? '');
    if (r.date) setDate(r.date);

    setPrevLohScore(r.loh?.score != null ? String(r.loh.score) : '');
    setPrevMadiScore(r.madi?.score != null ? String(r.madi.score) : '');
    // Restore the exact mistake tally if this session was recorded with the
    // counter; pre-feature records have no tally, so the counter starts empty.
    setLohMistakes(rebuildMistakeHistory(r.loh?.mistakes));
    setMadiMistakes(rebuildMistakeHistory(r.madi?.mistakes));

    const lohArr = (r.newLoh ?? []).filter((l) => l?.sura);
    setLohRows(lohArr.length ? lohArr.map((l) => ({ ...l })) : [emptyRow()]);
    const madiArr = (r.newMadi ?? []).filter((m) => m?.sura);
    setMadiRows(madiArr.length ? madiArr.map((m) => ({ ...m })) : [emptyRow()]);

    if (r.tajweed?.sura) {
      setTajweedEnabled(true);
      setTajweed({ sura: r.tajweed.sura, from: r.tajweed.from ?? '', to: r.tajweed.to ?? '' });
      setTajweedStars(r.tajweed.stars ?? 0);
      setTajweedNote(r.tajweed.note ?? '');
    } else {
      setTajweedEnabled(false);
      setTajweed(emptyRow());
      setTajweedStars(0);
      setTajweedNote('');
    }
    setNote(r.note ?? '');

    showToast('✏️ وضع التعديل');
    onEditConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRecord?.id]);

  // If we entered edit mode before the students list had loaded, the student
  // couldn't be resolved yet — link it up as soon as students arrive so the
  // evaluation card (which needs selectedStudent) appears.
  useEffect(() => {
    if (!editingId || selectedStudent || !editingRecordData) return;
    const r = editingRecordData;
    const student =
      students.find((s) => s.id === r.studentId) ??
      (r.student ? students.find((s) => getStudentName(s) === r.student) : undefined) ??
      null;
    if (student) {
      setSelectedStudent(student);
      setStudentQuery(getStudentName(student));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, editingId, selectedStudent, editingRecordData]);

  function cancelEdit() {
    resetForm();
    showToast('تم إلغاء التعديل');
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

    const isEditing = editingId !== null;
    const rec: SessionRecord = {
      // Overwrite the same document when editing so the session is corrected
      // in place rather than duplicated; keep the original studentId.
      id: editingId ?? genId('r'),
      studentId: selectedStudent.id,
      student: getStudentName(selectedStudent),
      date,
      loh: { score: lohScore, stars: lohScore == null ? 0 : scoreToStars(lohScore) },
      madi: { score: madiScore, stars: madiScore == null ? 0 : scoreToStars(madiScore) },
      newLoh: activeLohRows,
      newMadi: activeMadiRows,
      note: note.trim(),
    };
    // Attach the mistake tally only when the counter was actually used for
    // that evaluation — hand-typed scores stay free of an empty mistakes field
    // (matches mistakesSummary()'s null-on-empty contract in the live app).
    const lohTally = summarizeMistakes(lohMistakes);
    const madiTally = summarizeMistakes(madiMistakes);
    if (lohTally) rec.loh!.mistakes = lohTally;
    if (madiTally) rec.madi!.mistakes = madiTally;
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
      if (isEditing) {
        // An edit is a correction to an existing session, not a fresh
        // assignment — don't pop the WhatsApp "new homework" message.
        showToast('✓ تم تحديث الجلسة');
        resetForm();
      } else {
        showToast('✓ تم الحفظ بنجاح');
        const message = buildWhatsAppMessage(rec, prevSession, selectedStudent.parentToken);
        const phone = normalizeWhatsAppPhone(selectedStudent.phonePrimary);
        resetForm();
        setWhatsAppPreview({ message, phone });
      }
    } catch (err) {
      console.error('saveRecord failed:', err);
      showToast('⚠️ فشل الحفظ — تأكد من الإنترنت وحاول تاني', true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="p-4 space-y-4 pb-8" dir="rtl">
      {editingId && (
        <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-amber-800">✏️ تعديل جلسة محفوظة</span>
          <button class="text-xs font-semibold text-amber-700 underline" onClick={cancelEdit}>
            إلغاء
          </button>
        </div>
      )}
      <div class="bg-white rounded-2xl border border-neutral-200 p-4">
        <label class="text-xs font-semibold text-neutral-600 block mb-1">📅 تاريخ الجلسة</label>
        <input
          type="date"
          class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm"
          value={date}
          onInput={(e) => setDate((e.target as HTMLInputElement).value)}
        />
      </div>

      <button
        type="button"
        class="w-full py-3 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 text-sm font-bold"
        onClick={() => setShowGroupAttendance(true)}
      >
        ✅ تسجيل حضور جماعي
      </button>

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

      {selectedStudent && evalSource && (
        <div class="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
          <div class="font-bold text-neutral-900">📋 ما سمعناه النهارده</div>
          <div class="text-xs text-neutral-400">
            {editingId ? 'تقييم هذه الجلسة' : `من جلسة ${new Date(evalSource.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}`}
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
              <button
                type="button"
                class="mr-auto text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-2"
                onClick={() => setMistakeModal('loh')}
              >
                🧮 عدّاد الأخطاء
                {lohMistakes.length > 0 ? ` (${lohMistakes.length})` : ''}
              </button>
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
                <button
                  type="button"
                  class="mr-auto text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-2"
                  onClick={() => setMistakeModal('madi')}
                >
                  🧮 عدّاد الأخطاء
                  {madiMistakes.length > 0 ? ` (${madiMistakes.length})` : ''}
                </button>
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
        {saving ? '⏳ جاري الحفظ…' : editingId ? '💾 تحديث الجلسة' : '💾 حفظ الجلسة'}
      </button>

      {editingId && (
        <button
          type="button"
          class="w-full py-2.5 rounded-xl border border-neutral-300 text-neutral-600 text-sm font-semibold"
          onClick={cancelEdit}
        >
          إلغاء التعديل
        </button>
      )}

      {showGroupAttendance && (
        <GroupAttendanceModal
          initialDate={date}
          students={students}
          onClose={() => setShowGroupAttendance(false)}
        />
      )}

      {mistakeModal && (
        <MistakeCounterModal
          label={mistakeModal === 'loh' ? 'اللوح' : 'الماضي'}
          suraInfo={mistakeModal === 'loh' ? prevLohInfo : prevMadiInfo}
          initialHistory={mistakeModal === 'loh' ? lohMistakes : madiMistakes}
          onSave={(score, history) => {
            if (mistakeModal === 'loh') {
              setLohMistakes(history);
              setPrevLohScore(String(score));
            } else {
              setMadiMistakes(history);
              setPrevMadiScore(String(score));
            }
          }}
          onClose={() => setMistakeModal(null)}
        />
      )}

      {whatsAppPreview && (
        <WhatsAppModal
          message={whatsAppPreview.message}
          phone={whatsAppPreview.phone}
          onClose={() => setWhatsAppPreview(null)}
        />
      )}
    </div>
  );
}
