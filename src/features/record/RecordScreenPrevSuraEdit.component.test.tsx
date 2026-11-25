import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { RecordScreen } from './RecordScreen';
import { DraftGuardProvider } from '../tenant/DraftGuard';
import type { SessionRecord, Student } from '../../types';

// The teacher's report: when last session's assignment names the wrong sura,
// fixing it meant leaving the record screen and editing the OLD session from
// the log. The sura in the evaluation card is now editable in place, and the
// correction saves onto that past session alongside today's.

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
vi.mock('../../data/publishStats', () => ({
  republishPublicStatsFor: vi.fn().mockResolvedValue(undefined),
}));

function renderScreen() {
  return render(
    <ToastProvider>
      <DraftGuardProvider>
        <RecordScreen editRecord={null} onEditConsumed={() => {}} />
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
  await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
  await userEvent.click(await screen.findByRole('button', { name: /احفظ بدون إرسال|احفظ الجلسة/ }));
}

const prevSession: SessionRecord = {
  id: 'r_prev',
  studentId: 's_1',
  student: 'زيد احمد',
  date: '2026-07-20',
  newLoh: [{ sura: 'النازعات', from: '1', to: '10' }],
  newMadi: [{ sura: 'آل عمران', from: '1', to: '20' }],
};

async function pickSura(box: HTMLElement, name: string) {
  await userEvent.clear(box);
  await userEvent.type(box, name.slice(0, -1));
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`\\. ${name}`) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  previousSessionForS1 = prevSession;
});

describe('RecordScreen — changing the sura of the previous session from the eval card', () => {
  it('shows the sura as an editable field, pre-filled', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');
    expect(screen.getByLabelText('تعديل سورة النازعات')).toHaveValue('النازعات');
    expect(screen.getByLabelText('تعديل سورة آل عمران')).toHaveValue('آل عمران');
  });

  it('saves the new sura and range on the PREVIOUS record', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    await pickSura(screen.getByLabelText('تعديل سورة النازعات'), 'النبأ');
    // Picking a new sura starts it as the whole sura; the teacher shortens it.
    expect(screen.getByLabelText('آخر آية اتحفظت في النازعات')).toHaveValue(40);
    const end = screen.getByLabelText('آخر آية اتحفظت في النازعات');
    await userEvent.clear(end);
    await userEvent.type(end, '16');

    await saveAndConfirm();
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(2));
    const saved = saveRecordMock.mock.calls.map((c) => c[2] as SessionRecord);
    const savedPrev = saved.find((r) => r.id === 'r_prev')!;
    expect(savedPrev.newLoh).toEqual([{ sura: 'النبأ', from: '1', to: '16' }]);
    expect(savedPrev.newMadi).toEqual([{ sura: 'آل عمران', from: '1', to: '20' }]);
  });

  it('leaves the row unchanged while the typed text matches no sura, and restores it on blur', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    const box = screen.getByLabelText('تعديل سورة النازعات');
    await userEvent.clear(box);
    await userEvent.type(box, 'النب');
    await userEvent.click(document.body);
    await waitFor(() => expect(box).toHaveValue('النازعات'));

    await saveAndConfirm();
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
  });
});
