import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { GroupAttendanceModal } from './GroupAttendanceModal';
import type { SessionRecord, Student } from '../../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'محمد علي' },
];

let recordsForDate: SessionRecord[] = [];
const saveRecordMock = vi.fn().mockResolvedValue(undefined);
const getRecordsByDateMock = vi.fn((..._args: unknown[]) => Promise.resolve(recordsForDate));

vi.mock('../../data/records.repo', () => ({
  getRecordsByDate: (...args: unknown[]) => getRecordsByDateMock(...args),
  saveRecord: (...args: unknown[]) => saveRecordMock(...args),
}));

function renderModal(onClose = vi.fn()) {
  const result = render(
    <ToastProvider>
      <GroupAttendanceModal initialDate="2026-07-06" students={students} onClose={onClose} />
    </ToastProvider>,
  );
  return { onClose, ...result };
}

beforeEach(() => {
  vi.clearAllMocks();
  recordsForDate = [];
});

describe('GroupAttendanceModal', () => {
  it('lists all students once the day-check completes', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText('زيد احمد')).toBeInTheDocument());
    expect(screen.getByText('محمد علي')).toBeInTheDocument();
  });

  it('disables and labels a student who already has a record that day', async () => {
    recordsForDate = [{ id: 'r1', studentId: 's_1', date: '2026-07-06' }];
    renderModal();
    await waitFor(() => expect(screen.getByText('مسجّل بالفعل')).toBeInTheDocument());
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0]).toBeDisabled(); // زيد (sorted, but let's just check by name below)
  });

  it('re-fetches day coverage when the date changes', async () => {
    renderModal();
    await waitFor(() => expect(getRecordsByDateMock).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), '2026-07-06',
    ));
    const dateInput = screen.getByDisplayValue('2026-07-06');
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, '2026-07-07');
    await waitFor(() => expect(getRecordsByDateMock).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), '2026-07-07',
    ));
  });

  it('selects/deselects all eligible students via the toggle', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText('زيد احمد')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'تحديد الكل / إلغاء' }));
    expect(screen.getByText('2 محدد')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'تحديد الكل / إلغاء' }));
    expect(screen.getByText('0 محدد')).toBeInTheDocument();
  });

  it('rejects saving with nothing checked', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText('زيد احمد')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '✅ حفظ الحضور' }));
    expect(screen.getByText('اختر طالباً واحداً على الأقل')).toBeInTheDocument();
    expect(saveRecordMock).not.toHaveBeenCalled();
  });

  it('saves attendance-only records only for checked, eligible students and closes on success', async () => {
    recordsForDate = [{ id: 'r1', studentId: 's_1', date: '2026-07-06' }]; // زيد already covered
    const onClose = vi.fn();
    renderModal(onClose);
    await waitFor(() => expect(screen.getByText('محمد علي')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'تحديد الكل / إلغاء' })); // selects only eligible (محمد)

    await userEvent.click(screen.getByRole('button', { name: '✅ حفظ الحضور' }));
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
    const savedRecord = saveRecordMock.mock.calls[0][2];
    expect(savedRecord.studentId).toBe('s_2');
    expect(savedRecord.attendance_only).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });
});
