import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

// Four students, so the halaqa total has to reach past the three rows the
// pages leaderboard shows before it is expanded. Their page counts are
// 7 / 5 / 3 / 1: the preview adds up to ١٥ and the true total is ١٦, so a card
// that summed only the visible rows would be visibly wrong instead of
// coincidentally right.
const students: Student[] = [1, 2, 3, 4].map((n) => ({ id: `s_${n}`, name: `طالب ${n}` }));

const DAYS = ['2026-06-03', '2026-07-01', '2026-07-08'];

function sess(
  studentId: string,
  day: number,
  loh: { sura: string; from: string; to: string } | null,
): SessionRecord {
  return {
    id: `r_${studentId}_${day}`,
    studentId,
    date: DAYS[day],
    // Every session grades the previous assignment; an ungraded assignment is
    // homework, not memorization, and would never enter the count.
    loh: { score: 90 },
    ...(loh ? { newLoh: [loh] } : {}),
  };
}

const records: SessionRecord[] = [
  // طالب ١ alone has a June session, so he is the only one left when the month
  // filter narrows to 2026-06.
  sess('s_1', 0, { sura: 'البقرة', from: '1', to: '5' }),
  sess('s_1', 1, { sura: 'البقرة', from: '6', to: '60' }),
  sess('s_1', 2, null),
  sess('s_2', 1, { sura: 'البقرة', from: '1', to: '40' }),
  sess('s_2', 2, null),
  sess('s_3', 1, { sura: 'البقرة', from: '1', to: '25' }),
  sess('s_3', 2, null),
  sess('s_4', 1, { sura: 'البقرة', from: '1', to: '10' }),
  sess('s_4', 2, null),
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

/** The number rendered above a summary card's label. */
function statValue(label: string): string {
  const card = screen.getByText(label).parentElement as HTMLElement;
  return (card.firstElementChild as HTMLElement).textContent ?? '';
}

describe('StatsScreen — إجمالي الصفحات المحفوظة', () => {
  it('sums every student, not just the three shown in the leaderboard preview', () => {
    render(<StatsScreen />);
    expect(statValue('إجمالي الصفحات المحفوظة')).toBe('١٦');
  });

  it('follows the month filter like the rest of the summary', async () => {
    render(<StatsScreen />);
    const select = screen.getByDisplayValue('كل الفترة') as HTMLSelectElement;
    await userEvent.selectOptions(select, '2026-06');
    // Only طالب ١ memorized anything in June, and only one whole page of it.
    expect(statValue('إجمالي الصفحات المحفوظة')).toBe('١');
  });
});
