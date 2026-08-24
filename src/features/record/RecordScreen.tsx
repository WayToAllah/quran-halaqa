import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStudents } from '../../hooks/useStudents';
import { usePreviousSession } from '../../hooks/usePreviousSession';
import { saveRecord } from '../../data/records.repo';
import { republishPublicStatsFor } from '../../data/publishStats';
import { normAr } from '../../domain/text';
import { getStudentName, findStudentRecordOnDate } from '../../domain/students';
import { localDateStr, genId, hijriLong, hijriShort, gregorianLong } from '../../domain';
import {
  scoreToStars,
  scoreName,
  parseScoreField,
  isScoreEntryComplete,
  type ScoreFieldState,
} from '../../domain/scoring';
import {
  extractAssignedSuras,
  validateAyahRange,
  isRowComplete,
  firstIncompleteRow,
  assignmentPairSignature,
  cleanAssignmentRow,
  cleanTajweed,
  rowsSignature,
} from '../../domain/record';
import { computeNextLoh, computeNextMadi } from '../../domain/nextTask';
import { suraLabel } from '../../domain/suras';
import { buildWhatsAppMessage, normalizeWhatsAppPhone } from '../../domain/whatsapp';
import { raceTimeout } from '../../domain/raceTimeout';
import { SuraRow } from './SuraRow';
import { FloatingSaveButton } from './FloatingSaveButton';
import { useGroupAttendance } from '../../hooks/useGroupAttendance';
import { GroupAttendanceModal } from './GroupAttendanceModal';
import { MistakeCounterModal } from './MistakeCounterModal';
import { MushafModal } from './MushafModal';
import { WhatsAppModal } from './WhatsAppModal';
import {
  summarizeMistakes,
  rebuildMistakeHistory,
  committedMistakeScore,
  type MistakeKind,
} from '../../domain/mistakes';
import { StarPicker } from '../../ui/StarPicker';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useToast } from '../../ui/ToastProvider';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
import type { SuraAssignment, SessionRecord, Student } from '../../types';

/**
 * How long to wait for Firestore to acknowledge a session write before letting
 * the teacher move on. Long enough that a normal save still reports a clean
 * "تم الحفظ", short enough that a dead connection doesn't strand anyone.
 */
const SAVE_ACK_TIMEOUT_MS = 8000;

/** Sura info line for the "ما سمعناه النهارده" evaluation card.
 *
 * Delegates the per-item label to the shared `suraLabel` so a whole-sura range
 * reads "من X إلى Y" here exactly as it does in the log, the WhatsApp message
 * and the parent page. This used to be a private re-implementation that knew
 * nothing about range mode: it printed only the START sura and dropped the end
 * of the range, so the teacher graded a shorter assignment than was given. */
function fmtSuraInfo(list: SuraAssignment[]): string {
  if (!list.length) return '—';
  return list.map((l) => (l.range && l.toSura ? suraLabel(l) : 'سورة ' + suraLabel(l))).join(' + ');
}

/** Tier badge colors ported from the approved design, keyed by the real
 * scoreName() bands (85/75/65/50 — see domain/scoring.ts), not re-derived. */
const TIER_COLORS: Record<string, { bg: string; color: string }> = {
  ممتاز: { bg: '#E7F2EC', color: '#0F3D2E' },
  'جيد جداً': { bg: '#EFF6E8', color: '#3E6B22' },
  جيد: { bg: '#FFF8E6', color: '#8A6A15' },
  مقبول: { bg: '#FBEEE3', color: '#9A5A24' },
  إعادة: { bg: '#FBEAE7', color: '#B24A3A' },
};
/** Blurs a score input once its value is unambiguously complete, so the
 * on-screen keyboard dismisses itself instead of the teacher having to tap
 * away — skipped while backspacing so deleting digits doesn't fight back. */
function autoCloseScoreKeyboard(e: Event, value: string) {
  const inputType = (e as InputEvent).inputType;
  if (inputType?.startsWith('delete')) return;
  if (isScoreEntryComplete(value)) {
    (e.target as HTMLInputElement).blur();
  }
}

function tierBadge(state: ScoreFieldState): { label: string; bg: string; color: string } | null {
  if (state.value == null) return null; // empty, or invalid text — nothing to badge yet
  const label = scoreName(state.value);
  const c = TIER_COLORS[label] ?? { bg: '#F1ECDD', color: '#5B5646' };
  return { label, ...c };
}

const emptyRow = (): SuraAssignment => ({ sura: '', from: '', to: '' });

/** How a sura row is titled on screen. Shared with the save-time error message
 * so "السورة الأولى" in the toast is literally the heading the teacher is
 * being sent to look at, instead of a row number they have to count out. */
const rowLabel = (i: number) => (i === 0 ? 'السورة الأولى' : `سورة ${i + 1}`);

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
  // Delays closing the student dropdown on blur just long enough for a tap on
  // one of the suggestion buttons (onMouseDown) to register first — same
  // pattern as the sura combobox in SuraRow.tsx.
  const studentBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (studentBlurTimer.current) clearTimeout(studentBlurTimer.current);
    };
  }, []);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  // When set, handleSave overwrites this record id instead of minting a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  // The record currently being edited (kept so the evaluation card can render
  // its loh/madi even when there's no live "previous session" to evaluate).
  const [editingRecordData, setEditingRecordData] = useState<SessionRecord | null>(null);

  const { prev: prevSession, loading: prevLoading } = usePreviousSession(
    MOSQUE_ID,
    HALAQA_ID,
    selectedStudent,
    editingId ?? undefined,
  );
  const [prevLohScore, setPrevLohScore] = useState('');
  const [prevMadiScore, setPrevMadiScore] = useState('');
  // Lets the teacher correct what a PAST session's assignment actually
  // covered — e.g. the child was assigned ayahs 1-10 but only really had 1-2
  // memorized. `null` means "use the stored value unedited"; typing in the
  // "إلى" box swaps in a working copy that gets persisted back onto evalSource
  // (a DIFFERENT record than the one being saved today) when the session is
  // saved.
  //
  // The edits carry the id of the session they belong to rather than being
  // cleared by an effect when evalSource changes: evalSource arrives from an
  // async read, so an effect keyed on its id can fire AFTER the card is on
  // screen and wipe a correction the teacher has already typed. Tagging the
  // edits and ignoring them when the tag doesn't match is a pure derivation
  // with no such race.
  //
  // Both sides are seeded from the stored assignment the moment the first
  // correction is typed, and `baseline` records what that stored assignment
  // would save as. That pair is what makes "is there really a correction
  // here?" answerable later WITHOUT evalSource — which is already gone by the
  // time the student picker needs the answer, because typing a new name nulls
  // selectedStudent and the previous session goes with it.
  const [prevEdits, setPrevEdits] = useState<{
    sourceId: string;
    loh: SuraAssignment[] | null;
    madi: SuraAssignment[] | null;
    baseline: string;
  } | null>(null);
  // Mistake-counter history per evaluation. Preserved so reopening the counter
  // shows the same taps; committed to the record's loh/madi.mistakes on save.
  const [lohMistakes, setLohMistakes] = useState<MistakeKind[]>([]);
  const [madiMistakes, setMadiMistakes] = useState<MistakeKind[]>([]);
  const [mistakeModal, setMistakeModal] = useState<'loh' | 'madi' | null>(null);
  const [mushafFor, setMushafFor] = useState<'loh' | 'madi' | null>(null);
  // A fresh token per open, so a count from a previous open cannot land on this one.
  const [mushafToken, setMushafToken] = useState('');

  function openMushaf(which: 'loh' | 'madi') {
    setMushafToken(`${which}-${Date.now()}`);
    setMushafFor(which);
  }

  /** The mushaf counter records plain mistakes; they join the same history the
   *  counter modal builds, so the score comes out of one place either way. */
  function applyMushafCount(which: 'loh' | 'madi', count: number) {
    const add: MistakeKind[] = Array.from({ length: count }, () => 'full');
    if (which === 'loh') {
      const next = [...lohMistakes, ...add];
      setLohMistakes(next);
      setPrevLohScore(String(committedMistakeScore(next)));
    } else {
      const next = [...madiMistakes, ...add];
      setMadiMistakes(next);
      setPrevMadiScore(String(committedMistakeScore(next)));
    }
  }

  const [lohRows, setLohRows] = useState<SuraAssignment[]>([emptyRow()]);
  const [madiRows, setMadiRows] = useState<SuraAssignment[]>([emptyRow()]);

  const [tajweedEnabled, setTajweedEnabled] = useState(false);
  const [tajweed, setTajweed] = useState<SuraAssignment>(emptyRow());
  const [tajweedStars, setTajweedStars] = useState(0);
  const [tajweedNote, setTajweedNote] = useState('');

  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const groupAttendance = useGroupAttendance(date, students);
  // A session that's been reviewed-but-not-yet-saved: the WhatsApp confirm modal
  // is showing its summary, and the save fires only on explicit confirm.
  const [pendingSave, setPendingSave] = useState<{
    rec: SessionRecord;
    message: string;
    phone: string;
    isEditing: boolean;
    studentId: string;
    /** Corrected version of the previous session's assignment, when the
     * teacher edited it in the evaluation card — saved alongside `rec`. */
    prevUpdate: SessionRecord | null;
  } | null>(null);
  // Replaces the browser's native confirm() for the two yes/no checks in the
  // save flow (duplicate session, empty session) with a modal matching the
  // app's own style. `onConfirm` carries whatever the save flow should do
  // next if the teacher proceeds.
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
    /** Defaults to just dismissing. Set when cancelling has to undo something
     * the dialog's trigger already changed (e.g. restore the student picker). */
    onCancel?: () => void;
  } | null>(null);
  // Guards the edit-prefill effect so it fires once per distinct record id.
  const consumedEditIdRef = useRef<string | null>(null);
  // The date picker is shared by the whole recording run, but opening a saved
  // session for edit moves it to THAT session's date — and used to leave it
  // there. Every student recorded afterwards then silently landed on the old
  // session's day. `before` is the run's date, `applied` is what edit mode set,
  // so leaving edit mode can put the run's date back without overriding a date
  // the teacher deliberately changed while editing.
  const editDateRef = useRef<{ before: string; applied: string } | null>(null);
  // Who the fields on screen currently describe. Not the same as
  // `selectedStudent`, which the picker nulls the moment the teacher starts
  // typing a new name — by the time an option is clicked it is already gone.
  const formOwnerRef = useRef<Student | null>(null);
  // Signature of the rows as the APP last wrote them (blank, autofilled, or
  // loaded for edit). Anything differing from this is the teacher's own work.
  const pristineRowsRef = useRef<{ loh: string; madi: string }>({
    loh: rowsSignature([emptyRow()]),
    madi: rowsSignature([emptyRow()]),
  });

  const studentMatches = useMemo(() => {
    const q = studentQuery.trim();
    const list = q
      ? students.filter((s) => normAr(getStudentName(s)).includes(normAr(q)))
      : [...students].sort((a, b) => getStudentName(a).localeCompare(getStudentName(b), 'ar'));
    return list.slice(0, 30);
  }, [students, studentQuery]);

  // Detects an existing session for the picked student on the picked date —
  // reuses the same day-coverage data the group-attendance tab already
  // fetches for this date, so this costs no extra read. Excludes the record
  // currently being edited (that's not a duplicate, it's the same session).
  // Individual mode had no such check at all before; group mode already
  // prevents this by graying out students who are "مسجّل بالفعل".
  const duplicateRecord = useMemo(() => {
    if (!selectedStudent || !groupAttendance.dayRecords) return null;
    const found = findStudentRecordOnDate(selectedStudent, date, groupAttendance.dayRecords);
    return found && found.id !== editingId ? found : null;
  }, [selectedStudent, groupAttendance.dayRecords, date, editingId]);

  // The session whose loh/madi assignment is being evaluated. In new-session
  // mode that's the student's previous session. In edit mode it's the session
  // BEFORE the one being edited (usePreviousSession excludes editingId) — this
  // is what today's scores actually grade. Only when editing a student's very
  // first session (no prior session exists) do we fall back to the record
  // itself, so the evaluation fields still render.
  const evalSource = editingId ? (prevSession ?? editingRecordData) : prevSession;
  const prevLohList = evalSource ? extractAssignedSuras(evalSource.newLoh, evalSource.loh) : [];
  const prevMadiList = evalSource ? extractAssignedSuras(evalSource.newMadi, evalSource.madi) : [];
  // Only offer the range-correction UI when evalSource is a genuinely
  // different, already-saved record — when it falls back to editingRecordData
  // (editing a student's very first session, no prior session exists) it IS
  // the record we're already saving, and its assignment is edited directly
  // in "اللوح الجديد"/"الماضي الجديد" below instead.
  const evalSourceIsSeparateRecord = !!evalSource && evalSource.id !== editingId;
  // Edits belong to one specific past session. Once evalSource is a different
  // session (another student picked, edit mode entered/left), the old edits
  // are simply not "active" any more — no clearing step, so they can never
  // land on the wrong record and can never be wiped mid-typing.
  const activeEdits = prevEdits && prevEdits.sourceId === evalSource?.id ? prevEdits : null;
  const editedPrevLoh = activeEdits?.loh ?? null;
  const editedPrevMadi = activeEdits?.madi ?? null;
  const effectivePrevLoh = editedPrevLoh ?? prevLohList;
  const effectivePrevMadi = editedPrevMadi ?? prevMadiList;

  /** Records a correction against the session currently being evaluated. */
  function setEditedPrev(which: 'loh' | 'madi', rows: SuraAssignment[]) {
    const sourceId = evalSource?.id;
    if (!sourceId) return;
    setPrevEdits((cur) => {
      const base =
        cur && cur.sourceId === sourceId
          ? cur
          : {
              sourceId,
              loh: prevLohList,
              madi: prevMadiList,
              baseline: assignmentPairSignature(prevLohList, prevMadiList),
            };
      return { ...base, [which]: rows };
    });
  }

  /** True when the evaluation card holds a correction that would actually
   * change the stored past session — typing "5" and then putting "10" back
   * leaves nothing to warn about. */
  function hasPrevCorrection(): boolean {
    if (!prevEdits) return false;
    return (
      assignmentPairSignature(prevEdits.loh ?? [], prevEdits.madi ?? []) !== prevEdits.baseline
    );
  }
  const prevLohInfo = fmtSuraInfo(effectivePrevLoh);
  const prevMadiInfo = fmtSuraInfo(effectivePrevMadi);
  // Only grade what was actually assigned. A score box under a dash invites a
  // mark for an assignment that was never given — the madi half already knew
  // this; the loh half rendered unconditionally. The `!== ''` arm keeps an
  // existing score visible and editable even when the assignment behind it is
  // missing, so opening an old session for edit can never hide a mark that is
  // still stored on the record.
  const showLohEval = prevLohList.length > 0 || prevLohScore !== '';
  const showMadiEval = prevMadiList.length > 0 || prevMadiScore !== '';

  const lohScoreState = parseScoreField(prevLohScore);
  const madiScoreState = parseScoreField(prevMadiScore);
  const lohTier = tierBadge(lohScoreState);
  const madiTier = tierBadge(madiScoreState);

  /** Everything on the form that describes ONE student's session. The date is
   * deliberately excluded — it is shared across a recording run. */
  /** Blur schedules the dropdown to close 120ms later (so a tap on an option
   * still registers). Coming straight back into the field has to cancel that
   * pending close, or the list shuts under the teacher's finger a moment after
   * they reopen it. */
  function cancelStudentBlurClose() {
    if (studentBlurTimer.current) {
      clearTimeout(studentBlurTimer.current);
      studentBlurTimer.current = null;
    }
  }

  function clearSessionFields() {
    setPrevLohScore('');
    setPrevMadiScore('');
    // Safe to clear here — this runs only on a deliberate action (switching
    // student, resetting after a save), never from an effect, so it can't be
    // the mid-typing wipe the sourceId tagging exists to prevent. Left behind,
    // a stale correction would keep reporting unsaved work on the NEXT switch.
    setPrevEdits(null);
    setLohMistakes([]);
    setMadiMistakes([]);
    setLohRows([emptyRow()]);
    setMadiRows([emptyRow()]);
    setTajweedEnabled(false);
    setTajweed(emptyRow());
    setTajweedStars(0);
    setTajweedNote('');
    setNote('');
    pristineRowsRef.current = {
      loh: rowsSignature([emptyRow()]),
      madi: rowsSignature([emptyRow()]),
    };
  }

  /** True when the form holds something the teacher entered themselves, as
   * opposed to a blank form or the autofill's own suggestion. Only this is
   * worth interrupting them over. */
  function hasUnsavedEntry(): boolean {
    if (prevLohScore || prevMadiScore) return true;
    if (lohMistakes.length || madiMistakes.length) return true;
    if (note.trim()) return true;
    if (tajweedEnabled) return true;
    // A correction to the PAST session is unsaved work too — it only reaches
    // Firestore when today's session is saved, so switching students used to
    // throw it away with no warning at all.
    if (hasPrevCorrection()) return true;
    if (rowsSignature(lohRows) !== pristineRowsRef.current.loh) return true;
    if (rowsSignature(madiRows) !== pristineRowsRef.current.madi) return true;
    return false;
  }

  function applyStudentSwitch(s: Student) {
    setSelectedStudent(s);
    setStudentQuery(getStudentName(s));
    setDropdownOpen(false);
    clearSessionFields();
    formOwnerRef.current = s;
  }

  function selectStudent(s: Student) {
    // Edit mode is a different action: the fields belong to a SAVED record and
    // picking another name re-assigns that record, so nothing is wiped. Left
    // exactly as it behaved before — whether the evaluation scores still mean
    // anything against a different student's previous assignment is an open
    // product question, not something to settle silently here.
    if (editingId) {
      setSelectedStudent(s);
      setStudentQuery(getStudentName(s));
      setDropdownOpen(false);
      setPrevLohScore('');
      setPrevMadiScore('');
      setLohMistakes([]);
      setMadiMistakes([]);
      formOwnerRef.current = s;
      return;
    }

    // The form follows the student: every session field resets, and the
    // autofill then refills اللوح/الماضي from THIS student's own last session.
    // Carrying the previous student's assignment over was never a feature —
    // it only survived when the new student had no previous session (or an
    // incomplete one), i.e. exactly where the mistake is hardest to spot.
    const owner = formOwnerRef.current;
    if (owner && owner.id !== s.id && hasUnsavedEntry()) {
      // Typing in the picker already cleared selectedStudent; put the form's
      // real owner back so nothing appears to have changed behind the dialog.
      setSelectedStudent(owner);
      setStudentQuery(getStudentName(owner));
      setDropdownOpen(false);
      setConfirmDialog({
        title: 'بيانات لسه متحفظتش',
        message: `فيه بيانات مدخلة لـ ${getStudentName(owner)} لسه متحفظتش. لو كمّلت مع ${getStudentName(s)} هتتمسح.`,
        confirmLabel: 'ابدأ من جديد',
        destructive: true,
        onConfirm: () => {
          setConfirmDialog(null);
          applyStudentSwitch(s);
        },
      });
      return;
    }

    applyStudentSwitch(s);
  }

  function resetForm() {
    setSelectedStudent(null);
    setStudentQuery('');
    setEditingId(null);
    setEditingRecordData(null);
    clearSessionFields();
    formOwnerRef.current = null;
    // Allow the same record to be re-opened for edit later (e.g. cancel then
    // tap ✏️ again on the same session).
    consumedEditIdRef.current = null;
    // The date is deliberately NOT reset to today — matches the live app: the
    // admin usually records several students in a row for one session date.
    // But if EDIT MODE moved it, hand the run's own date back, unless the
    // teacher has since chosen a different one themselves.
    const moved = editDateRef.current;
    editDateRef.current = null;
    if (moved && date === moved.applied) setDate(moved.before);
  }

  /** Loads a saved record into the form for editing — resolves the current
   * student, fills every field, and switches into edit mode. Shared by the
   * log screen's ✏️ hand-off (via the effect below) and the duplicate-session
   * banner's "فتح الجلسة الموجودة" action, so both paths edit in place
   * instead of ever risking a second record for the same student/day. */
  function enterEditMode(r: SessionRecord) {
    // Editing is inherently individual — make sure the attendance sheet isn't
    // sitting open over the form the teacher is being sent to.
    setGroupOpen(false);
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
    setStudentQuery(student ? getStudentName(student) : (r.student ?? ''));
    if (r.date && r.date !== date) {
      // Keep the FIRST date we moved away from: editing a second record
      // without leaving edit mode must still return to the recording run's
      // own date, not to the previous record's.
      editDateRef.current = { before: editDateRef.current?.before ?? date, applied: r.date };
      setDate(r.date);
    }

    setPrevLohScore(r.loh?.score != null ? String(r.loh.score) : '');
    setPrevMadiScore(r.madi?.score != null ? String(r.madi.score) : '');
    // Restore the exact mistake tally if this session was recorded with the
    // counter; pre-feature records have no tally, so the counter starts empty.
    setLohMistakes(rebuildMistakeHistory(r.loh?.mistakes));
    setMadiMistakes(rebuildMistakeHistory(r.madi?.mistakes));

    const lohArr = (r.newLoh ?? []).filter((l) => l?.sura);
    const lohLoaded = lohArr.length ? lohArr.map((l) => ({ ...l })) : [emptyRow()];
    setLohRows(lohLoaded);
    const madiArr = (r.newMadi ?? []).filter((m) => m?.sura);
    const madiLoaded = madiArr.length ? madiArr.map((m) => ({ ...m })) : [emptyRow()];
    setMadiRows(madiLoaded);
    // What was loaded from the record is the baseline; only edits on top of it
    // count as the teacher's unsaved work.
    formOwnerRef.current = student;
    pristineRowsRef.current = { loh: rowsSignature(lohLoaded), madi: rowsSignature(madiLoaded) };

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
  }

  // Populate the form when the log screen hands us a record to edit. Guarded by
  // a ref so it runs exactly once per distinct record id — NOT re-run when the
  // students list arrives or changes (which would clobber the user's edits).
  useEffect(() => {
    if (!editRecord) return;
    if (consumedEditIdRef.current === editRecord.id) return;
    consumedEditIdRef.current = editRecord.id;
    enterEditMode(editRecord);
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
    // The suggestion is the app's own writing, not the teacher's — baseline it
    // so switching students right after an autofill doesn't look like unsaved
    // work and pop a confirmation on every single pick.
    pristineRowsRef.current = {
      loh: nextLoh ? rowsSignature([nextLoh]) : pristineRowsRef.current.loh,
      madi: nextMadi ? rowsSignature([nextMadi]) : pristineRowsRef.current.madi,
    };
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
    // Last-resort safety net for the duplicate-session banner above the
    // picker — if the teacher saves anyway without tapping "فتح الجلسة
    // الموجودة", confirm they really mean to create a second record for the
    // same student/day rather than silently doing it.
    if (duplicateRecord) {
      setConfirmDialog({
        title: 'جلسة مسجلة بالفعل',
        message: `${getStudentName(selectedStudent)} مسجّل بالفعل بتاريخ ${date}. تريد إنشاء جلسة تانية برضه؟`,
        confirmLabel: 'إنشاء جلسة تانية',
        destructive: true,
        onConfirm: () => {
          setConfirmDialog(null);
          continueSaveAfterDuplicateCheck();
        },
      });
      return;
    }
    continueSaveAfterDuplicateCheck();
  }

  function continueSaveAfterDuplicateCheck() {
    if (!selectedStudent) return; // narrows for TS; handleSave already checked this

    // A row the teacher started but that can't be saved used to be dropped
    // silently by the filter below — most often a sura name typed but never
    // matched (the picker commits '' for anything it can't resolve), so the
    // session saved short of what was actually assigned and nothing said so.
    // Stop instead, and name the row.
    const sections: { name: string; rows: SuraAssignment[]; label: (i: number) => string }[] = [
      { name: 'اللوح', rows: lohRows, label: rowLabel },
      { name: 'الماضي', rows: madiRows, label: rowLabel },
      ...(tajweedEnabled
        ? [{ name: 'التجويد', rows: [tajweed], label: () => 'سورة التجويد' }]
        : []),
    ];
    for (const section of sections) {
      const bad = firstIncompleteRow(section.rows);
      if (bad) {
        showToast(`${section.name} — ${section.label(bad.index)}: ${bad.reason}`, true);
        return;
      }
    }

    const activeLohRows = lohRows.filter(isRowComplete).map(cleanAssignmentRow);
    const activeMadiRows = madiRows.filter(isRowComplete).map(cleanAssignmentRow);
    // Ayah-range validation applies only to per-sura rows; whole-sura range
    // rows carry no ayah numbers, so skip them here.
    const rowErrors = [
      ...activeLohRows,
      ...activeMadiRows,
      ...(tajweedEnabled ? [tajweed] : []),
    ].some((r) => {
      if (r.range) return false;
      const e = validateAyahRange(r.sura || '', r.from || '', r.to || '');
      return e.fromError || e.toError;
    });
    if (rowErrors) {
      showToast('يوجد خطأ في أرقام الآيات — راجع الحقول الحمراء', true);
      return;
    }
    // A non-numeric score used to silently save as a real 0 ("إعادة") — a
    // false failing grade from a typo. Block the save instead and point at
    // the red field so the teacher notices and retypes it.
    if (lohScoreState.invalid || madiScoreState.invalid) {
      showToast('الدرجة لازم تكون رقم — راجع الحقل الأحمر', true);
      return;
    }

    const lohScore = lohScoreState.value;
    const madiScore = madiScoreState.value;

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
      rec.tajweed = cleanTajweed(tajweed, tajweedStars, tajweedNote);
    }

    const hasContent =
      rec.newLoh!.length > 0 ||
      rec.newMadi!.length > 0 ||
      !!rec.tajweed ||
      lohScore != null ||
      madiScore != null ||
      !!rec.note;
    if (!hasContent) {
      setConfirmDialog({
        title: 'جلسة فارغة',
        message: 'الجلسة فارغة تماماً (بدون لوح أو ماضي أو تقييم أو ملاحظة). تريد الحفظ برضه؟',
        confirmLabel: 'حفظ برضه',
        destructive: true,
        onConfirm: () => {
          setConfirmDialog(null);
          previewSave(rec, isEditing);
        },
      });
      return;
    }
    previewSave(rec, isEditing);
  }

  /** The corrected version of evalSource to persist alongside today's record,
   * or null when there's nothing to correct (no edits, or evalSource isn't a
   * separate record). Only the assignment fields change — everything else
   * about that past session (its own scores, note, date...) is untouched. */
  function buildPrevSessionUpdate(): SessionRecord | null {
    if (!evalSource || !evalSourceIsSeparateRecord) return null;
    if (!editedPrevLoh && !editedPrevMadi) return null;
    const newLoh = (editedPrevLoh ?? prevLohList).filter(isRowComplete).map(cleanAssignmentRow);
    const newMadi = (editedPrevMadi ?? prevMadiList).filter(isRowComplete).map(cleanAssignmentRow);
    const unchanged =
      rowsSignature(newLoh) === rowsSignature(prevLohList.map(cleanAssignmentRow)) &&
      rowsSignature(newMadi) === rowsSignature(prevMadiList.map(cleanAssignmentRow));
    if (unchanged) return null;
    return { ...evalSource, newLoh, newMadi };
  }

  // Preview-before-save: show the WhatsApp summary as the confirmation step so
  // the teacher reviews exactly what the parent will see BEFORE anything is
  // written. Nothing is saved here — the actual save happens only when they
  // confirm in the modal (or they go back and keep editing). This is why the
  // summary doubles as the teacher's own review of the session.
  function previewSave(rec: SessionRecord, isEditing: boolean) {
    if (!selectedStudent) return;
    const prevUpdate = buildPrevSessionUpdate();
    // The WhatsApp preview must reflect the CORRECTED assignment, not the
    // originally-stored one, so what the teacher reviews matches what's
    // about to be saved.
    const messageSource = prevUpdate ?? prevSession;
    const message = buildWhatsAppMessage(rec, messageSource, selectedStudent.parentToken);
    const phone = normalizeWhatsAppPhone(selectedStudent.phonePrimary);
    setPendingSave({ rec, message, phone, isEditing, studentId: selectedStudent.id, prevUpdate });
  }

  // Commits the reviewed session. Called from the confirm modal; `send` decides
  // whether to open WhatsApp afterward. Only here does anything hit Firestore.
  async function commitPendingSave(send: boolean) {
    if (!pendingSave || saving) return;
    const { rec, message, phone, isEditing, studentId, prevUpdate } = pendingSave;
    setSaving(true);
    try {
      // Firestore's setDoc() promise waits for a SERVER ack. Offline, the SDK
      // queues the write and the promise never settles — awaiting it outright
      // left the teacher stuck on "جاري الحفظ…" with no way out and no error.
      // So: wait a bounded time, then carry on. The write is already in the
      // SDK's queue and flushes by itself when the connection returns.
      // The corrected previous session (if any) rides along with today's
      // write — both are simple id-keyed upserts, so firing them together
      // costs no extra round trip worth waiting on separately.
      const write: Promise<void> = prevUpdate
        ? Promise.all([
            saveRecord(MOSQUE_ID, HALAQA_ID, rec),
            saveRecord(MOSQUE_ID, HALAQA_ID, prevUpdate),
          ]).then(() => undefined)
        : saveRecord(MOSQUE_ID, HALAQA_ID, rec);
      const outcome = await raceTimeout(write, SAVE_ACK_TIMEOUT_MS);
      if (outcome.status === 'pending') {
        // The deadline won, so this promise's eventual result is ours to
        // handle — otherwise a late rejection escapes unhandled.
        write.then(
          () => showToast('✓ رجع النت واترفعت الجلسة'),
          (err) => {
            console.error('queued saveRecord failed:', err);
            showToast('⚠️ جلسة كانت مستنية النت فشلت — راجع السجل', true);
          },
        );
        showToast('📴 النت ضعيف — الجلسة اتسجلت على الجهاز وهترفع لوحدها', true);
      } else {
        showToast(isEditing ? '✓ تم تحديث الجلسة' : '✓ تم الحفظ بنجاح');
      }
      // Refresh the parent-facing projection immediately (fire-and-forget; a
      // failure here must not block the save that already succeeded).
      // prevUpdate.studentId is normally the same student, but selectStudent()
      // in edit mode allows re-assigning a record to someone else — cover
      // both ids so a corrected assignment never leaves a stale parent view.
      const affectedIds = new Set([
        studentId,
        ...(prevUpdate?.studentId ? [prevUpdate.studentId] : []),
      ]);
      void republishPublicStatsFor([...affectedIds]);
      // The "مسجّل بالفعل" warning reads the day's coverage snapshot, which is
      // otherwise only taken when the date changes — without this refresh the
      // student just saved could be picked again straight away with no warning.
      void groupAttendance.refresh();
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

  /** Renders "اللوح"/"الماضي" inside the evaluation card. The end ayah ("إلى")
   * is a live input, always editable — mid-session the teacher often finds the
   * child only really memorized part of what was assigned, and typing the real
   * end ayah straight into the line beats hunting for an edit affordance
   * first. Only "إلى" is editable: the start ayah is where the assignment
   * genuinely began, so shortening from the end is the real-world correction.
   *
   * Whole-sura-range items ("🔗 نطاق سور") stay plain text — correcting those
   * needs sura boundaries, not ayah numbers, and remains a Log-screen edit.
   * When evalSource isn't a separate saved record (editing a student's very
   * first session), the whole section is plain text too: that assignment is
   * already editable below in "اللوح الجديد"/"الماضي الجديد". */
  function renderPrevRangeSection(
    label: string,
    which: 'loh' | 'madi',
    list: SuraAssignment[],
    info: string,
    edited: SuraAssignment[] | null,
  ) {
    const editable = evalSourceIsSeparateRecord && list.some((it) => !it.range);
    if (!editable) {
      return (
        <div>
          <div class="text-xs font-semibold text-[#5B5646] mb-1">{label}</div>
          <div class="text-sm mb-2 text-ink-dark">{info}</div>
        </div>
      );
    }
    const current = edited ?? list;
    return (
      <div>
        <div class="text-xs font-semibold text-[#5B5646] mb-1">{label}</div>
        <div class="space-y-1.5 mb-2">
          {list.map((item, i) =>
            item.range ? (
              <div key={i} class="text-sm text-ink-dark">
                {suraLabel(item)}
              </div>
            ) : (
              <div key={i} class="flex items-center gap-1.5 text-sm flex-wrap">
                {/* A whole-sura assignment carries no `from` — it starts at
                    ayah 1 by definition, so that's what the teacher should
                    read, not a bare sura name next to a lone box. */}
                <span class="text-ink-dark">{`سورة ${item.sura} (من ${item.from || '1'}`}</span>
                <span class="text-taupe text-xs">إلى</span>
                <input
                  type="number"
                  min={1}
                  aria-label={`آخر آية اتحفظت في ${item.sura}`}
                  class="w-14 text-center rounded-lg border border-mustard/50 bg-[#FFFCF3] py-1 text-sm font-semibold text-forest"
                  value={current[i]?.to ?? ''}
                  onInput={(e) => {
                    const val = (e.target as HTMLInputElement).value;
                    // Row i is rebuilt from the STORED row, so the implied
                    // start is written out explicitly the moment an end ayah
                    // makes the assignment a real range — a saved
                    // {sura, to} with no `from` would read as ambiguous
                    // everywhere else. Emptying the box puts the row back to
                    // exactly what was stored, so no phantom edit is saved.
                    const orig = list[i];
                    const next: SuraAssignment = { ...orig };
                    if (val) {
                      next.from = orig.from || '1';
                      next.to = val;
                    } else {
                      delete next.to;
                    }
                    setEditedPrev(
                      which,
                      current.map((x, idx) => (idx === i ? next : x)),
                    );
                  }}
                />
                <span class="text-ink-dark">)</span>
              </div>
            ),
          )}
        </div>
      </div>
    );
  }

  const cardCls = 'bg-white border border-hairline rounded-2xl p-[18px]';
  // Compact, matched-format pair — both month-named, neither shows the year,
  // so the two stay visually aligned instead of one running longer than the
  // other: "٢٤ محرم — ٢٣ يوليو".
  const dateDisplay = [hijriShort(date), gregorianLong(date)].filter(Boolean).join(' — ');

  return (
    <div class="p-[18px] pb-[150px] space-y-3" dir="rtl">
      <div class="flex items-center gap-2">
        <div class="relative shrink-0 flex items-center gap-1 max-w-[128px]">
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="#0F3D2E"
            stroke-width="1.8"
            class="shrink-0"
          >
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
          </svg>
          {/* Same invisible-overlay pattern as before: tapping the chip opens
              the native date sheet, but the visible text is always our own
              Hijri/Gregorian formatting. */}
          <input
            type="date"
            aria-label="تاريخ الجلسة"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            value={date}
            onInput={(e) => setDate((e.target as HTMLInputElement).value)}
          />
          <span class="pointer-events-none text-[11px] font-bold text-[#0F3D2E] truncate">
            {dateDisplay || 'اختر التاريخ'}
          </span>
        </div>

        <button
          type="button"
          class="ms-auto shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F1ECDD] text-[12px] font-bold text-forest active:scale-95 transition-transform"
          onClick={() => setGroupOpen(true)}
        >
          ✅ حضور جماعي
        </button>
      </div>

      {editingId && (
        <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-amber-800">✏️ تعديل جلسة محفوظة</span>
          <button class="text-xs font-semibold text-amber-700 underline" onClick={cancelEdit}>
            إلغاء
          </button>
        </div>
      )}

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
                cancelStudentBlurClose();
                setStudentQuery((e.target as HTMLInputElement).value);
                setDropdownOpen(true);
                if (selectedStudent) setSelectedStudent(null);
              }}
              onFocus={() => {
                cancelStudentBlurClose();
                setDropdownOpen(true);
              }}
              onBlur={() => {
                studentBlurTimer.current = setTimeout(() => setDropdownOpen(false), 120);
              }}
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
              {studentMatches.length === 0 && (
                <div class="p-3 text-xs text-taupe">لا يوجد نتائج</div>
              )}
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

        {duplicateRecord && (
          <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-2.5">
            <span class="text-xs font-semibold text-amber-800">
              ⚠️ {getStudentName(selectedStudent!)} مسجّل بالفعل بتاريخ {dateDisplay || date}
            </span>
            <button
              type="button"
              class="shrink-0 text-xs font-bold text-amber-800 underline"
              onClick={() => {
                consumedEditIdRef.current = duplicateRecord.id;
                enterEditMode(duplicateRecord);
              }}
            >
              فتح الجلسة الموجودة
            </button>
          </div>
        )}

        {/* Reading the last session is a round-trip; without this the card is
          simply absent and a student WITH history looks like one without. */}
        {selectedStudent && prevLoading && !evalSource && (
          <div class={cardCls + ' text-[12px] text-taupe'}>⏳ بنجيب آخر جلسة للطالب…</div>
        )}

        {selectedStudent && evalSource && (showLohEval || showMadiEval) && (
          <div class={cardCls + ' space-y-3.5'}>
            <div>
              <div class="font-extrabold text-ink-dark text-[13.5px]">📋 ما سمعناه النهارده</div>
              <div class="text-[11px] text-taupe mt-0.5">
                {editingId
                  ? 'تقييم هذه الجلسة'
                  : `من جلسة ${hijriLong(evalSource.date) ? hijriLong(evalSource.date) + ' — ' : ''}${new Date(evalSource.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}`}
              </div>
            </div>

            {showLohEval && (
              <div>
                {renderPrevRangeSection('اللوح', 'loh', prevLohList, prevLohInfo, editedPrevLoh)}
                <label class="text-xs text-taupe">التقييم (من 100)</label>
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="مثلاً 90"
                    class={
                      'w-20 text-center font-extrabold text-lg rounded-xl py-2 border ' +
                      (lohScoreState.invalid
                        ? 'border-red-400 bg-red-50 text-red-700'
                        : 'border-mustard/50 bg-[#FFFCF3] text-forest')
                    }
                    value={prevLohScore}
                    onInput={(e) => {
                      const val = (e.target as HTMLInputElement).value;
                      setPrevLohScore(val);
                      autoCloseScoreKeyboard(e, val);
                    }}
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
                    onClick={() => openMushaf('loh')}
                  >
                    📖 المصحف
                  </button>
                  <button
                    type="button"
                    class="text-xs font-semibold text-forest border border-forest/20 rounded-lg px-2.5 py-2"
                    onClick={() => setMistakeModal('loh')}
                  >
                    🧮 عدّاد الأخطاء
                    {lohMistakes.length > 0 ? ` (${lohMistakes.length})` : ''}
                  </button>
                </div>
                {lohScoreState.invalid && (
                  <div class="text-[11px] text-red-600 font-semibold mt-1">
                    الدرجة لازم تكون رقم
                  </div>
                )}
                {lohScoreState.clamped && (
                  <div class="text-[11px] text-amber-700 font-semibold mt-1">
                    هيتحفظ {lohScoreState.value} (الدرجة من 0 إلى 100)
                  </div>
                )}
              </div>
            )}

            {showMadiEval && (
              <div class="pt-3.5 border-t border-hairline">
                {renderPrevRangeSection(
                  'الماضي',
                  'madi',
                  prevMadiList,
                  prevMadiInfo,
                  editedPrevMadi,
                )}
                <label class="text-xs text-taupe">التقييم (من 100)</label>
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="مثلاً 85"
                    class={
                      'w-20 text-center font-extrabold text-lg rounded-xl py-2 border ' +
                      (madiScoreState.invalid
                        ? 'border-red-400 bg-red-50 text-red-700'
                        : 'border-mustard/50 bg-[#FFFCF3] text-forest')
                    }
                    value={prevMadiScore}
                    onInput={(e) => {
                      const val = (e.target as HTMLInputElement).value;
                      setPrevMadiScore(val);
                      autoCloseScoreKeyboard(e, val);
                    }}
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
                    onClick={() => openMushaf('madi')}
                  >
                    📖 المصحف
                  </button>
                  <button
                    type="button"
                    class="text-xs font-semibold text-forest border border-forest/20 rounded-lg px-2.5 py-2"
                    onClick={() => setMistakeModal('madi')}
                  >
                    🧮 عدّاد الأخطاء
                    {madiMistakes.length > 0 ? ` (${madiMistakes.length})` : ''}
                  </button>
                </div>
                {madiScoreState.invalid && (
                  <div class="text-[11px] text-red-600 font-semibold mt-1">
                    الدرجة لازم تكون رقم
                  </div>
                )}
                {madiScoreState.clamped && (
                  <div class="text-[11px] text-amber-700 font-semibold mt-1">
                    هيتحفظ {madiScoreState.value} (الدرجة من 0 إلى 100)
                  </div>
                )}
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
              label={rowLabel(i)}
              value={row}
              onChange={(v) => setLohRows((rows) => rows.map((r, idx) => (idx === i ? v : r)))}
              onRemove={
                i > 0 ? () => setLohRows((rows) => rows.filter((_, idx) => idx !== i)) : undefined
              }
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
              label={rowLabel(i)}
              value={row}
              onChange={(v) => setMadiRows((rows) => rows.map((r, idx) => (idx === i ? v : r)))}
              onRemove={
                i > 0 ? () => setMadiRows((rows) => rows.filter((_, idx) => idx !== i)) : undefined
              }
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
              <div class="text-[11.5px] text-taupe mt-0.5">
                اختياري — لتتبع أخطاء التجويد الشائعة
              </div>
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
              <SuraRow
                label="سورة التجويد"
                value={tajweed}
                onChange={setTajweed}
                allowRange={false}
              />
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

      <FloatingSaveButton
        icon="💾"
        label={editingId ? 'تحديث الجلسة' : 'حفظ الجلسة'}
        busy={saving}
        onClick={handleSave}
      />

      {groupOpen && (
        <GroupAttendanceModal
          dateDisplay={dateDisplay}
          dayRecords={groupAttendance.dayRecords}
          sorted={groupAttendance.sorted}
          eligible={groupAttendance.eligible}
          checked={groupAttendance.checked}
          toggle={groupAttendance.toggle}
          toggleAll={groupAttendance.toggleAll}
          onSave={() => groupAttendance.handleSave(showToast)}
          onClose={() => setGroupOpen(false)}
        />
      )}

      {editingId && (
        <button
          type="button"
          class="w-full py-2.5 rounded-xl border border-hairline text-[#5B5646] text-sm font-semibold"
          onClick={cancelEdit}
        >
          إلغاء التعديل
        </button>
      )}

      {mushafFor && (
        <MushafModal
          label={mushafFor === 'loh' ? 'اللوح' : 'الماضي'}
          list={
            mushafFor === 'loh' ? (editedPrevLoh ?? prevLohList) : (editedPrevMadi ?? prevMadiList)
          }
          studentName={selectedStudent ? getStudentName(selectedStudent) : ''}
          token={mushafToken}
          onCount={(count) => applyMushafCount(mushafFor, count)}
          onClose={() => setMushafFor(null)}
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

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          destructive={confirmDialog.destructive}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel ?? (() => setConfirmDialog(null))}
        />
      )}
    </div>
  );
}
