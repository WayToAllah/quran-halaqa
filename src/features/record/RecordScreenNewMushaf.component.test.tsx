import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { RecordScreen } from './RecordScreen';
import type { SessionRecord, Student } from '../../types';

// The teacher wanted the mushaf reachable from the NEW assignment too, not just
// from the evaluation card — but read-only there: "الجديد" carries no score, so
// anything counted while it is open must not touch the evaluation.

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

async function pickSura(name: string, index = 0) {
  const inputs = screen.getAllByPlaceholderText('اكتب اسم السورة…');
  await userEvent.click(inputs[index]);
  await userEvent.type(inputs[index], name);
  const option = await screen.findByRole('button', { name: new RegExp(`\\d+\\. ${name}`) });
  await userEvent.click(option);
}

async function fillRange(index: number, from: string, to: string) {
  await userEvent.type(screen.getAllByPlaceholderText('من آية')[index], from);
  await userEvent.type(screen.getAllByPlaceholderText('إلى آية')[index], to);
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
  previousSessionForS1 = null;
});

describe('RecordScreen — المصحف في الورد الجديد', () => {
  it('يفتح المصحف على اللوح الجديد اللي المحفّظ لسه كاتبه', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    await pickSura('النبأ', 0);
    await fillRange(0, '1', '40');

    await userEvent.click(screen.getByRole('button', { name: 'المصحف — اللوح الجديد' }));

    const frame = (await screen.findByTestId('mushaf-frame')) as HTMLIFrameElement;
    const src = frame.getAttribute('src')!;
    expect(src).toContain(`a=${encodeURIComponent('النبأ')}:1:40`);
    expect(src).toContain(`w=${encodeURIComponent('اللوح الجديد')}`);
  });

  it('يفتح المصحف على الماضي الجديد', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    // Row 0 is اللوح الجديد, row 1 is مراجعة الماضي.
    await pickSura('المدثر', 1);
    await fillRange(1, '1', '10');

    await userEvent.click(screen.getByRole('button', { name: 'المصحف — الماضي الجديد' }));

    const frame = (await screen.findByTestId('mushaf-frame')) as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toContain(`a=${encodeURIComponent('المدثر')}:1:10`);
  });

  it('عرض فقط: الأخطاء المعدودة هناك لا تدخل التقييم', async () => {
    previousSessionForS1 = {
      id: 'r_prev',
      studentId: 's_1',
      date: '2026-07-01',
      newLoh: [{ sura: 'الفلق', from: '1', to: '5' }],
    };
    renderScreen();
    await selectStudent('زيد احمد');
    await pickSura('النبأ', 0);
    await fillRange(0, '1', '40');

    await userEvent.click(screen.getByRole('button', { name: 'المصحف — اللوح الجديد' }));
    const frame = (await screen.findByTestId('mushaf-frame')) as HTMLIFrameElement;
    const token = new URL(frame.src, window.location.href).searchParams.get('id')!;

    window.postMessage({ type: 'mushaf-count', id: token, count: 6 }, '*');

    // It still closes — the viewer's own close button is what sends that
    // message — but the score field stays untouched.
    await waitFor(() => expect(screen.queryByTestId('mushaf-frame')).not.toBeInTheDocument());
    expect((screen.getByPlaceholderText('مثلاً 90') as HTMLInputElement).value).toBe('');
  });

  it('الزر معطّل قبل ما يتكتب ورد', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    expect(screen.getByRole('button', { name: 'المصحف — اللوح الجديد' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'المصحف — الماضي الجديد' })).toBeDisabled();
  });
});
