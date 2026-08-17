import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { RecordScreen } from './RecordScreen';
import type { SessionRecord, Student } from '../../types';

const students: Student[] = [{ id: 's_1', name: 'زيد احمد' }];
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
  saveRecord: vi.fn().mockResolvedValue(undefined),
  getRecordsByDate: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../data/publishStats', () => ({
  republishPublicStatsFor: vi.fn().mockResolvedValue(undefined),
}));

async function selectStudent(name: string) {
  const input = screen.getByPlaceholderText('ابحث أو اختر اسم الطالب…');
  await userEvent.click(input);
  await userEvent.type(input, name);
  await userEvent.click(screen.getByRole('button', { name }));
}

function renderScreen() {
  return render(
    <ToastProvider>
      <RecordScreen editRecord={null} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  previousSessionForS1 = {
    id: 'r_prev',
    studentId: 's_1',
    date: '2026-07-01',
    newLoh: [{ sura: 'النبأ', from: '1', to: '40' }],
  };
});

describe('RecordScreen — المصحف', () => {
  it('opens the viewer on the ward the student is reciting', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    await userEvent.click(screen.getByRole('button', { name: /📖 المصحف/ }));
    const frame = (await screen.findByTestId('mushaf-frame')) as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toContain(`a=${encodeURIComponent('النبأ')}:1:40`);
  });

  it('turns the mistakes counted in the mushaf into the evaluation score', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    await userEvent.click(screen.getByRole('button', { name: /📖 المصحف/ }));
    const frame = (await screen.findByTestId('mushaf-frame')) as HTMLIFrameElement;
    const token = new URL(frame.src, window.location.href).searchParams.get('id')!;

    window.postMessage({ type: 'mushaf-count', id: token, count: 6 }, '*');
    await waitFor(() => expect(screen.getByDisplayValue('94')).toBeInTheDocument());
    expect(screen.queryByTestId('mushaf-frame')).not.toBeInTheDocument();
  });

  it('keeps the count when the mistake counter is opened afterwards', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    await userEvent.click(screen.getByRole('button', { name: /📖 المصحف/ }));
    const frame = (await screen.findByTestId('mushaf-frame')) as HTMLIFrameElement;
    const token = new URL(frame.src, window.location.href).searchParams.get('id')!;
    window.postMessage({ type: 'mushaf-count', id: token, count: 2 }, '*');
    await waitFor(() => expect(screen.getByDisplayValue('98')).toBeInTheDocument());
    // the counter button now reflects the same two mistakes
    expect(screen.getByRole('button', { name: /🧮 عدّاد الأخطاء \(2\)/ })).toBeInTheDocument();
  });
});
