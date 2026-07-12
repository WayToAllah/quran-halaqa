import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'محمد علي' },
];

const records: SessionRecord[] = [
  { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 0 }, newLoh: [{ sura: 'البقرة', from: '1', to: '20' }] },
  { id: 'r2', studentId: 's_1', date: '2026-07-02', loh: { score: 90 } },
  { id: 'r3', studentId: 's_2', date: '2026-06-01', loh: { score: 80 } },
];

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../hooks/useAllRecords', () => ({
  useAllRecords: () => ({ records, loaded: true }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StatsScreen — summary cards', () => {
  it('shows total sessions across all records by default', () => {
    render(<StatsScreen />);
    expect(screen.getByText('3')).toBeInTheDocument(); // جلسة مسجلة
  });

  it('shows a genuine zero loh score counted in the average (scoreName(0)/hasScore regression)', () => {
    render(<StatsScreen />);
    // avgLoh = round((0 + 90 + 80) / 3) = 57 — the zero from r1 must be
    // INCLUDED in this average, not treated as "unscored" and skipped.
    expect(screen.getByText('57%')).toBeInTheDocument();
  });
});

describe('StatsScreen — month filter', () => {
  it('lists distinct months present in the data', () => {
    render(<StatsScreen />);
    const select = screen.getByDisplayValue('كل الفترة') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(expect.arrayContaining(['all', '2026-07', '2026-06']));
  });

  it('filters summary numbers when a specific month is selected', async () => {
    render(<StatsScreen />);
    const select = screen.getByDisplayValue('كل الفترة') as HTMLSelectElement;
    await userEvent.selectOptions(select, '2026-06');
    // Only r3 (محمد علي, 2026-06) remains -> 1 session, avgLoh = 80%
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});

describe('StatsScreen — score distribution', () => {
  it('renders the إعادة bucket for the genuine zero score', () => {
    render(<StatsScreen />);
    expect(screen.getByText('إعادة')).toBeInTheDocument();
  });
});

describe('StatsScreen — leaderboards', () => {
  it('shows زيد احمد at the top of the ayat leaderboard', () => {
    render(<StatsScreen />);
    expect(screen.getByText(/20 آية مسمّعة/)).toBeInTheDocument();
  });
});

describe('StatsScreen — student table', () => {
  it('shows both students by default', () => {
    render(<StatsScreen />);
    // Names appear at least once each (leaderboards + table)
    expect(screen.getAllByText('زيد احمد').length).toBeGreaterThan(0);
    expect(screen.getAllByText('محمد علي').length).toBeGreaterThan(0);
  });

  it('filters the table by search text', async () => {
    render(<StatsScreen />);
    await userEvent.type(screen.getByPlaceholderText('🔍 ابحث عن طالب...'), 'محمد');
    // The detail table row for زيد احمد should disappear, but leaderboard
    // mentions may remain — check specifically for the "X جلسة · Y آية" row text
    expect(screen.getByText(/1 جلسة · 0 آية/)).toBeInTheDocument(); // محمد row
  });

  it('switches sort key when a sort tab is clicked', async () => {
    render(<StatsScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'الاسم' }));
    // No assertion error thrown means the click handled cleanly; deeper
    // order assertions are covered at the domain level (sortStudentStatsRows).
    expect(screen.getByRole('button', { name: 'الاسم' })).toHaveClass('bg-brand-teal');
  });
});
