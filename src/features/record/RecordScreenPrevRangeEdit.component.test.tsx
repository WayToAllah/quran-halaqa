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
// in the in-place fix: a ✏️ toggle in the evaluation card that lets the
// teacher shorten that old assignment right there, saved alongside today's
// session on the same "حفظ".

const students: Student[] = [{ id: 's_1', name: 'زيد احمد' }];

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
  it('offers the ✏️ toggle for a normal (non-range) previous assignment', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    expect(await screen.findAllByText(/تعديل ما اتحفظ فعلاً/)).toHaveLength(2); // loh + madi
  });

  it('opens من/إلى inputs pre-filled with the stored values', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    const toggles = await screen.findAllByText(/تعديل ما اتحفظ فعلاً/);
    await userEvent.click(toggles[0]); // اللوح
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
  });

  it('does not offer the toggle for a whole-sura range assignment', async () => {
    previousSessionForS1 = {
      ...prevSession,
      newLoh: [{ sura: 'الناس', toSura: 'الفلق', range: true }],
      newMadi: [],
    };
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');
    // Only the madi toggle should be absent too (empty list), and loh has no toggle.
    expect(screen.queryByText(/تعديل ما اتحفظ فعلاً/)).not.toBeInTheDocument();
  });

  it('does not offer the toggle when editing a first-ever session (no separate previous record)', async () => {
    const editRec: SessionRecord = {
      id: 'r_first',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-25',
      newLoh: [{ sura: 'الفاتحة', from: '1', to: '7' }],
      newMadi: [],
      note: '',
    };
    previousSessionForS1 = null; // no prior session — evalSource falls back to editRec itself
    renderScreen(editRec);
    await screen.findByText(/تعديل جلسة محفوظة/);
    expect(screen.queryByText(/تعديل ما اتحفظ فعلاً/)).not.toBeInTheDocument();
  });

  it('saves the corrected range on the PREVIOUS record, not on today’s new record', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    const toggles = await screen.findAllByText(/تعديل ما اتحفظ فعلاً/);
    await userEvent.click(toggles[0]); // اللوح

    const toInput = screen.getByDisplayValue('10');
    await userEvent.clear(toInput);
    await userEvent.type(toInput, '2');

    await saveAndConfirm();

    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(2));
    const savedRecords = saveRecordMock.mock.calls.map((c) => c[2] as SessionRecord);
    const savedPrev = savedRecords.find((r) => r.id === 'r_prev');
    const savedToday = savedRecords.find((r) => r.id !== 'r_prev');

    expect(savedPrev).toBeTruthy();
    expect(savedPrev!.newLoh).toEqual([{ sura: 'البقرة', from: '1', to: '2' }]);
    // Untouched fields on the previous record survive the correction.
    expect(savedPrev!.date).toBe('2026-07-20');
    expect(savedPrev!.newMadi).toEqual([{ sura: 'آل عمران', from: '1', to: '20' }]);

    // Today's own new-assignment section is unaffected by the correction.
    expect(savedToday).toBeTruthy();
    expect(savedToday!.id).not.toBe('r_prev');
  });

  it('does not write a second record when the toggle is opened but nothing is changed', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    const toggles = await screen.findAllByText(/تعديل ما اتحفظ فعلاً/);
    await userEvent.click(toggles[0]);
    // no edits made — just opened and closed
    await saveAndConfirm();
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
  });

  it('reflects the corrected range in the WhatsApp review preview', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await selectStudent('زيد احمد');
    const toggles = await screen.findAllByText(/تعديل ما اتحفظ فعلاً/);
    await userEvent.click(toggles[0]);
    const toInput = screen.getByDisplayValue('10');
    await userEvent.clear(toInput);
    await userEvent.type(toInput, '2');

    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
    expect(await screen.findByText('مراجعة قبل الحفظ')).toBeInTheDocument();
    expect(screen.getByText(/البقرة \(1–2\)/)).toBeInTheDocument();
  });
});
