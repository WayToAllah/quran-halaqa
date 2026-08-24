import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { RecordScreen } from './RecordScreen';
import type { SessionRecord, Student } from '../../types';

// The teacher's report: listening to a child mid-session and finding he'd
// only really memorized part of what was assigned last time (e.g. 2 ayahs of
// a 1-10 assignment) meant leaving the record screen, editing the OLD session
// from the log, then coming back to record today's session. These tests lock
// in the in-place fix: the "إلى" ayah in the evaluation card is a live input,
// and the correction saves onto that past session alongside today's.

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'سالم' },
];

const saveRecordMock = vi.fn().mockResolvedValue(undefined);
let previousSessionForS1: SessionRecord | null = null;

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../hooks/usePreviousSession', () => ({
  usePreviousSession: (_m: string, _h: string, student: Student | null) => ({
    prev: student?.id === 's_1' ? previousSessionForS1 : null,
    loading: false,
  }),
}));
vi.mock('../../data/records.repo', () => ({
  saveRecord: (...args: unknown[]) => saveRecordMock(...args),
  getRecordsByDate: vi.fn().mockResolvedValue([]),
}));
const republishMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../data/publishStats', () => ({
  republishPublicStatsFor: (...args: unknown[]) => republishMock(...args),
}));

function renderScreen(editRecord: SessionRecord | null = null) {
  return render(
    <ToastProvider>
      <RecordScreen editRecord={editRecord} onEditConsumed={() => {}} />
    </ToastProvider>,
  );
}

async function selectStudent(name: string) {
  const input = screen.getByPlaceholderText('ابحث أو اختر اسم الطالب…');
  await userEvent.click(input);
  await userEvent.type(input, name);
  await userEvent.click(screen.getByRole('button', { name }));
}

async function saveAndConfirm() {
  await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة|تحديث الجلسة/ }));
  await userEvent.click(
    await screen.findByRole('button', {
      name: /احفظ بدون إرسال|حدّث بدون إرسال|احفظ الجلسة|حدّث الجلسة/,
    }),
  );
}

/** The live "إلى" box for a given sura in the evaluation card. */
function endAyahBox(sura: string) {
  return screen.getByLabelText(`آخر آية اتحفظت في ${sura}`);
}

const prevSession: SessionRecord = {
  id: 'r_prev',
  studentId: 's_1',
  student: 'زيد احمد',
  date: '2026-07-20',
  newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
  newMadi: [{ sura: 'آل عمران', from: '1', to: '20' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  previousSessionForS1 = null;
});

describe('RecordScreen — correcting a previous session range from the eval card', () => {
  it('shows the "إلى" ayah as a live input, pre-filled, with no toggle to press first', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    expect(endAyahBox('البقرة')).toHaveValue(10);
    expect(endAyahBox('آل عمران')).toHaveValue(20);
    // No edit affordance stands between the teacher and the field.
    expect(screen.queryByText(/تعديل ما اتحفظ فعلاً/)).not.toBeInTheDocument();
  });

  it('keeps the start ayah as plain text — only the end is correctable', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    expect(screen.getByText(/البقرة \(من 1/)).toBeInTheDocument();
    // Exactly two number boxes in the card belong to ranges (loh + madi ends).
    expect(screen.queryByLabelText('آية البداية')).not.toBeInTheDocument();
  });

  it('renders a whole-sura range assignment as plain text, with no input', async () => {
    previousSessionForS1 = {
      ...prevSession,
      newLoh: [{ sura: 'الناس', toSura: 'الفلق', range: true }],
      newMadi: [],
    };
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    expect(screen.getByText('من الناس إلى الفلق')).toBeInTheDocument();
    expect(screen.queryByLabelText(/آخر آية اتحفظت/)).not.toBeInTheDocument();
  });

  it('stays plain text when editing a first-ever session (no separate previous record)', async () => {
    const editRec: SessionRecord = {
      id: 'r_first',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-25',
      newLoh: [{ sura: 'الفاتحة', from: '1', to: '7' }],
      newMadi: [],
      note: '',
    };
    previousSessionForS1 = null; // evalSource falls back to editRec itself
    renderScreen(editRec);
    await screen.findByText(/تعديل جلسة محفوظة/);
    expect(screen.queryByLabelText(/آخر آية اتحفظت/)).not.toBeInTheDocument();
  });

  it('saves the corrected end ayah on the PREVIOUS record, not on today’s new record', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    const box = endAyahBox('البقرة');
    await userEvent.clear(box);
    await userEvent.type(box, '2');

    await saveAndConfirm();

    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(2));
    const saved = saveRecordMock.mock.calls.map((c) => c[2] as SessionRecord);
    const savedPrev = saved.find((r) => r.id === 'r_prev');
    const savedToday = saved.find((r) => r.id !== 'r_prev');

    expect(savedPrev!.newLoh).toEqual([{ sura: 'البقرة', from: '1', to: '2' }]);
    // Untouched fields on the previous record survive the correction.
    expect(savedPrev!.date).toBe('2026-07-20');
    expect(savedPrev!.newMadi).toEqual([{ sura: 'آل عمران', from: '1', to: '20' }]);
    expect(savedToday).toBeTruthy();
  });

  it('writes only today’s record when the "إلى" boxes are left alone', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');
    await saveAndConfirm();
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
  });

  it('writes only today’s record when a box is edited back to its original value', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    const box = endAyahBox('البقرة');
    await userEvent.clear(box);
    await userEvent.type(box, '10'); // same as stored

    await saveAndConfirm();
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
  });

  it('reflects the corrected range in the WhatsApp review preview', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    const box = endAyahBox('البقرة');
    await userEvent.clear(box);
    await userEvent.type(box, '2');

    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
    expect(await screen.findByText('مراجعة قبل الحفظ')).toBeInTheDocument();
    expect(screen.getByText(/البقرة \(1–2\)/)).toBeInTheDocument();
  });

  it('keeps a correction typed the moment the card appears, mid-load', async () => {
    // evalSource arrives from an async read. An earlier version cleared the
    // edits from an effect keyed on its id, which could fire AFTER the card
    // rendered — silently wiping a correction the teacher had already typed.
    previousSessionForS1 = null;
    const { rerender } = renderScreen();
    await selectStudent('زيد احمد');

    // The previous session lands and the card appears.
    previousSessionForS1 = prevSession;
    rerender(
      <ToastProvider>
        <RecordScreen editRecord={null} onEditConsumed={() => {}} />
      </ToastProvider>,
    );
    await screen.findByText('📋 ما سمعناه النهارده');

    const box = endAyahBox('البقرة');
    await userEvent.clear(box);
    await userEvent.type(box, '2');
    expect(box).toHaveValue(2); // survives any late reset

    await saveAndConfirm();
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(2));
    const savedPrev = saveRecordMock.mock.calls
      .map((c) => c[2] as SessionRecord)
      .find((r) => r.id === 'r_prev');
    expect(savedPrev!.newLoh).toEqual([{ sura: 'البقرة', from: '1', to: '2' }]);
  });

  it('never lands one student’s correction on another student’s session', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    const box = endAyahBox('البقرة');
    await userEvent.clear(box);
    await userEvent.type(box, '2');

    // Switch to a student with no previous session at all, then save. The
    // correction now counts as unsaved work, so the switch is confirmed
    // first — and confirming discards it outright rather than merely leaving
    // it inert, which is what the assertion below still checks.
    const picker = screen.getByPlaceholderText('ابحث أو اختر اسم الطالب…');
    await userEvent.clear(picker);
    await userEvent.type(picker, 'سالم');
    await userEvent.click(await screen.findByRole('button', { name: 'سالم' }));
    await userEvent.click(await screen.findByRole('button', { name: 'ابدأ من جديد' }));
    // Give the new session some content so the "جلسة فارغة" confirm doesn't
    // stand between us and the save under test.
    await userEvent.type(screen.getByPlaceholderText(/ملاحظة/), 'حضر');

    await saveAndConfirm();
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalled());
    // Only today's record — the stale correction is inert, not re-applied.
    const ids = saveRecordMock.mock.calls.map((c) => (c[2] as SessionRecord).id);
    expect(ids).not.toContain('r_prev');
  });

  it('shows a whole-sura assignment as starting from ayah 1, not as a bare name', async () => {
    // Typing just a sura name assigns the whole sura: no `from` is stored,
    // because ayah 1 is where a sura begins. The card used to print the bare
    // name beside a lone box, which read as if the start were unknown.
    previousSessionForS1 = { ...prevSession, newLoh: [{ sura: 'المدثر' }], newMadi: [] };
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    expect(screen.getByText('سورة المدثر (من 1')).toBeInTheDocument();
    expect(endAyahBox('المدثر')).toHaveValue(null); // open-ended: whole sura
  });

  it('writes the implied start explicitly when a whole sura gets an end ayah', async () => {
    previousSessionForS1 = { ...prevSession, newLoh: [{ sura: 'المدثر' }], newMadi: [] };
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    await userEvent.type(endAyahBox('المدثر'), '2');
    await saveAndConfirm();

    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(2));
    const savedPrev = saveRecordMock.mock.calls
      .map((c) => c[2] as SessionRecord)
      .find((r) => r.id === 'r_prev');
    // Not {sura, to} — a range with no start would be ambiguous everywhere else.
    expect(savedPrev!.newLoh).toEqual([{ sura: 'المدثر', from: '1', to: '2' }]);
  });

  it('leaves a whole-sura assignment alone when the box is typed in then emptied', async () => {
    previousSessionForS1 = { ...prevSession, newLoh: [{ sura: 'المدثر' }], newMadi: [] };
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    const box = endAyahBox('المدثر');
    await userEvent.type(box, '5');
    await userEvent.clear(box); // changed my mind — he had the whole sura

    await saveAndConfirm();
    // No phantom {sura, from:'1'} rewrite of an untouched assignment.
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
  });
});
