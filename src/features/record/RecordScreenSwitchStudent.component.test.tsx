import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { RecordScreen } from './RecordScreen';
import type { ComponentProps } from 'preact';
import { DraftGuardProvider } from '../tenant/DraftGuard';
import type { SessionRecord, Student } from '../../types';

// The REAL usePreviousSession, over a records fetch each test resolves by hand,
// so a student can be switched while the last one's records are still loading
// — what a teacher does on a slow connection.
const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'عمر خالد' },
];
const pending = new Map<string, (r: SessionRecord[]) => void>();
vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../data/records.repo', () => ({
  getAllRecordsForStudent: (_m: string, _h: string, id: string) =>
    new Promise<SessionRecord[]>((res) => pending.set(id, res)),
  saveRecord: vi.fn().mockResolvedValue(undefined),
  getRecordsByDate: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../data/publishStats', () => ({
  republishPublicStatsFor: vi.fn().mockResolvedValue(undefined),
}));

const last = (studentId: string, sura: string, to: string): SessionRecord => ({
  id: 'r_' + studentId,
  studentId,
  date: '2026-11-10',
  loh: { score: 95, stars: 4 },
  madi: { score: 95, stars: 4 },
  newLoh: [{ sura, from: '1', to }],
});

async function selectStudent(name: string) {
  const input = screen.getByPlaceholderText('ابحث أو اختر اسم الطالب…');
  await userEvent.click(input);
  await userEvent.clear(input);
  await userEvent.type(input, name);
  await userEvent.click(screen.getByRole('button', { name }));
  const startOver = screen.queryByRole('button', { name: /ابدأ من جديد/ });
  if (startOver) await userEvent.click(startOver);
}

beforeEach(() => pending.clear());

async function answer(id: string, recs: SessionRecord[]) {
  await waitFor(() => expect(pending.has(id)).toBe(true));
  await act(async () => pending.get(id)!(recs));
}

describe('RecordScreen — switching students before their records load', () => {
  it("never fills the new student's loh from the previous student's session", async () => {
    render(
      <ToastProvider>
        <DraftGuardProvider>
          <RecordScreen editRecord={null} />
        </DraftGuardProvider>
      </ToastProvider>,
    );
    await selectStudent('زيد احمد');
    await answer('s_1', [last('s_1', 'النبأ', '10')]);
    await waitFor(() => expect(screen.getAllByDisplayValue('النبأ').length).toBeGreaterThan(0));

    // Switch to عمر; his records are still on their way.
    await selectStudent('عمر خالد');
    await waitFor(() => expect(screen.getByText(/بنجيب آخر جلسة للطالب/)).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryAllByDisplayValue('النبأ')).toHaveLength(0);

    // When they arrive, his own continuation is suggested.
    await answer('s_2', [last('s_2', 'الملك', '30')]);
    await waitFor(() => expect(screen.getAllByDisplayValue('التحريم').length).toBeGreaterThan(0));
    expect(screen.queryAllByDisplayValue('النبأ')).toHaveLength(0);
  });
});

describe("RecordScreen — opening another student's session for edit", () => {
  it("grades the edited session against ITS student's previous session, not the last one on screen", async () => {
    const tree = (props: ComponentProps<typeof RecordScreen>) => (
      <ToastProvider>
        <DraftGuardProvider>
          <RecordScreen {...props} />
        </DraftGuardProvider>
      </ToastProvider>
    );
    const { rerender } = render(tree({ editRecord: null }));
    await selectStudent('زيد احمد');
    await answer('s_1', [last('s_1', 'النبأ', '10')]);
    await waitFor(() => expect(screen.getAllByDisplayValue('النبأ').length).toBeGreaterThan(0));

    // From the log: ✏️ on عمر's session of today. His earlier session (الملك)
    // is what today's scores grade; it is still loading.
    pending.delete('s_2');
    const today: SessionRecord = {
      id: 'r_today_omar',
      studentId: 's_2',
      student: 'عمر خالد',
      date: '2026-11-12',
      loh: { score: 90, stars: 4 },
      madi: { score: 90, stars: 4 },
      newLoh: [{ sura: 'التحريم', from: '1', to: '12' }],
    };
    rerender(tree({ editRecord: today, onEditConsumed: () => {} }));
    await waitFor(() =>
      expect(
        (screen.getByPlaceholderText('ابحث أو اختر اسم الطالب…') as HTMLInputElement).value,
      ).toBe('عمر خالد'),
    );
    await new Promise((r) => setTimeout(r, 50));
    // زيد's النبأ must not show up anywhere in عمر's edit — not in the card that
    // says what is being graded, not as a row.
    expect(screen.queryByText(/النبأ/)).toBeNull();
    expect(screen.queryAllByDisplayValue('النبأ')).toHaveLength(0);

    await answer('s_2', [
      { ...last('s_2', 'الملك', '30'), id: 'r_prev_omar', date: '2026-11-10' },
      today,
    ]);
    await waitFor(() => expect(screen.getAllByDisplayValue('الملك').length).toBeGreaterThan(0));
    expect(screen.queryByText(/النبأ/)).toBeNull();
    expect(screen.queryAllByDisplayValue('النبأ')).toHaveLength(0);
  });
});
