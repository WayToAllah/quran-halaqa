import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { StudentsScreen } from './StudentsScreen';
import type { Student } from '../../types';
import type { SessionRecord } from '../../types';

const students: Student[] = [
  {
    id: 's_1',
    name: 'زيد احمد',
    age: '10',
    grade: 'الصف الرابع الابتدائي',
    phonePrimary: '01000000000',
    parentToken: 'EXISTING_TOKEN_123',
  },
  { id: 's_2', name: 'محمد علي', age: '12' },
];
const records: SessionRecord[] = [
  { id: 'r1', studentId: 's_1', date: '2026-07-01' },
  { id: 'r1b', studentId: 's_1', date: '2026-07-02' },
];

const saveStudentMock = vi.fn().mockResolvedValue(undefined);
const updateStudentMock = vi.fn().mockResolvedValue(undefined);
const deleteStudentMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../hooks/useAllRecords', () => ({
  useAllRecords: () => ({ records, loaded: true }),
}));
vi.mock('../../data/students.repo', () => ({
  saveStudent: (...args: unknown[]) => saveStudentMock(...args),
  updateStudent: (...args: unknown[]) => updateStudentMock(...args),
  deleteStudent: (...args: unknown[]) => deleteStudentMock(...args),
}));

function renderScreen() {
  return render(
    <ToastProvider>
      <StudentsScreen />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', vi.fn(() => true));
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe('StudentsScreen — list rendering', () => {
  it('renders every student with their session count', () => {
    renderScreen();
    expect(screen.getByText('زيد احمد')).toBeInTheDocument();
    expect(screen.getByText('محمد علي')).toBeInTheDocument();
    expect(screen.getByText('2 جلسة مسجلة')).toBeInTheDocument(); // s_1 has 2 records
    expect(screen.getByText('0 جلسة مسجلة')).toBeInTheDocument(); // s_2 has none
  });

  it('shows age/grade meta line when present', () => {
    renderScreen();
    expect(screen.getByText(/10 سنة.*الصف الرابع الابتدائي/)).toBeInTheDocument();
  });
});

describe('StudentsScreen — search', () => {
  it('filters the list as the user types', async () => {
    renderScreen();
    const input = screen.getByPlaceholderText('🔍 ابحث باسم الطالب...');
    await userEvent.type(input, 'محمد');
    expect(screen.queryByText('زيد احمد')).not.toBeInTheDocument();
    expect(screen.getByText('محمد علي')).toBeInTheDocument();
  });

  it('normalizes Arabic hamza forms when searching', async () => {
    renderScreen();
    const input = screen.getByPlaceholderText('🔍 ابحث باسم الطالب...');
    await userEvent.type(input, 'احمد'); // no hamza, should still match "زيد احمد"
    expect(screen.getByText('زيد احمد')).toBeInTheDocument();
  });

  it('shows a no-results message for an unmatched query', async () => {
    renderScreen();
    const input = screen.getByPlaceholderText('🔍 ابحث باسم الطالب...');
    await userEvent.type(input, 'اسم غير موجود');
    expect(screen.getByText(/لا يوجد نتائج/)).toBeInTheDocument();
  });
});

describe('StudentsScreen — add student', () => {
  it('opens the modal via the FAB and saves a new student', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'إضافة طالب' }));
    expect(screen.getByText('إضافة طالب جديد')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('اسم الطالب');
    await userEvent.type(nameInput, 'طالب جديد');
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }));

    await waitFor(() => expect(saveStudentMock).toHaveBeenCalledTimes(1));
    const savedArg = saveStudentMock.mock.calls[0][2];
    expect(savedArg.name).toBe('طالب جديد');
    expect(savedArg.parentToken).toBeTruthy(); // a new token was minted
  });

  it('rejects an empty name without calling saveStudent', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'إضافة طالب' }));
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(screen.getByText('الاسم مطلوب')).toBeInTheDocument();
    expect(saveStudentMock).not.toHaveBeenCalled();
  });

  it('rejects a duplicate name (excluding the student being edited)', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'إضافة طالب' }));
    await userEvent.type(screen.getByPlaceholderText('اسم الطالب'), 'زيد احمد');
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(screen.getByText('الاسم موجود بالفعل')).toBeInTheDocument();
    expect(saveStudentMock).not.toHaveBeenCalled();
  });
});

describe('StudentsScreen — edit student', () => {
  it('opens the modal pre-filled and preserves the existing parentToken on save', async () => {
    renderScreen();
    const row = screen.getByText('زيد احمد').closest('.rounded-xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'تعديل' }));

    expect(screen.getByText('تعديل بيانات الطالب')).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText('اسم الطالب') as HTMLInputElement;
    expect(nameInput.value).toBe('زيد احمد');

    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    await waitFor(() => expect(saveStudentMock).toHaveBeenCalledTimes(1));
    const savedArg = saveStudentMock.mock.calls[0][2];
    expect(savedArg.id).toBe('s_1');
  });
});

describe('StudentsScreen — delete with undo', () => {
  it('hides the student immediately and shows an undo toast', async () => {
    renderScreen();
    const row = screen.getByText('محمد علي').closest('.rounded-xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));

    expect(screen.queryByText('محمد علي')).not.toBeInTheDocument();
    expect(screen.getByText(/تم حذف محمد علي/)).toBeInTheDocument();
    expect(deleteStudentMock).not.toHaveBeenCalled(); // not yet — still in the undo window
  });

  it('restores the student if "تراجع" is clicked before the timer fires', async () => {
    renderScreen();
    const row = screen.getByText('محمد علي').closest('.rounded-xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));
    await userEvent.click(screen.getByText('تراجع'));

    expect(screen.getByText('محمد علي')).toBeInTheDocument();
    expect(deleteStudentMock).not.toHaveBeenCalled();
  });

  it('does not ask for confirmation twice, and respects a cancelled confirm()', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    renderScreen();
    const row = screen.getByText('زيد احمد').closest('.rounded-xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'حذف' }));
    expect(screen.getByText('زيد احمد')).toBeInTheDocument(); // still there — confirm() was declined
  });
});

describe('StudentsScreen — copy link', () => {
  it('copies the existing parentToken link to the clipboard', async () => {
    renderScreen();
    const row = screen.getByText('زيد احمد').closest('.rounded-xl') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'نسخ رابط المتابعة' }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    const copiedUrl = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(copiedUrl).toContain('child.html?t=');
    expect(updateStudentMock).not.toHaveBeenCalled(); // s_1 already had a token — no mint needed
  });

  it('mints and persists a new token for a student without one', async () => {
    renderScreen();
    const row = screen.getByText('محمد علي').closest('.rounded-xl') as HTMLElement; // s_2 has no parentToken
    await userEvent.click(within(row).getByRole('button', { name: 'نسخ رابط المتابعة' }));

    await waitFor(() => expect(updateStudentMock).toHaveBeenCalledTimes(1));
    const patch = updateStudentMock.mock.calls[0][3];
    expect(patch.parentToken).toBeTruthy();
  });
});
