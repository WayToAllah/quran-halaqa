import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

// Four halaqa days.
//   زيد    — there since day one, came three times, missed the last → 3 days, 75%
//   خالد   — joined on day three, hasn't missed since → 2 days, 50% halaqa-wide, 100% personal
//   سالم   — showed up once, on the last day → 1 day, 25% halaqa-wide, 100% personal
//
// Under the personal basis خالد and سالم sit at a perfect 100% and push زيد to
// the bottom, despite his having attended more than either. That inversion is
// exactly the blind spot the days basis exists to cover.
const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'خالد سعيد' },
  { id: 's_3', name: 'سالم فؤاد' },
];

const DAYS = ['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22'];

const rec = (id: string, studentId: string, date: string): SessionRecord => ({
  id,
  studentId,
  date,
  loh: { score: 90 },
  madi: { score: 60 },
});

const records: SessionRecord[] = [
  ...DAYS.slice(0, 3).map((d, i) => rec(`r_1_${i}`, 's_1', d)),
  ...DAYS.slice(2).map((d, i) => rec(`r_2_${i}`, 's_2', d)),
  rec('r_3_0', 's_3', DAYS[3]),
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

/** Student names in the order the attendance card currently lists them. */
function attendOrder(): string[] {
  const text = attendCard().textContent ?? '';
  return students
    .map((s) => ({ name: s.name, at: text.indexOf(s.name) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.name);
}

async function openDaysTab() {
  await userEvent.click(screen.getByRole('button', { name: 'أيام الحضور' }));
}

describe('StatsScreen — ترتيب أيام الحضور', () => {
  it('offers a third basis tab alongside the two percentage bases', () => {
    render(<StatsScreen />);
    expect(screen.getByRole('button', { name: 'على مستوى الحلقة' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'منذ انضمامه' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'أيام الحضور' })).toBeTruthy();
  });

  it('orders by raw days attended, putting the veteran above the perfect newcomers', async () => {
    render(<StatsScreen />);
    await openDaysTab();
    expect(attendOrder()).toEqual(['زيد احمد', 'خالد سعيد', 'سالم فؤاد']);
  });

  it('is a real reordering — the personal basis puts the newcomers on top instead', async () => {
    render(<StatsScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'منذ انضمامه' }));
    expect(attendOrder()[2]).toBe('زيد احمد');
  });

  it('shows the day count as the headline figure with the percentage beneath it', async () => {
    render(<StatsScreen />);
    await openDaysTab();
    const card = attendCard();
    expect(card.textContent).toContain('٣ أيام');
    expect(card.textContent).toContain('٧٥٪');
    expect(card.textContent).toContain('٢٥٪'); // سالم's one day out of four
  });

  it('pluralises the day count properly instead of always saying يوم', async () => {
    render(<StatsScreen />);
    await openDaysTab();
    const card = attendCard();
    expect(card.textContent).toContain('٣ أيام'); // زيد — 3..10 takes أيام
    expect(card.textContent).toContain('يومين'); // خالد — dual, no digit
    expect(card.textContent).toContain('يوم واحد'); // سالم
    expect(card.textContent).not.toContain('٣ يوم');
  });

  it('drops the "أقل من ٧٠٪" divider, which would land mid-list under this order', async () => {
    render(<StatsScreen />);
    expect(attendCard().textContent).toContain('أقل من ٧٠٪');
    await openDaysTab();
    expect(attendCard().textContent).not.toContain('أقل من ٧٠٪');
  });

  it('marks the active tab for assistive tech and restores the percentage view on switch back', async () => {
    render(<StatsScreen />);
    const daysTab = screen.getByRole('button', { name: 'أيام الحضور' });
    const halaqaTab = screen.getByRole('button', { name: 'على مستوى الحلقة' });

    await openDaysTab();
    expect(daysTab.getAttribute('aria-pressed')).toBe('true');
    expect(halaqaTab.getAttribute('aria-pressed')).toBe('false');

    await userEvent.click(halaqaTab);
    expect(daysTab.getAttribute('aria-pressed')).toBe('false');
    expect(attendCard().textContent).toContain('أقل من ٧٠٪');
  });

  it('ranks densely — equal day counts share a position', async () => {
    render(<StatsScreen />);
    await openDaysTab();
    const card = attendCard();
    // زيد ٣ أيام (المركز الأول) · خالد ٢ (الثاني) · سالم ١ (الثالث)
    expect(card.textContent).toContain('المركز الأول');
    expect(card.textContent).toContain('المركز الثاني');
    expect(card.textContent).toContain('المركز الثالث');
  });
});
