import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { DraftGuardProvider } from '../tenant/DraftGuard';
import { RecordScreen } from './RecordScreen';
import type { SessionRecord, Student } from '../../types';

// The record page used to stack everything in one long column. The teacher
// wanted two switch buttons instead: «اللوح» shows today's loh evaluation with
// the new loh right under it, «الماضي» the same for madi.

const students: Student[] = [{ id: 's_1', name: 'زيد احمد' }];
const previousSessionForS1: SessionRecord = {
  id: 'r_prev',
  studentId: 's_1',
  date: '2026-11-10',
  newLoh: [{ sura: 'النبأ', from: 1, to: 20 }],
  newMadi: [{ sura: 'الملك', from: 1, to: 30 }],
} as unknown as SessionRecord;

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
      <DraftGuardProvider>
        <RecordScreen editRecord={null} />
      </DraftGuardProvider>
    </ToastProvider>,
  );
}

const panel = (id: 'loh' | 'madi') => screen.getAllByTestId(`ward-panel-${id}`);
const shown = (els: HTMLElement[]) => els.every((el) => !el.classList.contains('hidden'));
const hiddenAll = (els: HTMLElement[]) => els.every((el) => el.classList.contains('hidden'));

beforeEach(() => vi.clearAllMocks());

describe('RecordScreen — زراري اللوح والماضي', () => {
  it('يبدأ على اللوح: تقييم اللوح الحالي واللوح الجديد ظاهرين، والماضي مستخبي', async () => {
    renderScreen();
    await selectStudent('زيد احمد');

    expect(screen.getByRole('button', { name: /^📗 اللوح/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // current-loh evaluation + new-loh card
    expect(panel('loh')).toHaveLength(2);
    expect(panel('madi')).toHaveLength(2);
    expect(shown(panel('loh'))).toBe(true);
    expect(hiddenAll(panel('madi'))).toBe(true);
  });

  it('زرار الماضي يعرض تقييم الماضي الحالي والماضي الجديد ويخبي اللوح', async () => {
    renderScreen();
    await selectStudent('زيد احمد');

    await userEvent.click(screen.getByRole('button', { name: /^📙 الماضي/ }));

    expect(screen.getByRole('button', { name: /^📙 الماضي/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(shown(panel('madi'))).toBe(true);
    expect(hiddenAll(panel('loh'))).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /^📗 اللوح/ }));
    expect(shown(panel('loh'))).toBe(true);
    expect(hiddenAll(panel('madi'))).toBe(true);
  });

  it('الزرار يوري الدرجة اللي اتكتبت عشان المحفّظ يعرف إنه خلّص الجزء ده', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    await userEvent.type(screen.getByPlaceholderText('مثلاً 90'), '95');
    expect(screen.getByRole('button', { name: /^📗 اللوح/ })).toHaveTextContent('95');
  });

  it('لو في صف ناقص في الماضي وهو على تبويب اللوح، الحفظ ينقله للماضي', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    // a madi sura name typed but never matched — the save guard stops on it
    const suraInputs = screen.getAllByPlaceholderText('اكتب اسم السورة…');
    const madiSura = suraInputs[suraInputs.length - 1];
    await userEvent.clear(madiSura);
    await userEvent.type(madiSura, 'زززز');
    await userEvent.click(document.body);

    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));

    expect(shown(panel('madi'))).toBe(true);
  });
});
