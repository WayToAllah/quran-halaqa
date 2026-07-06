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
}));

function renderScreen() {
  return render(
    <ToastProvider>
      <LogScreen />
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
    const row = screen.getByText('محمد علي').closest('.rounded-xl') as HTMLElement;
    expect(within(row).queryByRole('button', { name: 'تعديل' })).not.toBeInTheDocument();
  });

  it('resolves student names via displayStudentName', () => {
    renderScreen();
    expect(screen.getByText('زيد احمد')).toBeInTheDocument();
    expect(screen.getByText('محمد علي')).toBeInTheDocument();
  });
});

describe('LogScreen — search', () => {
  it('filters entries by student name, normalized', async () => {
    renderScreen();
    await userEvent.type(screen.getByPlaceholderText('🔍 ابحث باسم الطالب...'), 'احمد');
    expect(screen.getByText('زيد احمد')).toBeInTheDocument();
    expect(screen.queryByText('محمد علي')).not.toBeInTheDocument();
  });

  it('hides the load-more button while a search is active', async () => {
    renderScreen();
    expect(screen.getByRole('button', { name: 'تحميل المزيد' })).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('🔍 ابحث باسم الطالب...'), 'زيد');
    expect(screen.queryByRole('button', { name: 'تحميل المزيد' })).not.toBeInTheDocument();
  });
});

describe('LogScreen — delete with undo', () => {
  it('hides the entry immediately and does not call deleteRecord until the undo window passes', async () => {
    renderScreen();
    const row = screen.getByText('محمد علي').closest('.rounded-xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));

    expect(screen.queryByText('محمد علي')).not.toBeInTheDocument();
    expect(screen.getByText(/تم حذف حضور محمد علي/)).toBeInTheDocument();
    expect(deleteRecordMock).not.toHaveBeenCalled();
  });

  it('respects a cancelled confirm() and keeps the entry', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    renderScreen();
    const row = screen.getByText('زيد احمد').closest('.rounded-xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));
    expect(screen.getByText('زيد احمد')).toBeInTheDocument();
    expect(deleteRecordMock).not.toHaveBeenCalled();
  });
});

describe('LogScreen — edit (stub)', () => {
  it('shows a "coming soon" toast instead of navigating (تسجيل screen not built yet)', async () => {
    renderScreen();
    const row = screen.getByText('زيد احمد').closest('.rounded-xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'تعديل' }));
    expect(screen.getByText(/قريباً/)).toBeInTheDocument();
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
