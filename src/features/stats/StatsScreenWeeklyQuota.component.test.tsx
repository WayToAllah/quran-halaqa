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

// Study season, one day a week. زيد comes once a week; خالد twice.
const records: SessionRecord[] = [
  { id: 'a', studentId: 's_1', date: '2026-09-28' },
  { id: 'b', studentId: 's_1', date: '2026-10-05' },
  { id: 'c', studentId: 's_2', date: '2026-09-26' },
  { id: 'd', studentId: 's_2', date: '2026-09-30' },
  { id: 'e', studentId: 's_2', date: '2026-10-03' },
  { id: 'f', studentId: 's_2', date: '2026-10-07' },
];

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../hooks/useAllRecords', () => ({
  useAllRecords: () => ({ records, loaded: true }),
}));
vi.mock('../../domain/dates', async (orig) => ({
  ...(await orig<typeof import('../../domain/dates')>()),
  localDateStr: () => '2026-10-12',
}));

const g = globalThis as { __testSeasons?: unknown[] };
afterEach(() => {
  delete g.__testSeasons;
});

function attendCard(): string {
  return (screen.getByText('✅ الأكثر حضوراً').closest('[data-card]') as HTMLElement).textContent!;
}

describe('StatsScreen — weekly attendance quota', () => {
  it('one day a week is 100%, and extra days show beside it', () => {
    g.__testSeasons = [{ id: 'stu', name: 'دراسة 2027', from: '2026-09-26', daysPerWeek: 1 }];
    render(<StatsScreen />);
    const text = attendCard();
    expect(text).not.toMatch(/٣٣٪/);
    expect(text).toContain('+٢ زيادة');
    expect(screen.getByText('متوسط الحضور الأسبوعي')).toBeInTheDocument();
  });

  it('without a quota the old per-day rule stands', () => {
    g.__testSeasons = [{ id: 'stu', name: 'دراسة 2027', from: '2026-09-26' }];
    render(<StatsScreen />);
    // Six halaqa days, زيد came to two of them.
    expect(attendCard()).toMatch(/٣٣٪/);
    expect(screen.getByText('متوسط الحضور اليومي')).toBeInTheDocument();
  });

  it('the editor sets the weekly quota per season', async () => {
    g.__testSeasons = [{ id: 'stu', name: 'دراسة 2027', from: '2026-09-26' }];
    render(
      <ToastProvider>
        <StatsScreen />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: '⚙︎ المواسم' }));
    const select = screen.getByLabelText('أيام الحضور في الأسبوع') as HTMLSelectElement;
    expect(select.value).toBe('');
    await userEvent.selectOptions(select, '1');
    expect(select.value).toBe('1');
  });
});
