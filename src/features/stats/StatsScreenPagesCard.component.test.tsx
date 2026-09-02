import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

// Page counts 7 / 5 / 5 / 1 — عمر and علي are deliberately tied, which is
// what separates a real rank from the row index: both must read المركز الثاني,
// and حسن must then be الثالث, not الرابع.
const NAMES = ['زيد', 'عمر', 'علي', 'حسن'];
const students: Student[] = NAMES.map((name, i) => ({ id: `s_${i + 1}`, name }));

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
    loh: { score: 90 },
    ...(loh ? { newLoh: [loh] } : {}),
  };
}

const records: SessionRecord[] = [
  sess('s_1', 0, { sura: 'البقرة', from: '1', to: '5' }),
  sess('s_1', 1, { sura: 'البقرة', from: '6', to: '60' }),
  sess('s_1', 2, null),
  sess('s_2', 1, { sura: 'البقرة', from: '1', to: '40' }),
  sess('s_2', 2, null),
  sess('s_3', 1, { sura: 'البقرة', from: '1', to: '40' }),
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

/** The leaderboard row for a student, inside the الأكثر حفظاً card. */
function pagesRow(name: string): HTMLElement {
  const card = screen.getByText('🏆 الأكثر حفظاً للصفحات').parentElement as HTMLElement;
  const nameEl = Array.from(card.querySelectorAll('div')).find(
    (el) => el.textContent?.trim() === name && el.className.includes('truncate'),
  );
  if (!nameEl) throw new Error(`no pages row for ${name}`);
  return nameEl.parentElement as HTMLElement;
}

describe('StatsScreen — ترتيب الحفظ', () => {
  it('labels each row with its المركز, the way the attendance leaderboard does', () => {
    render(<StatsScreen />);
    expect(pagesRow('زيد').textContent).toContain('المركز الأول');
  });

  it('gives tied students the same المركز instead of consecutive row numbers', async () => {
    render(<StatsScreen />);
    await userEvent.click(screen.getByLabelText(/عرض الكل .* الأكثر حفظاً للصفحات/));
    expect(pagesRow('عمر').textContent).toContain('المركز الثاني');
    expect(pagesRow('علي').textContent).toContain('المركز الثاني');
  });

  it('is dense — the student after a tie takes the next المركز, not a skipped one', async () => {
    render(<StatsScreen />);
    await userEvent.click(screen.getByLabelText(/عرض الكل .* الأكثر حفظاً للصفحات/));
    expect(pagesRow('حسن').textContent).toContain('المركز الثالث');
  });
});

describe('StatsScreen — بطاقة نجوم الحفظ', () => {
  it('offers a share button for the pages ranking, like the attendance one', () => {
    render(<StatsScreen />);
    expect(screen.getByText(/بطاقة نجوم الحفظ — للمشاركة/)).toBeTruthy();
  });

  it('opens a preview of the poster when tapped', async () => {
    render(<StatsScreen />);
    await userEvent.click(screen.getByText(/بطاقة نجوم الحفظ — للمشاركة/));
    expect(screen.getByText('بطاقة نجوم الحفظ')).toBeTruthy();
    expect(document.querySelector('svg[width="1080"]')).toBeTruthy();
  });

  it('closes the preview again', async () => {
    render(<StatsScreen />);
    await userEvent.click(screen.getByText(/بطاقة نجوم الحفظ — للمشاركة/));
    const closers = screen.getAllByText('إغلاق');
    await userEvent.click(closers[closers.length - 1]);
    expect(screen.queryByText('بطاقة نجوم الحفظ')).toBeNull();
  });
});
