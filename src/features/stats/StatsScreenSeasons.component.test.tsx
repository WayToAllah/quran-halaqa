import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import { ToastProvider } from '../../ui/ToastProvider';
import type { SessionRecord, Student } from '../../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'خالد سعيد' },
];

// خالد only came in the summer; زيد came in both seasons.
const records: SessionRecord[] = [
  { id: 'a', studentId: 's_1', date: '2026-07-01', loh: { score: 90 } },
  { id: 'b', studentId: 's_2', date: '2026-07-01', loh: { score: 90 } },
  { id: 'c', studentId: 's_1', date: '2026-09-27', loh: { score: 90 } },
];

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../hooks/useAllRecords', () => ({
  useAllRecords: () => ({ records, loaded: true }),
}));
vi.mock('../../domain/dates', async (orig) => ({
  ...(await orig<typeof import('../../domain/dates')>()),
  localDateStr: () => '2026-09-28',
}));

const g = globalThis as { __testSeasons?: unknown[] };
afterEach(() => {
  delete g.__testSeasons;
});

function overallNames(): string {
  return (screen.getByText('🥇 الترتيب العام').closest('[data-card]') as HTMLElement).textContent!;
}

describe('StatsScreen — seasons', () => {
  it('with no seasons shows everything, plus a way to start one', () => {
    render(<StatsScreen />);
    expect(screen.getByRole('button', { name: '+ موسم جديد' })).toBeInTheDocument();
    expect(overallNames()).toContain('خالد سعيد');
  });

  it('defaults to the current season, starting from zero', () => {
    g.__testSeasons = [
      { id: 'sum', name: 'صيف 2026', from: '2026-07-01' },
      { id: 'stu', name: 'دراسة 2027', from: '2026-09-27' },
    ];
    render(<StatsScreen />);
    expect(screen.getByRole('tab', { name: 'دراسة 2027' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(overallNames()).toContain('زيد احمد');
    expect(overallNames()).not.toContain('خالد سعيد');
    expect(overallNames()).toContain('من بداية دراسة 2027');
  });

  it('الكل and older seasons bring the history back', async () => {
    g.__testSeasons = [
      { id: 'sum', name: 'صيف 2026', from: '2026-07-01' },
      { id: 'stu', name: 'دراسة 2027', from: '2026-09-27' },
    ];
    render(<StatsScreen />);
    await userEvent.click(screen.getByRole('tab', { name: 'الكل' }));
    expect(overallNames()).toContain('خالد سعيد');
    await userEvent.click(screen.getByRole('tab', { name: 'صيف 2026' }));
    expect(overallNames()).toContain('خالد سعيد');
  });

  it('the first-time editor suggests naming the history and opening a season today', async () => {
    render(
      <ToastProvider>
        <StatsScreen />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: '+ موسم جديد' }));
    const names = screen.getAllByLabelText('اسم الموسم') as HTMLInputElement[];
    const dates = screen.getAllByLabelText('بداية الموسم') as HTMLInputElement[];
    expect(names.map((x) => x.value)).toEqual(['صيف 2026', 'موسم جديد']);
    expect(dates.map((x) => x.value)).toEqual(['2026-07-01', '2026-09-28']);
  });
});
