import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

// Four halaqa days. زيد never misses and grades well. خالد came twice with the
// same grades, so he loses on attendance — the heaviest component. عمر joined
// on the last day only, which his own enrolment window forgives.
const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'خالد سعيد' },
  { id: 's_3', name: 'عمر حسن' },
  { id: 's_4', name: 'أنس طارق' },
];

const DAYS = ['2026-07-01', '2026-07-08', '2026-07-15', '2026-08-05'];

function sessions(id: string, dates: string[]): SessionRecord[] {
  return dates.map((date, i) => ({
    id: `r_${id}_${i}`,
    studentId: id,
    date,
    loh: { score: 90 },
    madi: { score: 80 },
  }));
}

const records: SessionRecord[] = [
  ...sessions('s_1', DAYS),
  ...sessions('s_2', [DAYS[0], DAYS[3]]),
  ...sessions('s_3', [DAYS[3]]),
  ...sessions('s_4', [DAYS[0], DAYS[1]]),
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

function overallCard(): HTMLElement {
  return screen.getByText('🥇 الترتيب العام').closest('[data-card]') as HTMLElement;
}

describe('StatsScreen — الترتيب العام', () => {
  it('renders the card with the three components behind each student’s points', () => {
    render(<StatsScreen />);
    const card = overallCard();
    expect(card.textContent).toContain('زيد احمد');
    expect(card.textContent).toContain('حضور');
    expect(card.textContent).toContain('تسميع');
    expect(card.textContent).toContain('سطور');
  });

  it('puts the student who never misses at the top', () => {
    render(<StatsScreen />);
    const card = overallCard();
    const names = ['زيد احمد', 'أنس طارق'].map((n) => card.textContent!.indexOf(n));
    expect(names[0]).toBeGreaterThanOrEqual(0);
    expect(names[0]).toBeLessThan(names[1]);
  });

  it('says the ranking is cumulative so the month filter isn’t read as applying to it', () => {
    render(<StatsScreen />);
    expect(overallCard().textContent).toContain('من بداية التسجيل');
  });

  it('does not change when a month is selected — the ranking is cumulative', async () => {
    render(<StatsScreen />);
    const before = overallCard().textContent;
    await userEvent.selectOptions(screen.getByRole('combobox'), '2026-07');
    expect(overallCard().textContent).toBe(before);
  });

  it('previews three students and expands to the whole list on request', async () => {
    render(<StatsScreen />);
    expect(overallCard().textContent).not.toContain('خالد سعيد');
    await userEvent.click(screen.getByRole('button', { name: /^عرض الكل.*الترتيب العام$/ }));
    expect(overallCard().textContent).toContain('خالد سعيد');
  });
});
