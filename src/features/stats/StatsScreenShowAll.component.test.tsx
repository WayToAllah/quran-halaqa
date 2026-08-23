import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

// Five students so both leaderboards have more entries than the collapsed
// preview shows. Attendance is engineered to straddle the 70% badge line:
// four halaqa days total, so 4/4 = 100%, 3/4 = 75%, 2/4 = 50%, 1/4 = 25%.
const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'محمد علي' },
  { id: 's_3', name: 'عمر حسن' },
  { id: 's_4', name: 'خالد سعيد' },
  { id: 's_5', name: 'انس طارق' },
];

const DAYS = ['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22'];

/** newLoh big enough that each student completes a different number of whole
 * pages, so the pages leaderboard has a strict order with no ties. */
function sessions(
  studentId: string,
  dayCount: number,
  loh: { sura: string; from: string; to: string } | null,
): SessionRecord[] {
  return DAYS.slice(0, dayCount).map((date, i) => ({
    id: `r_${studentId}_${i}`,
    studentId,
    date,
    loh: { score: 90 },
    ...(loh && i === 0 ? { newLoh: [loh] } : {}),
  }));
}

const records: SessionRecord[] = [
  ...sessions('s_1', 4, { sura: 'البقرة', from: '1', to: '60' }),
  ...sessions('s_2', 3, { sura: 'البقرة', from: '1', to: '40' }),
  ...sessions('s_3', 3, { sura: 'البقرة', from: '1', to: '25' }),
  ...sessions('s_4', 2, { sura: 'البقرة', from: '1', to: '20' }),
  // Two sessions minimum: an assignment only counts once a later session has
  // graded it, so a single-session student would have no measurable progress.
  ...sessions('s_5', 2, { sura: 'البقرة', from: '1', to: '10' }),
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

describe('StatsScreen — عرض الكل on the pages leaderboard', () => {
  it('shows only the top three until expanded', () => {
    render(<StatsScreen />);
    const card = cardFor('🏆 الأكثر حفظاً للصفحات');
    expect(card.textContent).toContain('زيد احمد');
    expect(card.textContent).not.toContain('خالد سعيد');
    expect(card.textContent).not.toContain('انس طارق');
  });

  it('reveals every student when عرض الكل is clicked', async () => {
    render(<StatsScreen />);
    const card = cardFor('🏆 الأكثر حفظاً للصفحات');
    await userEvent.click(
      screen.getByRole('button', { name: /عرض الكل \(٥\) — الأكثر حفظاً للصفحات/ }),
    );
    expect(card.textContent).toContain('خالد سعيد');
    expect(card.textContent).toContain('انس طارق');
  });

  it('collapses again via عرض أقل', async () => {
    render(<StatsScreen />);
    const card = cardFor('🏆 الأكثر حفظاً للصفحات');
    await userEvent.click(
      screen.getByRole('button', { name: /عرض الكل \(٥\) — الأكثر حفظاً للصفحات/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: /عرض أقل — الأكثر حفظاً للصفحات/ }));
    expect(card.textContent).not.toContain('انس طارق');
  });
});

describe('StatsScreen — عرض الكل on the attendance leaderboard', () => {
  it('hides students below the 70% badge line until expanded', () => {
    render(<StatsScreen />);
    const card = cardFor('✅ الأكثر حضوراً');
    // 100% and 75% clear the line; 50% and 25% do not.
    expect(card.textContent).toContain('زيد احمد');
    expect(card.textContent).not.toContain('خالد سعيد');
  });

  it('includes below-threshold students once expanded, under a marker', async () => {
    render(<StatsScreen />);
    const card = cardFor('✅ الأكثر حضوراً');
    await userEvent.click(screen.getByRole('button', { name: /عرض الكل \(٥\) — الأكثر حضوراً/ }));
    expect(card.textContent).toContain('خالد سعيد');
    expect(card.textContent).toContain('انس طارق');
    expect(card.textContent).toContain('أقل من ٧٠٪');
  });

  it('does not show the below-70 marker while collapsed', () => {
    render(<StatsScreen />);
    expect(cardFor('✅ الأكثر حضوراً').textContent).not.toContain('أقل من ٧٠٪');
  });
});
