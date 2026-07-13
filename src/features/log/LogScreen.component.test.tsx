import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { LogScreen } from './LogScreen';
import type { SessionRecord, Student } from '../../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'محمد علي' },
];

const records: SessionRecord[] = [
  {
    id: 'r1',
    studentId: 's_1',
    date: '2026-07-03',
    loh: { score: 0 }, // genuine zero — must render as إعادة, not blank
    newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
  },
  {
    id: 'r2',
    studentId: 's_2',
    date: '2026-07-02',
    attendance_only: true,
  },
];

let hasMoreValue = true;
const loadMoreMock = vi.fn();
const deleteRecordMock = vi.fn().mockResolvedValue(undefined);

// Server-side search fetches every matching student's full history. The mock
// returns the fixture records filtered by studentId, simulating Firestore.
const getAllRecordsForStudentMock = vi.fn((_m: string, _h: string, studentId: string) =>
  Promise.resolve(records.filter((r) => r.studentId === studentId)),
);

vi.mock('../../hooks/useRecentRecords', () => ({
  useRecentRecords: () => ({
    records,
    loaded: true,
    loadMore: loadMoreMock,
    loadingMore: false,
    hasMore: hasMoreValue,
  }),
}));
vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../data/records.repo', () => ({
  deleteRecord: (...args: unknown[]) => deleteRecordMock(...args),
  getAllRecordsForStudent: (m: string, h: string, id: string) => getAllRecordsForStudentMock(m, h, id),
}));
// See RecordScreen.component.test.tsx: republish is fire-and-forget after a
// delete and must be mocked so it never reaches unmocked repo exports.
vi.mock('../../data/publishStats', () => ({
  republishPublicStatsFor: vi.fn().mockResolvedValue(undefined),
}));

function renderScreen(props: { onEditRecord?: (r: SessionRecord) => void } = {}) {
  return render(
    <ToastProvider>
      <LogScreen onEditRecord={props.onEditRecord} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hasMoreValue = true;
  vi.stubGlobal('confirm', vi.fn(() => true));
});

describe('LogScreen — rendering', () => {
  it('shows a genuine zero score as إعادة, not blank (scoreName(0) regression)', () => {
    renderScreen();
    expect(screen.getByText(/إعادة/)).toBeInTheDocument();
  });

  it('shows the new-assignment sura for a real session', () => {
    renderScreen();
    expect(screen.getByText(/لوح جديد.*البقرة/)).toBeInTheDocument();
  });

  it('shows "حضور فقط" for an attendance-only entry, with no edit button', () => {
    renderScreen();
    expect(screen.getByText('✅ حضور فقط')).toBeInTheDocument();
    const row = screen.getByText('محمد علي').closest('.rounded-2xl') as HTMLElement;
    expect(within(row).queryByRole('button', { name: 'تعديل' })).not.toBeInTheDocument();
  });

  it('hands the session up to onEditRecord when ✏️ is tapped', async () => {
    const onEditRecord = vi.fn();
    renderScreen({ onEditRecord });
    const row = screen.getByText('زيد احمد').closest('.rounded-2xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'تعديل' }));
    expect(onEditRecord).toHaveBeenCalledTimes(1);
    expect(onEditRecord.mock.calls[0][0].id).toBe('r1');
  });

  it('resolves student names via displayStudentName', () => {
    renderScreen();
    expect(screen.getByText('زيد احمد')).toBeInTheDocument();
    expect(screen.getByText('محمد علي')).toBeInTheDocument();
  });
});

describe('LogScreen — search', () => {
  it('fetches and shows every matching student (server-side, not loaded-only)', async () => {
    renderScreen();
    await userEvent.type(screen.getByPlaceholderText('ابحث باسم الطالب…'), 'احمد');
    // resolves after the debounce + fetch
    expect(await screen.findByText('زيد احمد')).toBeInTheDocument();
    expect(screen.queryByText('محمد علي')).not.toBeInTheDocument();
    expect(getAllRecordsForStudentMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      's_1',
    );
  });

  it('shows a no-results message when no student name matches', async () => {
    renderScreen();
    await userEvent.type(screen.getByPlaceholderText('ابحث باسم الطالب…'), 'اسم غير موجود');
    expect(await screen.findByText(/لا يوجد نتائج/)).toBeInTheDocument();
    // no student matched, so no Firestore fetch is issued
    expect(getAllRecordsForStudentMock).not.toHaveBeenCalled();
  });

  it('hides the load-more button while a search is active', async () => {
    renderScreen();
    expect(screen.getByRole('button', { name: 'تحميل المزيد' })).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('ابحث باسم الطالب…'), 'زيد');
    expect(screen.queryByRole('button', { name: 'تحميل المزيد' })).not.toBeInTheDocument();
  });
});

describe('LogScreen — delete with undo', () => {
  it('hides the entry immediately and does not call deleteRecord until the undo window passes', async () => {
    renderScreen();
    const row = screen.getByText('محمد علي').closest('.rounded-2xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));

    expect(screen.queryByText('محمد علي')).not.toBeInTheDocument();
    expect(screen.getByText(/تم حذف حضور محمد علي/)).toBeInTheDocument();
    expect(deleteRecordMock).not.toHaveBeenCalled();
  });

  it('respects a cancelled confirm() and keeps the entry', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    renderScreen();
    const row = screen.getByText('زيد احمد').closest('.rounded-2xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));
    expect(screen.getByText('زيد احمد')).toBeInTheDocument();
    expect(deleteRecordMock).not.toHaveBeenCalled();
  });
});

describe('LogScreen — edit', () => {
  it('hands the clicked record up to onEditRecord', async () => {
    const onEditRecord = vi.fn();
    render(
      <ToastProvider>
        <LogScreen onEditRecord={onEditRecord} />
      </ToastProvider>,
    );
    const row = screen.getByText('زيد احمد').closest('.rounded-2xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'تعديل' }));
    expect(onEditRecord).toHaveBeenCalledTimes(1);
    expect(onEditRecord.mock.calls[0][0].id).toBe('r1');
  });
});

describe('LogScreen — load more', () => {
  it('calls loadMore when the button is clicked', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'تحميل المزيد' }));
    expect(loadMoreMock).toHaveBeenCalledTimes(1);
  });

  it('hides the load-more button once hasMore is false', () => {
    hasMoreValue = false;
    renderScreen();
    expect(screen.queryByRole('button', { name: 'تحميل المزيد' })).not.toBeInTheDocument();
  });
});
