import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { RecordScreen } from './RecordScreen';
import { DraftGuardProvider } from '../tenant/DraftGuard';
import type { SessionRecord, Student } from '../../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'عمر خالد' },
];
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
const saveRecordMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../data/records.repo', () => ({
  saveRecord: (...args: unknown[]) => saveRecordMock(...args),
  getRecordsByDate: vi.fn().mockResolvedValue([]),
}));
const createShortMarksMock = vi.fn<(m: string, q: string) => Promise<string>>();
vi.mock('../../data/marks.repo', () => ({
  createShortMarks: (m: string, q: string) => createShortMarksMock(m, q),
}));
vi.mock('../../data/publishStats', () => ({
  republishPublicStatsFor: vi.fn().mockResolvedValue(undefined),
}));

async function selectStudent(name: string) {
  const input = screen.getByPlaceholderText('ابحث أو اختر اسم الطالب…');
  await userEvent.click(input);
  await userEvent.clear(input);
  await userEvent.type(input, name);
  await userEvent.click(screen.getByRole('button', { name }));
}

function renderScreen(editRecord: SessionRecord | null = null) {
  return render(
    <ToastProvider>
      <DraftGuardProvider>
        <RecordScreen editRecord={editRecord} onEditConsumed={() => {}} />
      </DraftGuardProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // By default the short link is never confirmed, so the full one stays.
  createShortMarksMock.mockReturnValue(new Promise<string>(() => {}));
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

  async function openViewer() {
    await userEvent.click(screen.getByRole('button', { name: /📖 المصحف/ }));
    const frame = (await screen.findByTestId('mushaf-frame')) as HTMLIFrameElement;
    const url = new URL(frame.src, window.location.href);
    return { url, token: url.searchParams.get('id')! };
  }

  it('reopens the viewer with the marks and taps it was closed with', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    const first = await openViewer();
    window.postMessage(
      { type: 'mushaf-count', id: first.token, count: 3, rk: '78.1.2.3', rx: 1 },
      '*',
    );
    await waitFor(() => expect(screen.queryByTestId('mushaf-frame')).not.toBeInTheDocument());
    const second = await openViewer();
    expect(second.url.searchParams.get('rk')).toBe('78.1.2.3');
    expect(second.url.searchParams.get('rx')).toBe('1');
  });

  it('counts the second close as the new total, not on top of the first', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    const first = await openViewer();
    window.postMessage({ type: 'mushaf-count', id: first.token, count: 3, rk: '78.1.2.3' }, '*');
    await waitFor(() => expect(screen.getByDisplayValue('97')).toBeInTheDocument());
    const second = await openViewer();
    window.postMessage(
      { type: 'mushaf-count', id: second.token, count: 5, rk: '78.1.2.3.4.5' },
      '*',
    );
    await waitFor(() => expect(screen.getByDisplayValue('95')).toBeInTheDocument());
  });

  it('takes mistakes back when the teacher un-marks words on reopening', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    const first = await openViewer();
    window.postMessage(
      { type: 'mushaf-count', id: first.token, count: 4, rk: '78.1.2.3.4.5' },
      '*',
    );
    await waitFor(() => expect(screen.getByDisplayValue('96')).toBeInTheDocument());
    const second = await openViewer();
    window.postMessage({ type: 'mushaf-count', id: second.token, count: 1, rk: '78.1.2' }, '*');
    await waitFor(() => expect(screen.getByDisplayValue('99')).toBeInTheDocument());
  });

  it('starts a different student with a clean viewer', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    const first = await openViewer();
    window.postMessage(
      { type: 'mushaf-count', id: first.token, count: 2, rk: '78.1.2', rx: 0 },
      '*',
    );
    await waitFor(() => expect(screen.queryByTestId('mushaf-frame')).not.toBeInTheDocument());

    await selectStudent('عمر خالد');
    await selectStudent('زيد احمد');
    previousSessionForS1 = {
      id: 'r_prev',
      studentId: 's_1',
      date: '2026-07-01',
      newLoh: [{ sura: 'النبأ', from: '1', to: '40' }],
    };
    const again = await openViewer();
    expect(again.url.searchParams.has('rk')).toBe(false);
    expect(again.url.searchParams.has('rx')).toBe(false);
  });

  describe('saved without sending, then reopened', () => {
    const LINK = `${window.location.origin}/mushaf/?a=x&m=78.1.2.3`;

    it('stores the red words, taps, total and parent link on the record', async () => {
      renderScreen();
      await selectStudent('زيد احمد');
      const first = await openViewer();
      window.postMessage(
        {
          type: 'mushaf-count',
          id: first.token,
          count: 3,
          rk: '78.1.2.3',
          rx: 1,
          link: LINK,
        },
        '*',
      );
      await waitFor(() => expect(screen.getByDisplayValue('97')).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
      await userEvent.click(
        await screen.findByRole('button', { name: /احفظ بدون إرسال|✓ احفظ الجلسة/ }),
      );
      await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
      const saved = saveRecordMock.mock.calls[0][2] as SessionRecord;
      expect(saved.loh?.mushaf).toEqual({ rk: '78.1.2.3', rx: 1, total: 3, link: LINK });
    });

    it('reopens an edited session with its red words and the same count', async () => {
      renderScreen({
        id: 'r_today',
        studentId: 's_1',
        student: 'زيد احمد',
        date: '2026-07-03',
        loh: {
          score: 97,
          stars: 5,
          mistakes: { full: 3, tajweed: 0 },
          mushaf: { rk: '78.1.2.3', rx: 1, total: 3, link: LINK },
        },
        madi: { score: null, stars: 0 },
        newLoh: [{ sura: 'النبأ', from: '1', to: '40' }],
      });
      const again = await openViewer();
      expect(again.url.searchParams.get('rk')).toBe('78.1.2.3');
      expect(again.url.searchParams.get('rx')).toBe('1');
      // closing unchanged must not add the three mistakes a second time
      window.postMessage(
        { type: 'mushaf-count', id: again.token, count: 3, rk: '78.1.2.3', rx: 1, link: LINK },
        '*',
      );
      await waitFor(() => expect(screen.queryByTestId('mushaf-frame')).not.toBeInTheDocument());
      expect(screen.getByDisplayValue('97')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /تحديث الجلسة/ }));
      await screen.findByText(/مراجعة قبل الحفظ/);
      await waitFor(() => expect(document.body.textContent).toContain(LINK));
    });

    it('keeps the link when the edited session is updated without opening the mushaf', async () => {
      renderScreen({
        id: 'r_today',
        studentId: 's_1',
        student: 'زيد احمد',
        date: '2026-07-03',
        loh: {
          score: 97,
          stars: 5,
          mistakes: { full: 3, tajweed: 0 },
          mushaf: { rk: '78.1.2.3', rx: 1, total: 3, link: LINK },
        },
        madi: { score: null, stars: 0 },
        newLoh: [{ sura: 'النبأ', from: '1', to: '40' }],
      });
      await userEvent.click(await screen.findByRole('button', { name: /تحديث الجلسة/ }));
      await waitFor(() => expect(document.body.textContent).toContain(LINK));
      await userEvent.click(screen.getByRole('button', { name: /حدّث بدون إرسال|✓ حدّث الجلسة/ }));
      await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
      const saved = saveRecordMock.mock.calls[0][2] as SessionRecord;
      expect(saved.loh?.mushaf).toEqual({ rk: '78.1.2.3', rx: 1, total: 3, link: LINK });
      expect(saved.loh?.mistakes).toEqual({ full: 3, tajweed: 0 });
    });
  });

  describe('short marks link', () => {
    const FULL = `${window.location.origin}/mushaf/?e=78.1.2.3&p=582-583`;
    const SHORT = `${window.location.origin}/m/?Ab3dEf7`;

    async function markAndPreview() {
      renderScreen();
      await selectStudent('زيد احمد');
      const v = await openViewer();
      window.postMessage(
        { type: 'mushaf-count', id: v.token, count: 3, rk: '78.1.2.3', link: FULL },
        '*',
      );
      await waitFor(() => expect(screen.getByDisplayValue('97')).toBeInTheDocument());
    }

    it('sends the short link once it is saved, and stores it on the record', async () => {
      createShortMarksMock.mockResolvedValue('Ab3dEf7');
      await markAndPreview();
      expect(createShortMarksMock).toHaveBeenCalledWith(expect.any(String), 'e=78.1.2.3&p=582-583');
      await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
      await waitFor(() => expect(document.body.textContent).toContain(SHORT));
      expect(document.body.textContent).not.toContain(FULL);
      await userEvent.click(screen.getByRole('button', { name: /احفظ بدون إرسال|✓ احفظ الجلسة/ }));
      await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
      expect((saveRecordMock.mock.calls[0][2] as SessionRecord).loh?.mushaf?.link).toBe(SHORT);
    });

    it('keeps the full link when the short one cannot be saved', async () => {
      createShortMarksMock.mockRejectedValue(new Error('permission-denied'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      await markAndPreview();
      await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
      await waitFor(() => expect(document.body.textContent).toContain(FULL));
    });

    it('does not let a late short link land on the next student', async () => {
      let resolve!: (c: string) => void;
      createShortMarksMock.mockReturnValue(new Promise<string>((r) => (resolve = r)));
      await markAndPreview();
      await selectStudent('عمر خالد');
      await userEvent.click(await screen.findByRole('button', { name: /ابدأ من جديد/ }));
      resolve('Ab3dEf7');
      await new Promise((r) => setTimeout(r, 0));
      await userEvent.type(
        screen.getByPlaceholderText('أي ملاحظة عن أداء الطالب اليوم…'),
        'ملاحظة',
      );
      await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
      await screen.findByText(/مراجعة قبل الحفظ/);
      expect(document.body.textContent).toContain('تقييم عمر');
      expect(document.body.textContent).not.toContain(SHORT);
      expect(document.body.textContent).not.toContain('الكلمات اللي غلط فيها');
    });
  });
});
