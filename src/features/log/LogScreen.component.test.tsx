import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { LogScreen } from './LogScreen';
import type { SessionRecord, Student } from '../../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'محمد علي' },
  { id: 's_3', name: 'سالم' },
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
  // A marked pair on its own student, so the delete-warning tests don't
  // disturb the fixtures the rendering tests assert against.
  // r_a hands out an assignment; r_b marks it.
  {
    id: 'r_b',
    studentId: 's_3',
    date: '2026-07-05',
    loh: { score: 85 },
  },
  {
    id: 'r_a',
    studentId: 's_3',
    date: '2026-07-01',
    newLoh: [{ sura: 'الفاتحة', from: '1', to: '7' }],
  },
];

let hasMoreValue = true;
const loadMoreMock = vi.fn();
const deleteRecordMock = vi.fn().mockResolvedValue(undefined);
const saveRecordMock = vi.fn().mockResolvedValue(undefined);

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
  saveRecord: (...args: unknown[]) => saveRecordMock(...args),
  getAllRecordsForStudent: (m: string, h: string, id: string) =>
    getAllRecordsForStudentMock(m, h, id),
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
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});

describe('LogScreen — rendering', () => {
  it('shows a genuine zero score as إعادة, not blank (scoreName(0) regression)', () => {
    renderScreen();
    // Scoped to the card: "إعادة" is also a filter tab above the list.
    const row = screen.getByText('زيد احمد').closest('.rounded-2xl') as HTMLElement;
    expect(within(row).getByText(/إعادة/)).toBeInTheDocument();
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

describe('LogScreen — day grouping', () => {
  it('heads each halaqa day with its date and how many were recorded', () => {
    renderScreen();
    // 3 July: زيد's session. 5 July and 1 July: سالم's pair. 2 July: محمد.
    expect(screen.getByText(/٣ يوليو/)).toBeInTheDocument();
    const headings = screen.getAllByText(/جلسة$/);
    expect(headings.length).toBeGreaterThan(1);
    // Each fixture day here holds exactly one session.
    expect(screen.getAllByText('١ جلسة').length).toBeGreaterThan(0);
  });

  it('groups the cards under their own day, newest day first', () => {
    renderScreen();
    const text = document.body.textContent ?? '';
    // 5 July (سالم) must appear before 3 July (زيد) in document order.
    expect(text.indexOf('٥ يوليو')).toBeLessThan(text.indexOf('٣ يوليو'));
  });

  it('drops the now-duplicated date from the cards themselves', () => {
    renderScreen();
    const row = screen.getByText('زيد احمد').closest('.rounded-2xl') as HTMLElement;
    expect(within(row).queryByText(/يوليو/)).not.toBeInTheDocument();
  });
});

describe('LogScreen — filters', () => {
  it('starts on الكل with nothing filtered out', () => {
    renderScreen();
    expect(screen.getByRole('tab', { name: 'الكل' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('زيد احمد')).toBeInTheDocument();
    expect(screen.getByText('محمد علي')).toBeInTheDocument();
  });

  it('narrows to sessions marked إعادة', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('tab', { name: 'إعادة' }));

    // زيد's session scored 0 — a genuine إعادة.
    expect(screen.getByText('زيد احمد')).toBeInTheDocument();
    // محمد is attendance-only; سالم passed with 85.
    expect(screen.queryByText('محمد علي')).not.toBeInTheDocument();
    expect(screen.queryByText('سالم')).not.toBeInTheDocument();
  });

  it('narrows to attendance-only rows', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('tab', { name: 'حضور فقط' }));

    expect(screen.getByText('محمد علي')).toBeInTheDocument();
    expect(screen.queryByText('زيد احمد')).not.toBeInTheDocument();
  });

  it('explains an empty list as the filter, not an empty log', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('tab', { name: 'فيها تجويد' }));

    expect(screen.getByText(/لا يوجد جلسات تحت "فيها تجويد"/)).toBeInTheDocument();
    expect(screen.queryByText('لا يوجد جلسات مسجلة بعد')).not.toBeInTheDocument();
  });

  it('combines with the search rather than overriding it', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('tab', { name: 'حضور فقط' }));
    await userEvent.type(screen.getByLabelText('ابحث في السجل باسم الطالب'), 'زيد');

    // زيد matches the search but has no attendance-only row.
    expect(await screen.findByText(/لا يوجد نتائج/)).toBeInTheDocument();
  });
});

describe('LogScreen — search box', () => {
  it('clears the search in one tap and shows the full list again', async () => {
    renderScreen();
    await userEvent.type(screen.getByLabelText('ابحث في السجل باسم الطالب'), 'محمد');
    await screen.findByText('محمد علي');
    expect(screen.queryByText('زيد احمد')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'مسح البحث' }));

    expect(await screen.findByText('زيد احمد')).toBeInTheDocument();
  });
});

describe('LogScreen — delete with undo', () => {
  /** Row delete button + the in-app confirmation that stands in front of it. */
  async function deleteRow(name: string) {
    const row = screen.getByText(name).closest('.rounded-2xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));
    await userEvent.click(screen.getByRole('button', { name: 'احذف' }));
  }

  it('commits the delete straight away rather than waiting out the undo window', async () => {
    // The old behaviour only scheduled the delete: closing the app inside the
    // five seconds meant it never happened and the row silently came back.
    renderScreen();
    await deleteRow('محمد علي');

    expect(screen.queryByText('محمد علي')).not.toBeInTheDocument();
    await waitFor(() => expect(deleteRecordMock).toHaveBeenCalledTimes(1));
    expect(deleteRecordMock.mock.calls[0][2]).toBe('r2');
    expect(await screen.findByText(/تم حذف حضور محمد علي/)).toBeInTheDocument();
  });

  it('writes the record back under the same id when "تراجع" is tapped', async () => {
    renderScreen();
    await deleteRow('محمد علي');
    await userEvent.click(await screen.findByRole('button', { name: 'تراجع' }));

    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
    // Byte-identical restore: same id, so the session slots back into place.
    expect((saveRecordMock.mock.calls[0][2] as SessionRecord).id).toBe('r2');
    expect(screen.getByText('محمد علي')).toBeInTheDocument();
  });

  it('puts the row back and says so when the delete itself fails', async () => {
    deleteRecordMock.mockRejectedValueOnce(new Error('offline'));
    renderScreen();
    await deleteRow('محمد علي');

    // No success toast over a delete that did not happen.
    expect(await screen.findByText(/فشل الحذف/)).toBeInTheDocument();
    expect(screen.getByText('محمد علي')).toBeInTheDocument();
  });

  it('keeps the entry when the confirmation is declined', async () => {
    renderScreen();
    const row = screen.getByText('زيد احمد').closest('.rounded-2xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));
    await userEvent.click(screen.getByRole('button', { name: 'إلغاء' }));

    expect(screen.getByText('زيد احمد')).toBeInTheDocument();
    expect(deleteRecordMock).not.toHaveBeenCalled();
  });

  // The browser's confirm() is unstyled, blocks the page and reads as a system
  // error on a phone — and it had no room to explain what a delete breaks.
  it('names the session that marked this one, so the teacher knows what breaks', async () => {
    renderScreen();
    // سالم's 1 July session handed out the assignment his 5 July session marked.
    const rows = screen.getAllByText('سالم');
    const row = rows[rows.length - 1].closest('.rounded-2xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));

    expect(screen.getByText(/متقيّم في جلسة/)).toBeInTheDocument();
    expect(screen.getByText(/التقييم ده هيفضل من غير التكليف/)).toBeInTheDocument();
  });

  it('does not cry wolf when nothing marks the session', async () => {
    renderScreen();
    // 5 July is سالم's newest session — nothing has marked it yet.
    const row = screen.getAllByText('سالم')[0].closest('.rounded-2xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));

    expect(screen.queryByText(/متقيّم في جلسة/)).not.toBeInTheDocument();
  });

  it("asks in the app's own dialog, not the browser's", async () => {
    renderScreen();
    const row = screen.getByText('زيد احمد').closest('.rounded-2xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('حذف جلسة زيد احمد؟')).toBeInTheDocument();
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
