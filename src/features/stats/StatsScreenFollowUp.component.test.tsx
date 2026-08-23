import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

// Halaqa days: 07-01, 07-08, 07-15, 07-22.
//  زيد    — attended the latest day, scored.
//  محمد   — last seen 07-08, so two consecutive misses.
//  عمر    — on the roster but nothing ever recorded.
//  خالد   — attends, but no session was ever scored.
const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'محمد علي' },
  { id: 's_3', name: 'عمر حسن' },
  { id: 's_4', name: 'خالد سعيد' },
];

const records: SessionRecord[] = [
  { id: 'a1', studentId: 's_1', date: '2026-07-01', loh: { score: 90 } },
  { id: 'a2', studentId: 's_1', date: '2026-07-22', loh: { score: 80 } },
  { id: 'b1', studentId: 's_2', date: '2026-07-08', loh: { score: 70 } },
  { id: 'd1', studentId: 's_4', date: '2026-07-22' },
  { id: 'd2', studentId: 's_4', date: '2026-07-15' },
];

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../hooks/useAllRecords', () => ({
  useAllRecords: () => ({ records, loaded: true }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

function cardFor(title: string): HTMLElement {
  return screen.getByText(title).parentElement as HTMLElement;
}

describe('StatsScreen — يحتاجون متابعة card', () => {
  it('lists a student who missed the last two halaqa days', () => {
    render(<StatsScreen />);
    const card = cardFor('⚠️ يحتاجون متابعة');
    expect(card.textContent).toContain('محمد علي');
    expect(card.textContent).toContain('غاب آخر حلقتين');
  });

  it('does not list students who attended the latest halaqa day', () => {
    render(<StatsScreen />);
    const card = cardFor('⚠️ يحتاجون متابعة');
    expect(card.textContent).not.toContain('زيد احمد');
    expect(card.textContent).not.toContain('خالد سعيد');
  });

  it('marks a never-attended student instead of implying they lapsed', () => {
    render(<StatsScreen />);
    const card = cardFor('⚠️ يحتاجون متابعة');
    expect(card.textContent).toContain('عمر حسن');
    expect(card.textContent).toContain('لم يحضر ولا مرة');
  });
});

describe('StatsScreen — students with nothing recorded', () => {
  it('shows a never-recorded student in تفصيل الطلاب', () => {
    render(<StatsScreen />);
    expect(cardFor('تفصيل الطلاب').textContent).toContain('عمر حسن');
  });

  it('shows لم يُقيَّم rather than ٠٪ for an unassessed student', () => {
    render(<StatsScreen />);
    const card = cardFor('تفصيل الطلاب');
    // خالد attended twice but was never scored — an average would be invented.
    expect(card.textContent).toContain('لم يُقيَّم');
  });
});
