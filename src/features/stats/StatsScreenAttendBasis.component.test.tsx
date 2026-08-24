import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

// Four halaqa days. زيد has been there since day one and attended all four.
// خالد joined on the third day and hasn't missed one since — halaqa-wide he
// looks like a 50% student, but measured from his own start he is perfect.
const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'خالد سعيد' },
];

const DAYS = ['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22'];

const records: SessionRecord[] = [
  ...DAYS.map((date, i) => ({ id: `r_1_${i}`, studentId: 's_1', date, loh: { score: 90 } })),
  ...DAYS.slice(2).map((date, i) => ({
    id: `r_2_${i}`,
    studentId: 's_2',
    date,
    loh: { score: 90 },
  })),
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

function attendCard(): HTMLElement {
  return screen.getByText('✅ الأكثر حضوراً').parentElement as HTMLElement;
}

describe('StatsScreen — أساس حساب الحضور', () => {
  it('defaults to the halaqa-wide basis, where a late joiner scores 50%', () => {
    render(<StatsScreen />);
    const card = attendCard();
    expect(card.textContent).toContain('٥٠٪');
    expect(card.textContent).toContain('٢ يوم حضور من ٤');
  });

  it('switches the late joiner to 100% when measured since he joined', async () => {
    render(<StatsScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'منذ انضمامه' }));
    const card = attendCard();
    expect(card.textContent).not.toContain('٥٠٪');
    expect(card.textContent).toContain('٢ يوم حضور من ٢');
  });

  it('keeps the veteran at 100% under both bases', async () => {
    render(<StatsScreen />);
    expect(attendCard().textContent).toContain('٤ يوم حضور من ٤');
    await userEvent.click(screen.getByRole('button', { name: 'منذ انضمامه' }));
    expect(attendCard().textContent).toContain('٤ يوم حضور من ٤');
  });

  it('marks the active basis for assistive tech and can switch back', async () => {
    render(<StatsScreen />);
    const halaqaTab = screen.getByRole('button', { name: 'على مستوى الحلقة' });
    const personalTab = screen.getByRole('button', { name: 'منذ انضمامه' });
    expect(halaqaTab.getAttribute('aria-pressed')).toBe('true');

    await userEvent.click(personalTab);
    expect(personalTab.getAttribute('aria-pressed')).toBe('true');
    expect(halaqaTab.getAttribute('aria-pressed')).toBe('false');

    await userEvent.click(halaqaTab);
    expect(attendCard().textContent).toContain('٥٠٪');
  });
});
