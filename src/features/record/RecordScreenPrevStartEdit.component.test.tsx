import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { RecordScreen } from './RecordScreen';
import { DraftGuardProvider } from '../tenant/DraftGuard';
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
      <DraftGuardProvider>
        <RecordScreen editRecord={editRecord} onEditConsumed={() => {}} />
      </DraftGuardProvider>
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

/** The live "من" box for a given sura in the evaluation card. */
function startAyahBox(sura: string) {
  return screen.getByLabelText(`أول آية اتحفظت في ${sura}`);
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

// The teacher sometimes finds the child really started from a later ayah (or
// the start was typed wrong), so «من» is correctable too — with guards, since
// pages.ts silently treats from > to as the WHOLE sura.

async function openWithPrev(prev: SessionRecord) {
  previousSessionForS1 = prev;
  renderScreen();
  await selectStudent('زيد احمد');
  await screen.findByText('📋 ما سمعناه النهارده');
}

function savedById(id: string) {
  return saveRecordMock.mock.calls
    .map((c) => c[2] as SessionRecord)
    .find((r) => (id === 'today' ? r.id !== 'r_prev' : r.id === id));
}

describe('RecordScreen — correcting the START ayah of the previous session', () => {
  it('shows «من» as a live input, pre-filled', async () => {
    await openWithPrev(prevSession);
    expect(startAyahBox('البقرة')).toHaveValue(1);
    expect(startAyahBox('آل عمران')).toHaveValue(1);
  });

  it('saves the corrected start on the PREVIOUS record, keeping its end', async () => {
    await openWithPrev(prevSession);
    const box = startAyahBox('البقرة');
    await userEvent.clear(box);
    await userEvent.type(box, '5');
    await saveAndConfirm();

    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(2));
    expect(savedById('r_prev')!.newLoh).toEqual([{ sura: 'البقرة', from: '5', to: '10' }]);
    expect(savedById('r_prev')!.newMadi).toEqual(prevSession.newMadi);
  });

  it('a later «إلى» edit keeps the corrected «من»', async () => {
    await openWithPrev(prevSession);
    const start = startAyahBox('البقرة');
    await userEvent.clear(start);
    await userEvent.type(start, '3');
    const end = endAyahBox('البقرة');
    await userEvent.clear(end);
    await userEvent.type(end, '8');
    await saveAndConfirm();

    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(2));
    expect(savedById('r_prev')!.newLoh).toEqual([{ sura: 'البقرة', from: '3', to: '8' }]);
  });

  it('a whole-sura assignment gets its last ayah written out when «من» is set', async () => {
    await openWithPrev({ ...prevSession, newLoh: [{ sura: 'الفاتحة' }], newMadi: [] });
    await userEvent.clear(startAyahBox('الفاتحة'));
    await userEvent.type(startAyahBox('الفاتحة'), '3');
    expect(endAyahBox('الفاتحة')).toHaveValue(7);
    await saveAndConfirm();

    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(2));
    expect(savedById('r_prev')!.newLoh).toEqual([{ sura: 'الفاتحة', from: '3', to: '7' }]);
  });

  it('emptying «من» puts the row back — no phantom correction is saved', async () => {
    await openWithPrev(prevSession);
    const box = startAyahBox('البقرة');
    await userEvent.clear(box);
    await userEvent.type(box, '4');
    await userEvent.clear(box);
    await saveAndConfirm();

    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
    expect(savedById('r_prev')).toBeUndefined();
  });

  it('blocks the save when «من» comes after «إلى», naming the row', async () => {
    await openWithPrev(prevSession);
    const box = startAyahBox('البقرة');
    await userEvent.clear(box);
    await userEvent.type(box, '15');
    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));

    expect(await screen.findByText(/البقرة.*آية البداية بعد آية النهاية/)).toBeInTheDocument();
    expect(saveRecordMock).not.toHaveBeenCalled();
  });

  it('blocks a «من» beyond the sura, and switches to the الماضي tab for a madi row', async () => {
    await openWithPrev(prevSession);
    await userEvent.click(screen.getByRole('button', { name: /^📗 اللوح/ }));
    const box = startAyahBox('آل عمران');
    await userEvent.clear(box);
    await userEvent.type(box, '300');
    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));

    expect(await screen.findByText(/آل عمران.*السورة 200 آية بس/)).toBeInTheDocument();
    expect(saveRecordMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^📙 الماضي/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
