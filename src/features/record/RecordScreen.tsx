import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStudents } from '../../hooks/useStudents';
import { usePreviousSession } from '../../hooks/usePreviousSession';
import { saveRecord } from '../../data/records.repo';
import { republishPublicStatsFor } from '../../data/publishStats';
import { normAr } from '../../domain/text';
import { getStudentName } from '../../domain/students';
import { localDateStr, genId, hijriLong } from '../../domain';
import { scoreToStars, scoreName } from '../../domain/scoring';
import { extractAssignedSuras, validateAyahRange, isRowComplete, cleanAssignmentRow } from '../../domain/record';
import { computeNextLoh, computeNextMadi } from '../../domain/nextTask';
import { buildWhatsAppMessage, normalizeWhatsAppPhone } from '../../domain/whatsapp';
import { SuraRow } from './SuraRow';
import { FloatingSaveButton } from './FloatingSaveButton';
import { useGroupAttendance } from '../../hooks/useGroupAttendance';
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

/** Tier badge colors ported from the approved design, keyed by the real
 * scoreName() bands (85/75/65/50 — see domain/scoring.ts), not re-derived. */
const TIER_COLORS: Record<string, { bg: string; color: string }> = {
  'ممتاز': { bg: '#E7F2EC', color: '#0F3D2E' },
  'جيد جداً': { bg: '#EFF6E8', color: '#3E6B22' },
  'جيد': { bg: '#FFF8E6', color: '#8A6A15' },
  'مقبول': { bg: '#FBEEE3', color: '#9A5A24' },
  'إعادة': { bg: '#FBEAE7', color: '#B24A3A' },
};
function tierBadge(score: string): { label: string; bg: string; color: string } | null {
  if (score === '') return null;
  const label = scoreName(readScoreField(score));
  const c = TIER_COLORS[label] ?? { bg: '#F1ECDD', color: '#5B5646' };
  return { label, ...c };
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
  const [mode, setMode] = useState<'individual' | 'group'>('individual');
  const groupAttendance = useGroupAttendance(date, students);
  const [groupSaving, setGroupSaving] = useState(false);
  // A session that's been reviewed-but-not-yet-saved: the WhatsApp confirm modal
  // is showing its summary, and the save fires only on explicit confirm.
  const [pendingSave, setPendingSave] = useState<{
    rec: SessionRecord;
    message: string;
    phone: string;
    isEditing: boolean;
    studentId: string;
  } | null>(null);
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

  const lohTier = tierBadge(prevLohScore);
  const madiTier = tierBadge(prevMadiScore);

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
    setMode('individual');
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

  // Auto-fill the NEW assignment from the student's last session — suggests
  // where to continue (same sura from the next ayah, or the next sura from ayah
  // 1), matching the live app. Runs once per student, only on a fresh pick (not
  // in edit mode), and only when there's a previous session. Everything it
  // fills is an editable suggestion. Guarded by a ref so a background sync of
  // prevSession never re-clobbers rows the teacher has started editing.
  const autofilledForRef = useRef<string | null>(null);
  useEffect(() => {
    if (editingId) return; // never overwrite an edit-in-progress
    if (!selectedStudent || !prevSession) return;
    if (autofilledForRef.current === selectedStudent.id) return;
    autofilledForRef.current = selectedStudent.id;

    const nextLoh = computeNextLoh(prevSession.newLoh);
    const nextMadi = computeNextMadi(prevSession.newMadi);
    if (!nextLoh && !nextMadi) return; // nothing sensible to suggest

    if (nextLoh) setLohRows([{ ...nextLoh }]);
    if (nextMadi) setMadiRows([{ ...nextMadi }]);
    showToast('📝 تعبئة تلقائية بناءً على آخر جلسة — عدّلها زيّ ما تحب');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudent?.id, prevSession, editingId]);

  // Reset the autofill guard when the student is cleared, so re-picking the
  // same student later re-suggests.
  useEffect(() => {
    if (!selectedStudent) autofilledForRef.current = null;
  }, [selectedStudent]);

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

    const activeLohRows = lohRows.filter(isRowComplete).map(cleanAssignmentRow);
    const activeMadiRows = madiRows.filter(isRowComplete).map(cleanAssignmentRow);
    // Ayah-range validation applies only to per-sura rows; whole-sura range
    // rows carry no ayah numbers, so skip them here.
    const rowErrors = [...activeLohRows, ...activeMadiRows, ...(tajweedEnabled ? [tajweed] : [])].some((r) => {
      if (r.range) return false;
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

    // Preview-before-save: show the WhatsApp summary as the confirmation step so
    // the teacher reviews exactly what the parent will see BEFORE anything is
    // written. Nothing is saved here — the actual save happens only when they
    // confirm in the modal (or they go back and keep editing). This is why the
    // summary doubles as the teacher's own review of the session.
    const message = buildWhatsAppMessage(rec, prevSession, selectedStudent.parentToken);
    const phone = normalizeWhatsAppPhone(selectedStudent.phonePrimary);
    setPendingSave({ rec, message, phone, isEditing, studentId: selectedStudent.id });
  }

  // Commits the reviewed session. Called from the confirm modal; `send` decides
  // whether to open WhatsApp afterward. Only here does anything hit Firestore.
  async function commitPendingSave(send: boolean) {
    if (!pendingSave || saving) return;
    const { rec, message, phone, isEditing, studentId } = pendingSave;
    setSaving(true);
    try {
      await saveRecord(MOSQUE_ID, HALAQA_ID, rec);
      showToast(isEditing ? '✓ تم تحديث الجلسة' : '✓ تم الحفظ بنجاح');
      // Refresh the parent-facing projection immediately (fire-and-forget; a
      // failure here must not block the save that already succeeded).
      void republishPublicStatsFor([studentId]);
      setPendingSave(null);
      resetForm();
      if (send && phone) {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
      }
    } catch (err) {
      console.error('saveRecord failed:', err);
      showToast('⚠️ فشل الحفظ — تأكد من الإنترنت وحاول تاني', true);
    } finally {
      setSaving(false);
    }
  }

  const cardCls = 'bg-white border border-hairline rounded-2xl p-[18px]';

  return (
    <div class="p-[18px] pb-[150px] space-y-3" dir="rtl">
      <div class="text-[19px] font-extrabold text-ink-dark mb-1">تسجيل جلسة</div>

      {editingId && (
        <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-amber-800">✏️ تعديل جلسة محفوظة</span>
          <button class="text-xs font-semibold text-amber-700 underline" onClick={cancelEdit}>
            إلغاء
          </button>
        </div>
      )}

      <div class={cardCls + ' flex items-center justify-between gap-2.5'}>
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0F3D2E" stroke-width="1.8" class="shrink-0">
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
          </svg>
          <div class="flex-1 min-w-0">
            <input
              type="date"
              class="w-full text-sm font-semibold text-ink-dark bg-transparent border-none outline-none"
              value={date}
              onInput={(e) => setDate((e.target as HTMLInputElement).value)}
            />
            {date && hijriLong(date) && (
              <div class="text-[12px] text-[#0F3D2E] font-bold mt-0.5">{hijriLong(date)}</div>
            )}
          </div>
        </div>
      </div>

      <div class="flex bg-[#F1ECDD] rounded-xl p-1">
        <button
          type="button"
          class="flex-1 py-2.5 rounded-[9px] text-[13px] font-bold transition-colors"
          style={
            mode === 'individual'
              ? { background: '#FFFFFF', color: '#0F3D2E', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
              : { background: 'transparent', color: '#8A8372' }
          }
          onClick={() => setMode('individual')}
        >
          تسجيل فردي
        </button>
        <button
          type="button"
          class="flex-1 py-2.5 rounded-[9px] text-[13px] font-bold transition-colors"
          style={
            mode === 'group'
              ? { background: '#FFFFFF', color: '#0F3D2E', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
              : { background: 'transparent', color: '#8A8372' }
          }
          onClick={() => setMode('group')}
        >
          حضور جماعي
        </button>
      </div>

      {mode === 'group' && (
        <div class={cardCls}>
          <div class="flex items-center justify-between mb-3.5">
            <div class="text-[13px] font-bold text-ink-dark">
              حضور اليوم — {groupAttendance.sorted.length} طالب
            </div>
            <button type="button" class="text-xs font-bold text-forest" onClick={groupAttendance.toggleAll}>
              تحديد الكل / إلغاء
            </button>
          </div>
          <div class="text-xs text-taupe mb-3">{groupAttendance.checked.size} محدد</div>

          {groupAttendance.dayRecords === null ? (
            <div class="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} class="h-10 rounded-lg bg-[#F1ECDD] animate-pulse" />
              ))}
            </div>
          ) : (
            <div class="divide-y divide-[#F5F1E5]">
              {groupAttendance.sorted.map((s) => {
                const already = !groupAttendance.eligible.some((e) => e.id === s.id);
                const isChecked = groupAttendance.checked.has(s.id);
                return (
                  <label
                    key={s.id}
                    class={'flex items-center gap-3 py-2.5 ' + (already ? 'opacity-50' : '')}
                  >
                    <div class="w-[34px] h-[34px] rounded-full bg-[#F1ECDD] text-forest font-bold flex items-center justify-center text-xs shrink-0">
                      {getStudentName(s).trim().split(' ').slice(0, 2).map((w) => w[0]).join('')}
                    </div>
                    <span class="flex-1 text-[13.5px] font-semibold text-ink-dark">{getStudentName(s)}</span>
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
                        onClick={() => groupAttendance.toggle(s.id, !isChecked)}
                      >
                        {isChecked && (
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="white" stroke-width="3">
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
      )}

      {mode === 'individual' && (
        <>
        <div class={cardCls + ' relative'}>
        <label class="text-xs font-semibold text-[#5B5646] block mb-2">الطالب</label>
        <div class="relative">
          <input
            type="text"
            class="w-full border border-hairline rounded-xl px-3.5 py-3 pr-10 text-sm text-ink-dark"
            placeholder="ابحث أو اختر اسم الطالب…"
            value={studentQuery}
            onInput={(e) => {
              setStudentQuery((e.target as HTMLInputElement).value);
              setDropdownOpen(true);
              if (selectedStudent) setSelectedStudent(null);
            }}
            onFocus={() => setDropdownOpen(true)}
          />
          <svg
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill="none"
            stroke="#8A8372"
            stroke-width="2"
            class="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </div>
        {dropdownOpen && (
          <div class="absolute z-10 inset-x-[18px] top-full mt-1 bg-white border border-hairline rounded-xl shadow-lg max-h-56 overflow-y-auto">
            {studentMatches.length === 0 && <div class="p-3 text-xs text-taupe">لا يوجد نتائج</div>}
            {studentMatches.map((s) => (
              <button
                key={s.id}
                type="button"
                class="w-full text-right px-3.5 py-2.5 text-sm hover:bg-parchment"
                onMouseDown={() => selectStudent(s)}
              >
                {getStudentName(s)}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedStudent && evalSource && (
        <div class={cardCls + ' space-y-3.5'}>
          <div>
            <div class="font-extrabold text-ink-dark text-[13.5px]">📋 ما سمعناه النهارده</div>
            <div class="text-[11px] text-taupe mt-0.5">
              {editingId
                ? 'تقييم هذه الجلسة'
                : `من جلسة ${hijriLong(evalSource.date) ? hijriLong(evalSource.date) + ' — ' : ''}${new Date(evalSource.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}`}
            </div>
          </div>

          <div>
            <div class="text-xs font-semibold text-[#5B5646] mb-1">اللوح</div>
            <div class="text-sm mb-2 text-ink-dark">{prevLohInfo}</div>
            <label class="text-xs text-taupe">التقييم (من 100)</label>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="مثلاً 90"
                class="w-20 text-center font-extrabold text-lg border border-mustard/50 bg-[#FFFCF3] text-forest rounded-xl py-2"
                value={prevLohScore}
                onInput={(e) => setPrevLohScore((e.target as HTMLInputElement).value)}
              />
              {lohTier && (
                <span
                  class="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: lohTier.bg, color: lohTier.color }}
                >
                  {lohTier.label}
                </span>
              )}
              <button
                type="button"
                class="mr-auto text-xs font-semibold text-forest border border-forest/20 rounded-lg px-2.5 py-2"
                onClick={() => setMistakeModal('loh')}
              >
                🧮 عدّاد الأخطاء
                {lohMistakes.length > 0 ? ` (${lohMistakes.length})` : ''}
              </button>
            </div>
          </div>

          {prevMadiList.length > 0 && (
            <div class="pt-3.5 border-t border-hairline">
              <div class="text-xs font-semibold text-[#5B5646] mb-1">الماضي</div>
              <div class="text-sm mb-2 text-ink-dark">{prevMadiInfo}</div>
              <label class="text-xs text-taupe">التقييم (من 100)</label>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="مثلاً 85"
                  class="w-20 text-center font-extrabold text-lg border border-mustard/50 bg-[#FFFCF3] text-forest rounded-xl py-2"
                  value={prevMadiScore}
                  onInput={(e) => setPrevMadiScore((e.target as HTMLInputElement).value)}
                />
                {madiTier && (
                  <span
                    class="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: madiTier.bg, color: madiTier.color }}
                  >
                    {madiTier.label}
                  </span>
                )}
                <button
                  type="button"
                  class="mr-auto text-xs font-semibold text-forest border border-forest/20 rounded-lg px-2.5 py-2"
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

      <div class={cardCls}>
        <div class="flex items-center gap-2 mb-3.5">
          <div class="w-2 h-2 rounded-full bg-forest" />
          <div class="text-[13.5px] font-extrabold text-ink-dark">اللوح الجديد</div>
        </div>
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
          class="w-full py-2.5 rounded-[11px] border-[1.5px] border-dashed border-mustard bg-[#FFFCF3] text-[#8A6A15] text-[13px] font-bold"
          onClick={() => setLohRows((rows) => [...rows, emptyRow()])}
        >
          + إضافة سورة
        </button>
      </div>

      <div class={cardCls}>
        <div class="flex items-center gap-2 mb-3.5">
          <div class="w-2 h-2 rounded-full bg-mustard" />
          <div class="text-[13.5px] font-extrabold text-ink-dark">مراجعة الماضي</div>
        </div>
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
          class="w-full py-2.5 rounded-[11px] border-[1.5px] border-dashed border-mustard bg-[#FFFCF3] text-[#8A6A15] text-[13px] font-bold"
          onClick={() => setMadiRows((rows) => [...rows, emptyRow()])}
        >
          + إضافة سورة
        </button>
      </div>

      <div class={cardCls + ' space-y-3'}>
        <label class="flex items-center justify-between">
          <div>
            <div class="text-[13.5px] font-bold text-ink-dark">تسجيل ملاحظات التجويد</div>
            <div class="text-[11.5px] text-taupe mt-0.5">اختياري — لتتبع أخطاء التجويد الشائعة</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={tajweedEnabled}
            class="w-[46px] h-[26px] rounded-full relative shrink-0 transition-colors"
            style={{ background: tajweedEnabled ? '#0F3D2E' : '#E7E1D3' }}
            onClick={() => setTajweedEnabled((v) => !v)}
          >
            <span
              class="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-all"
              style={{ right: tajweedEnabled ? '23px' : '3px' }}
            />
          </button>
        </label>
        {tajweedEnabled && (
          <div class="space-y-3 pt-1">
            <SuraRow label="سورة التجويد" value={tajweed} onChange={setTajweed} />
            <div>
              <label class="text-xs text-taupe block mb-1">التقييم</label>
              <StarPicker value={tajweedStars} onChange={setTajweedStars} />
            </div>
            <div>
              <label class="text-xs text-taupe block mb-1">ملاحظة</label>
              <input
                type="text"
                class="w-full border border-hairline rounded-[11px] px-3.5 py-2.5 text-sm text-ink-dark"
                placeholder="اختيارية"
                value={tajweedNote}
                onInput={(e) => setTajweedNote((e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
        )}
      </div>

      <div class={cardCls}>
        <label class="text-xs font-semibold text-[#5B5646] block mb-2">ملاحظة (اختياري)</label>
        <textarea
          class="w-full border border-hairline rounded-[11px] px-3.5 py-3 text-[13.5px] text-ink-dark resize-none"
          rows={3}
          placeholder="أي ملاحظة عن أداء الطالب اليوم…"
          value={note}
          onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
        />
      </div>
        </>
      )}

      <FloatingSaveButton
        icon={mode === 'group' ? '✅' : '💾'}
        label={
          mode === 'group'
            ? 'حفظ الحضور'
            : editingId
              ? 'تحديث الجلسة'
              : 'حفظ الجلسة'
        }
        busy={mode === 'individual' ? saving : groupSaving}
        onClick={async () => {
          if (mode === 'group') {
            setGroupSaving(true);
            await groupAttendance.handleSave(showToast);
            setGroupSaving(false);
          } else {
            handleSave();
          }
        }}
      />

      {editingId && (
        <button
          type="button"
          class="w-full py-2.5 rounded-xl border border-hairline text-[#5B5646] text-sm font-semibold"
          onClick={cancelEdit}
        >
          إلغاء التعديل
        </button>
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

      {pendingSave && (
        <WhatsAppModal
          message={pendingSave.message}
          phone={pendingSave.phone}
          busy={saving}
          isEditing={pendingSave.isEditing}
          onBack={() => setPendingSave(null)}
          onSaveOnly={() => commitPendingSave(false)}
          onSaveAndSend={() => commitPendingSave(true)}
        />
      )}
    </div>
  );
}
