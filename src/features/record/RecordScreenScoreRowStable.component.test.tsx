import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { RecordScreen } from './RecordScreen';
import type { SessionRecord, Student } from '../../types';

// The teacher's report: finishing the score field makes the screen slip
// downwards. Measured in a real browser at 390/412 CSS px, the tier badge
// ("ممتاز") appearing inside the SAME flex-wrap row as the 📖/🧮 buttons pushed
// those buttons onto a second line — the card grew 42px and everything below it
// jumped down, at exactly the moment the keyboard auto-dismisses.
//
// jsdom has no layout, so the invariant is expressed structurally instead: the
// row that holds the buttons must not gain a child when a score is typed. The
// badge still has to appear — somewhere else.

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
  previousSessionForS1 = null;
});

const prevBase = { id: 'r_prev', studentId: 's_1', date: '2026-07-01' };

describe('RecordScreen — صف الدرجة ثابت', () => {
  it('لا يضيف الشارة لصف الأزرار في اللوح', async () => {
    previousSessionForS1 = { ...prevBase, newLoh: [{ sura: 'النبأ', from: '1', to: '40' }] };
    renderScreen();
    await selectStudent('زيد احمد');

    const buttonsRow = screen.getByRole('button', { name: /📖 المصحف/ }).parentElement!;
    const childrenBefore = buttonsRow.childElementCount;

    await userEvent.type(screen.getByPlaceholderText('مثلاً 90'), '90');

    const badge = await screen.findByText('ممتاز');
    expect(buttonsRow.childElementCount).toBe(childrenBefore);
    expect(buttonsRow.contains(badge)).toBe(false);
  });

  it('لا يضيف الشارة لصف الأزرار في الماضي', async () => {
    previousSessionForS1 = { ...prevBase, newMadi: [{ sura: 'المدثر', from: '1', to: '10' }] };
    renderScreen();
    await selectStudent('زيد احمد');

    const buttonsRow = screen.getByRole('button', { name: /📖 المصحف/ }).parentElement!;
    const childrenBefore = buttonsRow.childElementCount;

    await userEvent.type(screen.getByPlaceholderText('مثلاً 85'), '65');

    const badge = await screen.findByText('مقبول');
    expect(buttonsRow.childElementCount).toBe(childrenBefore);
    expect(buttonsRow.contains(badge)).toBe(false);
  });
});
