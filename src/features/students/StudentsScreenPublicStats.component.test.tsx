import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { StudentsScreen } from './StudentsScreen';
import { DEFAULT_TENANT } from '../../config';
import type { SessionRecord, Student } from '../../types';

/**
 * publicStats is a *projection*: the parent page reads a standalone document
 * keyed by the family's token, and that document carries its own copy of the
 * student's name. Nothing on this screen used to refresh it, so:
 *
 *   - renaming a student left the old name on the parent page until their next
 *     session happened to be recorded;
 *   - a brand-new student had no projection document at all, so the link the
 *     teacher copied and sent on WhatsApp opened an error page;
 *   - deleting a student left their projection behind, publicly readable at a
 *     token that was already sent to a family, forever.
 */
const students: Student[] = [
  { id: 's_1', name: 'زيد احمد', age: '10', parentToken: 'EXISTING_TOKEN_123' },
  { id: 's_2', name: 'محمد علي', age: '12' },
];
const records: SessionRecord[] = [{ id: 'r1', studentId: 's_1', date: '2026-07-01' }];

const saveStudentMock = vi.fn().mockResolvedValue(undefined);
const updateStudentMock = vi.fn().mockResolvedValue(undefined);
const deleteStudentMock = vi.fn().mockResolvedValue(undefined);
const republishMock = vi.fn().mockResolvedValue(undefined);
const deletePublicStatsMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../hooks/useAllRecords', () => ({
  useAllRecords: () => ({ records, loaded: true }),
}));
vi.mock('../../data/students.repo', () => ({
  saveStudent: (...a: unknown[]) => saveStudentMock(...a),
  updateStudent: (...a: unknown[]) => updateStudentMock(...a),
  deleteStudent: (...a: unknown[]) => deleteStudentMock(...a),
}));
vi.mock('../../data/publishStats', () => ({
  republishPublicStatsFor: (...a: unknown[]) => republishMock(...a),
}));
vi.mock('../../data/publicStats.repo', () => ({
  deletePublicStats: (...a: unknown[]) => deletePublicStatsMock(...a),
}));

function renderScreen() {
  return render(
    <ToastProvider>
      <StudentsScreen />
    </ToastProvider>,
  );
}

function rowOf(name: string) {
  return screen.getByText(name).closest('.rounded-2xl') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe('StudentsScreen — parent page stays in sync', () => {
  it('republishes when a link is copied, so the family never opens an empty page', async () => {
    renderScreen();
    await userEvent.click(
      within(rowOf('زيد احمد')).getByRole('button', { name: 'نسخ رابط المتابعة' }),
    );

    await waitFor(() => expect(republishMock).toHaveBeenCalledTimes(1));
    expect(republishMock.mock.calls[0][0]).toEqual(DEFAULT_TENANT);
    expect(republishMock.mock.calls[0][1]).toEqual(['s_1']);
  });

  it('republishes the freshly minted token too', async () => {
    renderScreen();
    // s_2 has no token yet: the projection is written under the token that was
    // just minted, not under nothing.
    await userEvent.click(
      within(rowOf('محمد علي')).getByRole('button', { name: 'نسخ رابط المتابعة' }),
    );

    await waitFor(() => expect(updateStudentMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(republishMock).toHaveBeenCalledWith(DEFAULT_TENANT, ['s_2']));
  });

  it('removes the projection when a student is deleted', async () => {
    renderScreen();
    await userEvent.click(within(rowOf('زيد احمد')).getByRole('button', { name: 'حذف' }));
    await userEvent.click(screen.getByRole('button', { name: 'احذف الطالب' }));

    await waitFor(() => expect(deleteStudentMock).toHaveBeenCalledTimes(1));
    // Their token was already sent to a family; leaving the document behind
    // keeps an ex-student's name and scores world-readable indefinitely.
    await waitFor(() => expect(deletePublicStatsMock).toHaveBeenCalledWith('EXISTING_TOKEN_123'));
  });

  it('rebuilds the projection when the delete is undone', async () => {
    renderScreen();
    await userEvent.click(within(rowOf('زيد احمد')).getByRole('button', { name: 'حذف' }));
    await userEvent.click(screen.getByRole('button', { name: 'احذف الطالب' }));
    await userEvent.click(await screen.findByText('تراجع'));

    await waitFor(() => expect(saveStudentMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(republishMock).toHaveBeenCalledWith(DEFAULT_TENANT, ['s_1']));
  });

  it('does not try to delete a projection for a student who never had a token', async () => {
    renderScreen();
    await userEvent.click(within(rowOf('محمد علي')).getByRole('button', { name: 'حذف' }));
    await userEvent.click(screen.getByRole('button', { name: 'احذف الطالب' }));

    await waitFor(() => expect(deleteStudentMock).toHaveBeenCalledTimes(1));
    expect(deletePublicStatsMock).not.toHaveBeenCalled();
  });
});
